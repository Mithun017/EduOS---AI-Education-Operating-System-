import time
import asyncio
import logging
from typing import AsyncIterator, List, Dict, Optional
import redis.asyncio as aioredis
from fastapi import HTTPException, status

from app.core.config import settings
from app.ai.providers.base import AIProvider, AIRequest, AIChunk
from app.ai.providers.nim_provider import NIMProvider
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.groq_provider import GroqProvider

logger = logging.getLogger(__name__)

class AIOrchestrationError(Exception):
    pass

class RateLimitExceededError(HTTPException):
    def __init__(self, detail: str = "Rate limit exceeded for institution"):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)

class AIOrchestrator:
    def __init__(self, redis_client: Optional[aioredis.Redis] = None):
        self.redis_client = redis_client
        self.providers: List[AIProvider] = [
            NIMProvider(),
            GeminiProvider(),
            GroqProvider()
        ]
        # Sort by priority order (1 is highest)
        self.providers.sort(key=lambda p: p.priority)
        
        # Circuit breaker state: {provider_name: {"failure_count": int, "cooldown_until": float}}
        self._circuit_breakers: Dict[str, Dict] = {
            p.name: {"failure_count": 0, "cooldown_until": 0.0} for p in self.providers
        }
        self.failure_threshold = 3
        self.cooldown_period_seconds = 60.0
        self.provider_timeout_seconds = 12.0 # 12s streaming start timeout

    async def _check_rate_limit(self, institution_id: str):
        if not self.redis_client or not institution_id:
            return
        
        # Redis token bucket rate limiting per institution
        current_minute = int(time.time() // 60)
        key = f"rate:{institution_id}:{current_minute}"
        
        count = await self.redis_client.incr(key)
        if count == 1:
            await self.redis_client.expire(key, 65) # 65 sec TTL
            
        if count > settings.RATE_LIMIT_REQUESTS_PER_MINUTE:
            logger.warning(f"Rate limit exceeded for institution {institution_id}: {count} reqs/min")
            raise RateLimitExceededError(f"Rate limit exceeded. Maximum {settings.RATE_LIMIT_REQUESTS_PER_MINUTE} requests per minute.")

    def _is_circuit_open(self, provider_name: str) -> bool:
        cb = self._circuit_breakers.get(provider_name)
        if not cb:
            return False
        if cb["failure_count"] >= self.failure_threshold:
            if time.time() < cb["cooldown_until"]:
                return True
            else:
                # Cooldown expired, reset circuit breaker
                cb["failure_count"] = 0
                cb["cooldown_until"] = 0.0
                return False
        return False

    def _record_failure(self, provider_name: str):
        cb = self._circuit_breakers.get(provider_name)
        if cb:
            cb["failure_count"] += 1
            if cb["failure_count"] >= self.failure_threshold:
                cb["cooldown_until"] = time.time() + self.cooldown_period_seconds
                logger.warning(f"Circuit breaker tripped for provider {provider_name}. Cooldown for {self.cooldown_period_seconds}s.")

    def _record_success(self, provider_name: str):
        cb = self._circuit_breakers.get(provider_name)
        if cb:
            cb["failure_count"] = 0
            cb["cooldown_until"] = 0.0

    async def generate_stream(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        if request.institution_id:
            await self._check_rate_limit(request.institution_id)

        last_error = None
        for provider in self.providers:
            if self._is_circuit_open(provider.name):
                logger.info(f"Skipping provider {provider.name}: circuit breaker open.")
                continue

            try:
                # Check health before generation
                if not await provider.health_check():
                    logger.info(f"Provider {provider.name} failed health check. Trying next.")
                    continue

                logger.info(f"Attempting generation with provider: {provider.name}")
                chunk_generator = provider.generate(request)
                
                # Get first chunk with timeout to ensure fast responsiveness
                first_chunk = await asyncio.wait_for(
                    chunk_generator.__anext__(),
                    timeout=self.provider_timeout_seconds
                )
                
                # First token arrived successfully! Yield first chunk
                self._record_success(provider.name)
                yield first_chunk
                
                # Yield remaining chunks from this provider
                async for chunk in chunk_generator:
                    yield chunk

                # Successful stream completed! Return.
                return

            except (asyncio.TimeoutError, Exception) as e:
                logger.warning(f"Provider {provider.name} failed during generation: {e}")
                self._record_failure(provider.name)
                last_error = e
                # Fall through to next provider in priority chain silently!
                continue

        # If all providers in chain failed:
        error_msg = f"All AI providers in fallback chain failed. Last error: {last_error}"
        logger.error(error_msg)
        raise AIOrchestrationError(error_msg)

    async def classify_intent(self, prompt: str, categories: List[str]) -> str:
        """Fast intent classification route using Groq (or fallback)."""
        groq_provider = GroqProvider()
        system_prompt = (
            f"You are a strict classifier. Categorize the user request into exactly one of these choices: "
            f"{', '.join(categories)}. Respond ONLY with the selected category name and nothing else."
        )
        req = AIRequest(
            messages=[AIMessage(role="user", content=prompt)],
            system_prompt=system_prompt,
            temperature=0.0,
            max_tokens=30
        )

        try:
            if await groq_provider.health_check():
                result_text = ""
                async for chunk in groq_provider.generate(req):
                    result_text += chunk.text
                chosen = result_text.strip().lower()
                for cat in categories:
                    if cat.lower() in chosen:
                        return cat
        except Exception as e:
            logger.warning(f"Groq fast intent classification failed: {e}. Falling back to default.")

        return categories[0]
