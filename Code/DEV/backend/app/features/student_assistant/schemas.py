from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class StudentAskRequest(BaseModel):
    topic_id: str = Field(..., description="UUID of active topic")
    conversation_id: Optional[str] = Field(None, description="Existing conversation UUID or null to start new private session")
    message: str = Field(..., description="Student message")

class StudentAskResponse(BaseModel):
    conversation_id: str
    current_level: str # technical | simplified | beginner | analogy | example
    response_type: str # explanation | example | analogy | step_by_step | practice_question
    content: str
    grounded: bool
    sources: List[Dict[str, Any]] = []
    suggested_next_actions: List[str] = []
