import json
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import Conversation, Message, ResponseMode, UserRole
from app.rag.retrieval import retrieve_relevant_chunks
from app.ai.orchestrator import AIOrchestrator
from app.ai.providers.base import AIRequest, AIMessage
from app.features.teacher_assistant.schemas import TeacherAskRequest, TriggerResponseType

logger = logging.getLogger(__name__)

TRIGGER_CATEGORIES = [
    "explanation",
    "roadmap",
    "chart",
    "key_points",
    "resources",
    "previous_question_context",
    "quick_question"
]

class TeacherAssistantService:
    def __init__(self, session: AsyncSession, orchestrator: Optional[AIOrchestrator] = None):
        self.session = session
        self.orchestrator = orchestrator or AIOrchestrator()

    async def classify_teacher_intent(self, message: str) -> TriggerResponseType:
        # Fast intent classification using Groq
        msg_lower = message.lower()
        if "roadmap" in msg_lower or "structure" in msg_lower or "steps" in msg_lower:
            return TriggerResponseType.ROADMAP
        elif "chart" in msg_lower or "graph" in msg_lower or "diagram" in msg_lower:
            return TriggerResponseType.CHART
        elif "key points" in msg_lower or "summary" in msg_lower:
            return TriggerResponseType.KEY_POINTS
        elif "resource" in msg_lower or "reference" in msg_lower or "material" in msg_lower:
            return TriggerResponseType.RESOURCES
        elif "previous" in msg_lower or "prior" in msg_lower or "covered before" in msg_lower:
            return TriggerResponseType.PREVIOUS_QUESTION_CONTEXT
        elif "quick question" in msg_lower or "quiz" in msg_lower or "ask class" in msg_lower:
            return TriggerResponseType.QUICK_QUESTION
        else:
            classified = await self.orchestrator.classify_intent(message, TRIGGER_CATEGORIES)
            try:
                return TriggerResponseType(classified)
            except ValueError:
                return TriggerResponseType.EXPLANATION

    async def process_teacher_query(
        self,
        institution_id: str,
        user_id: str,
        req: TeacherAskRequest
    ) -> Dict[str, Any]:
        # 1. Retrieve RAG chunks (institution & topic scoped)
        chunks = await retrieve_relevant_chunks(
            session=self.session,
            institution_id=institution_id,
            topic_id=req.topic_id,
            query_text=req.message,
            top_k=3
        )

        response_mode = ResponseMode.GENERAL
        grounded_context = ""
        sources = []

        if chunks:
            response_mode = ResponseMode.HYBRID if any(c["score"] > 0 for c in chunks) else ResponseMode.GENERAL
            if response_mode == ResponseMode.HYBRID:
                grounded_context = "\n".join([c["content"] for c in chunks])
                sources = [{"chunk_id": c["chunk_id"], "source_resource_id": c["source_resource_id"]} for c in chunks]

        # 2. Classify response type
        response_type = await self.classify_teacher_intent(req.message)

        # 3. Formulate structured response
        structured_data = self._generate_structured_mock_payload(response_type, req.message, grounded_context)

        # 4. Generate AI summary prose via orchestrator
        system_prompt = (
            f"You are EduOS Teacher Live Assistant. Provide concise, clear classroom assistance for topic {req.topic_id}. "
            f"Response mode: {response_mode.value}. Grounding material: {grounded_context[:500] if grounded_context else 'None'}."
        )
        ai_req = AIRequest(
            messages=[AIMessage(role="user", content=req.message)],
            system_prompt=system_prompt,
            institution_id=institution_id,
            max_tokens=600
        )

        full_prose = ""
        provider_used = "nvidia_nim"
        try:
            async for chunk in self.orchestrator.generate_stream(ai_req):
                if chunk.text:
                    full_prose += chunk.text
                if chunk.provider_name:
                    provider_used = chunk.provider_name
        except Exception as e:
            logger.warning(f"AI Orchestrator generation fallback to grounded response: {e}")
            full_prose = f"Teacher Assistant summary for '{req.message}'. Grounded context applied."

        # 5. Persist Conversation & Message
        conv = Conversation(
            institution_id=institution_id,
            user_id=user_id,
            role=UserRole.TEACHER,
            topic_id=req.topic_id,
            mode="teacher"
        )
        self.session.add(conv)
        await self.session.flush()

        msg = Message(
            conversation_id=conv.id,
            institution_id=institution_id,
            sender="assistant",
            content=full_prose,
            response_mode=response_mode,
            provider_used=provider_used
        )
        self.session.add(msg)
        await self.session.commit()

        return {
            "conversation_id": conv.id,
            "response_type": response_type.value,
            "response_mode": response_mode.value,
            "grounded_content": grounded_context if response_mode == ResponseMode.HYBRID else None,
            "general_content": full_prose,
            "sources": sources,
            "provider_used": provider_used,
            "structured_data": structured_data
        }

    def _generate_structured_mock_payload(self, rtype: TriggerResponseType, msg: str, grounded: str) -> Dict[str, Any]:
        if rtype == TriggerResponseType.EXPLANATION:
            return {
                "summary": grounded[:200] if grounded else "CNN uses sliding filter kernels to extract visual features.",
                "real_world_example": "Like scanning a photo through a small magnifying lens to spot edges first, then faces.",
                "key_points": ["Convolutional Layer", "ReLU Activation", "Pooling Layer", "Fully Connected Layer"]
            }
        elif rtype == TriggerResponseType.ROADMAP:
            return {
                "nodes": [
                    {"id": "n1", "label": "1. Input Image", "order": 1},
                    {"id": "n2", "label": "2. Feature Extraction (Convolution+ReLU)", "order": 2},
                    {"id": "n3", "label": "3. Pooling / Downsampling", "order": 3},
                    {"id": "n4", "label": "4. Classification (Dense+Softmax)", "order": 4}
                ],
                "edges": [
                    {"from": "n1", "to": "n2"},
                    {"from": "n2", "to": "n3"},
                    {"from": "n3", "to": "n4"}
                ]
            }
        elif rtype == TriggerResponseType.CHART:
            return {
                "chart_type": "bar",
                "labels": ["Layer 1 (Conv)", "Layer 2 (Pool)", "Layer 3 (Conv)", "FC Layer"],
                "series": [{"name": "Feature Dimension", "data": [64, 32, 128, 10]}]
            }
        elif rtype == TriggerResponseType.KEY_POINTS:
            return {
                "points": [
                    "Kernels slide across spatial input dimensions.",
                    "Shared weights reduce parameters compared to fully connected networks.",
                    "Max pooling retains prominent activation values while lowering resolution."
                ]
            }
        elif rtype == TriggerResponseType.RESOURCES:
            return {
                "resources": [
                    {"title": "CNN Architecture Notes", "type": "pdf", "url_or_ref": "demo-inst-001/res-001/notes.pdf"},
                    {"title": "Visualizing Convolutions Video", "type": "youtube", "url_or_ref": "https://youtube.com/watch?v=demo"}
                ]
            }
        elif rtype == TriggerResponseType.PREVIOUS_QUESTION_CONTEXT:
            return {
                "prior_questions": [
                    {"question": "What is stride in CNN?", "answer_summary": "Step size of filter sliding.", "date": "2026-08-15"}
                ]
            }
        elif rtype == TriggerResponseType.QUICK_QUESTION:
            return {
                "question": "What is the primary function of a Pooling layer in a CNN?",
                "expected_answer_hint": "To downsample feature maps and reduce spatial dimensions while preserving key features."
            }
        return {"summary": "Default structured payload"}
