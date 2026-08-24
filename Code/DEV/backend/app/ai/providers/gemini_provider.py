import time
import logging
from typing import AsyncIterator
import google.generativeai as genai
from app.core.config import settings
from app.ai.providers.base import AIRequest, AIChunk

logger = logging.getLogger(__name__)

class GeminiProvider:
    name: str = "google_gemini"
    priority: int = 2

    def __init__(self):
        self.api_key = settings.GOOGLE_GEMINI_API_KEY
        if self.api_key and self.api_key != "your_google_gemini_api_key_here":
            genai.configure(api_key=self.api_key)
            self._configured = True
        else:
            self._configured = False

    async def health_check(self) -> bool:
        return self._configured

    async def generate(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        if not self._configured:
            raise RuntimeError("Google Gemini provider not configured with valid API key")

        start_time = time.time()
        contents = []
        for msg in request.messages:
            contents.append({"role": "user" if msg.role == "user" else "model", "parts": [msg.content]})

        models_to_try = ["gemini-2.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"]
        response = None
        last_err = None

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=request.system_prompt if request.system_prompt else None
                )
                response = await model.generate_content_async(
                    contents=contents,
                    generation_config=genai.GenerationConfig(
                        temperature=request.temperature,
                        max_output_tokens=request.max_tokens
                    ),
                    stream=True
                )
                break
            except Exception as e:
                last_err = e
                continue

        if not response:
            raise RuntimeError(f"Gemini API model streaming failed: {last_err}")

        async for chunk in response:
            if chunk.text:
                yield AIChunk(text=chunk.text, provider_name=self.name)

        latency = int((time.time() - start_time) * 1000)
        yield AIChunk(text="", is_final=True, provider_name=self.name, latency_ms=latency)
