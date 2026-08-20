from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from enum import Enum

class TriggerResponseType(str, Enum):
    EXPLANATION = "explanation"
    ROADMAP = "roadmap"
    CHART = "chart"
    KEY_POINTS = "key_points"
    RESOURCES = "resources"
    PREVIOUS_QUESTION_CONTEXT = "previous_question_context"
    QUICK_QUESTION = "quick_question"

class TeacherAskRequest(BaseModel):
    topic_id: str = Field(..., description="UUID of active topic")
    message: str = Field(..., description="Teacher query message")
    response_mode_hint: Optional[str] = Field(None, description="institution_grounded | hybrid | general")

# Structured Response Payloads per trigger type (§Feature 1 table)
class ExplanationStructuredPayload(BaseModel):
    summary: str
    real_world_example: str
    key_points: List[str]

class RoadmapNode(BaseModel):
    id: str
    label: str
    order: int

class RoadmapEdge(BaseModel):
    from_node: str = Field(..., alias="from")
    to_node: str = Field(..., alias="to")

class RoadmapStructuredPayload(BaseModel):
    nodes: List[RoadmapNode]
    edges: List[RoadmapEdge]

class ChartStructuredPayload(BaseModel):
    chart_type: str # bar | line | pie
    labels: List[str]
    series: List[Dict[str, Any]]

class KeyPointsStructuredPayload(BaseModel):
    points: List[str]

class ResourceItem(BaseModel):
    title: str
    type: str
    url_or_ref: str

class ResourcesStructuredPayload(BaseModel):
    resources: List[ResourceItem]

class PriorQuestionItem(BaseModel):
    question: str
    answer_summary: str
    date: str

class PreviousQuestionContextPayload(BaseModel):
    prior_questions: List[PriorQuestionItem]

class QuickQuestionStructuredPayload(BaseModel):
    question: str
    expected_answer_hint: str

class TeacherAskResponse(BaseModel):
    conversation_id: str
    response_type: TriggerResponseType
    response_mode: str # institution_grounded | hybrid | general
    grounded_content: Optional[str] = None
    general_content: Optional[str] = None
    sources: List[Dict[str, Any]] = []
    provider_used: str
    structured_data: Dict[str, Any]
