import time
import logging
from typing import AsyncIterator
from groq import AsyncGroq
from app.core.config import settings
from app.ai.providers.base import AIRequest, AIChunk

logger = logging.getLogger(__name__)

class GroqProvider:
    name: str = "groq"
    priority: int = 2

    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self._client = None
        if self.api_key and self.api_key != "your_groq_api_key_here":
            self._client = AsyncGroq(api_key=self.api_key)

    async def health_check(self) -> bool:
        return self._client is not None

    async def generate(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        if not self._client:
            raise RuntimeError("Groq provider not configured with valid API key")

        start_time = time.time()
        formatted_messages = []
        if request.system_prompt:
            formatted_messages.append({"role": "system", "content": request.system_prompt})
        for msg in request.messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        model_name = "llama-3.3-70b-versatile"

        response_stream = await self._client.chat.completions.create(
            model=model_name,
            messages=formatted_messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=True
        )

        async for chunk in response_stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield AIChunk(text=delta, provider_name=self.name)

        latency = int((time.time() - start_time) * 1000)
        yield AIChunk(text="", is_final=True, provider_name=self.name, latency_ms=latency)
