import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.ai.orchestrator import AIOrchestrator, AIOrchestrationError, RateLimitExceededError
from app.ai.providers.base import AIRequest, AIMessage, AIChunk

@pytest.mark.asyncio
async def test_orchestrator_successful_first_provider():
    orchestrator = AIOrchestrator()
    
    # Mock NIM provider success
    async def mock_nim_gen(request):
        yield AIChunk(text="Hello ", provider_name="nvidia_nim")
        yield AIChunk(text="world!", provider_name="nvidia_nim")
        yield AIChunk(text="", is_final=True, provider_name="nvidia_nim", latency_ms=100)

    orchestrator.providers[0].health_check = AsyncMock(return_value=True)
    orchestrator.providers[0].generate = mock_nim_gen

    req = AIRequest(messages=[AIMessage(role="user", content="Hi")])
    chunks = []
    async for chunk in orchestrator.generate_stream(req):
        chunks.append(chunk)

    assert len(chunks) == 3
    assert chunks[0].provider_name == "nvidia_nim"
    assert chunks[0].text == "Hello "
    assert chunks[1].text == "world!"

@pytest.mark.asyncio
async def test_orchestrator_failover_nim_to_gemini():
    orchestrator = AIOrchestrator()

    # Mock NIM failure
    orchestrator.providers[0].health_check = AsyncMock(return_value=True)
    orchestrator.providers[0].generate = MagicMock(side_effect=Exception("NIM Connection Error"))

    # Mock Gemini success
    async def mock_gemini_gen(request):
        yield AIChunk(text="Gemini response", provider_name="google_gemini")
        yield AIChunk(text="", is_final=True, provider_name="google_gemini")

    orchestrator.providers[1].health_check = AsyncMock(return_value=True)
    orchestrator.providers[1].generate = mock_gemini_gen

    req = AIRequest(messages=[AIMessage(role="user", content="Hi")])
    chunks = []
    async for chunk in orchestrator.generate_stream(req):
        chunks.append(chunk)

    assert len(chunks) == 2
    assert chunks[0].provider_name == "google_gemini"
    assert chunks[0].text == "Gemini response"

@pytest.mark.asyncio
async def test_orchestrator_all_providers_failed():
    orchestrator = AIOrchestrator()

    for provider in orchestrator.providers:
        provider.health_check = AsyncMock(return_value=True)
        provider.generate = MagicMock(side_effect=Exception("API failure"))

    req = AIRequest(messages=[AIMessage(role="user", content="Hi")])

    with pytest.raises(AIOrchestrationError):
        async for _ in orchestrator.generate_stream(req):
            pass

@pytest.mark.asyncio
async def test_circuit_breaker():
    orchestrator = AIOrchestrator()
    provider_name = "nvidia_nim"

    # Fail 3 times to trip circuit breaker
    for _ in range(3):
        orchestrator._record_failure(provider_name)

    assert orchestrator._is_circuit_open(provider_name) is True

    # Record success resets it
    orchestrator._record_success(provider_name)
    assert orchestrator._is_circuit_open(provider_name) is False

@pytest.mark.asyncio
async def test_rate_limiting():
    mock_redis = AsyncMock()
    mock_redis.incr = AsyncMock(return_value=101) # Exceeds limit 100
    
    orchestrator = AIOrchestrator(redis_client=mock_redis)
    
    with pytest.raises(RateLimitExceededError):
        await orchestrator._check_rate_limit("inst-test-123")
