import time
import logging
from typing import AsyncIterator
from openai import AsyncOpenAI
from app.core.config import settings
from app.ai.providers.base import AIRequest, AIChunk

logger = logging.getLogger(__name__)

class NIMProvider:
    name: str = "nvidia_nim"
    priority: int = 1

    def __init__(self):
        self.api_key = settings.NVIDIA_NIM_API_KEY
        self.base_url = settings.NVIDIA_NIM_BASE_URL
        self._client = None
        if self.api_key and self.api_key != "your_nvidia_nim_api_key_here":
            self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def health_check(self) -> bool:
        if not self._client:
            return False
        return True

    async def generate(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        if not self._client:
            raise RuntimeError("NVIDIA NIM provider not configured with valid API key")

        start_time = time.time()
        formatted_messages = []
        if request.system_prompt:
            formatted_messages.append({"role": "system", "content": request.system_prompt})
        for msg in request.messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        model_name = "meta/llama-3.1-70b-instruct" # Standard NIM reasoning model

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
