from dataclasses import dataclass, field
from typing import Protocol, AsyncIterator, Optional, List, Dict, Any

@dataclass
class AIMessage:
    role: str # system | user | assistant
    content: str

@dataclass
class AIRequest:
    messages: List[AIMessage]
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 1000
    institution_id: Optional[str] = None
    response_format: Optional[str] = None # text | json_object

@dataclass
class AIChunk:
    text: str
    is_final: bool = False
    provider_name: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0

class AIProvider(Protocol):
    name: str
    priority: int

    async def generate(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        ...

    async def health_check(self) -> bool:
        ...
