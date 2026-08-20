import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.models import Conversation, Message, StudentUnderstandingState, UserRole, ResponseMode
from app.rag.retrieval import retrieve_relevant_chunks
from app.ai.orchestrator import AIOrchestrator
from app.ai.providers.base import AIRequest, AIMessage
from app.features.student_assistant.schemas import StudentAskRequest

logger = logging.getLogger(__name__)

SIMPLIFY_TRIGGER_PHRASES = [
    "don't understand", "dont understand", "confused", "still lost", "hard to understand",
    "still not understanding", "explain simpler", "simpler", "beginner", "like i'm 5", "eli5"
]

EXAMPLE_TRIGGER_PHRASES = ["example", "give me an example", "show an example", "worked example"]
PRACTICE_TRIGGER_PHRASES = ["practice question", "quiz me", "test me", "question"]
RESET_TRIGGER_PHRASES = ["reset", "go back to normal", "technical version", "standard explanation"]

LEVEL_ORDER = ["technical", "simplified", "beginner", "analogy"]

class StudentAssistantService:
    def __init__(self, session: AsyncSession, orchestrator: Optional[AIOrchestrator] = None):
        self.session = session
        self.orchestrator = orchestrator or AIOrchestrator()

    def _determine_next_level(self, current_level: str, msg: str) -> tuple[str, str]:
        """
        State machine transitioning explanation level.
        Only simplifies on explicit signals.
        Returns: (new_level, response_type)
        """
        msg_lower = msg.lower()

        # Reset signal
        if any(phrase in msg_lower for phrase in RESET_TRIGGER_PHRASES):
            return ("technical", "explanation")

        # Example branch (does not change level, attaches to current level)
        if any(phrase in msg_lower for phrase in EXAMPLE_TRIGGER_PHRASES):
            return (current_level, "example")

        # Practice question branch
        if any(phrase in msg_lower for phrase in PRACTICE_TRIGGER_PHRASES):
            return (current_level, "practice_question")

        # Simplify triggers
        if any(phrase in msg_lower for phrase in SIMPLIFY_TRIGGER_PHRASES):
            if current_level == "technical":
                return ("simplified", "explanation")
            elif current_level == "simplified":
                return ("beginner", "explanation")
            elif current_level == "beginner":
                return ("analogy", "analogy")
            else:
                return ("analogy", "analogy")

        return (current_level, "explanation")

    async def process_student_query(
        self,
        institution_id: str,
        user_id: str,
        req: StudentAskRequest
    ) -> Dict[str, Any]:
        # 1. Privacy Check & Conversation retrieval
        conv = None
        if req.conversation_id:
            stmt = select(Conversation).where(
                and_(
                    Conversation.id == req.conversation_id,
                    Conversation.institution_id == institution_id,
                    Conversation.user_id == user_id,
                    Conversation.role == UserRole.STUDENT
                )
            )
            res = await self.session.execute(stmt)
            conv = res.scalar_one_or_none()

        if not conv:
            conv = Conversation(
                institution_id=institution_id,
                user_id=user_id,
                role=UserRole.STUDENT,
                topic_id=req.topic_id,
                mode="student"
            )
            self.session.add(conv)
            await self.session.flush()

        # 2. Get/Create Student Understanding State
        stmt_state = select(StudentUnderstandingState).where(
            and_(
                StudentUnderstandingState.conversation_id == conv.id,
                StudentUnderstandingState.institution_id == institution_id,
                StudentUnderstandingState.topic_id == req.topic_id
            )
        )
        res_state = await self.session.execute(stmt_state)
        state_record = res_state.scalar_one_or_none()

        current_level = state_record.current_level if state_record else "technical"

        # 3. Transition level state
        new_level, response_type = self._determine_next_level(current_level, req.message)

        if not state_record:
            state_record = StudentUnderstandingState(
                conversation_id=conv.id,
                institution_id=institution_id,
                topic_id=req.topic_id,
                current_level=new_level
            )
            self.session.add(state_record)
        else:
            state_record.current_level = new_level

        # 4. RAG Retrieval (Institution + Topic scoped)
        chunks = await retrieve_relevant_chunks(
            session=self.session,
            institution_id=institution_id,
            topic_id=req.topic_id,
            query_text=req.message,
            top_k=3
        )

        grounded = len(chunks) > 0
        grounded_context = "\n".join([c["content"] for c in chunks]) if grounded else ""
        sources = [{"chunk_id": c["chunk_id"], "source_resource_id": c["source_resource_id"]} for c in chunks] if grounded else []

        # 5. Generate Adaptive Content
        content, suggested_actions = self._generate_adaptive_response(
            level=new_level,
            rtype=response_type,
            grounded_context=grounded_context,
            topic_id=req.topic_id
        )

        # 6. Save message
        msg = Message(
            conversation_id=conv.id,
            institution_id=institution_id,
            sender="assistant",
            content=content,
            response_mode=ResponseMode.INSTITUTION_GROUNDED if grounded else ResponseMode.GENERAL,
            provider_used="nvidia_nim"
        )
        self.session.add(msg)
        await self.session.commit()

        return {
            "conversation_id": conv.id,
            "current_level": new_level,
            "response_type": response_type,
            "content": content,
            "grounded": grounded,
            "sources": sources,
            "suggested_next_actions": suggested_actions
        }

    def _generate_adaptive_response(self, level: str, rtype: str, grounded_context: str, topic_id: str) -> tuple[str, List[str]]:
        if rtype == "practice_question":
            content = (
                f"**Practice Question ({level.capitalize()} Level)**:\n"
                f"How does a Convolutional Layer differ from a standard Fully Connected layer when processing spatial image features?\n\n"
                f"*Hint: Think about local sliding kernels vs overall matrix multiplication.*"
            )
            actions = ["Explain the answer", "Give me another question", "Explain simpler"]
            return (content, actions)

        if rtype == "example":
            content = (
                f"**Worked Example ({level.capitalize()} Level)**:\n"
                f"Imagine an 8x8 grid of pixels representing a simple black-and-white image of a letter 'T'. "
                f"A 3x3 horizontal edge detection kernel slides across the grid. When it passes over the top horizontal bar of the 'T', "
                f"it outputs high values (activating the feature map), pinpointing the horizontal line."
            )
            actions = ["Give me a practice question", "Explain simpler", "Go back to standard"]
            return (content, actions)

        if level == "technical":
            content = (
                f"**Technical Explanation**:\n"
                f"{grounded_context if grounded_context else 'CNNs process grid-structured data using spatial convolution kernels.'} "
                f"Key mathematical steps involve weight sharing across receptive fields, ReLU non-linear activation, and pooling matrix downsampling."
            )
            actions = ["I don't understand", "Give me an example", "Give me a practice question"]
        elif level == "simplified":
            content = (
                f"**Simplified Explanation**:\n"
                f"Think of a CNN as an automatic feature extractor. Instead of looking at every pixel at once, "
                f"it breaks the image into tiny square patches using small moving filters to spot lines and corners."
            )
            actions = ["Still not understanding", "Give me an example", "Practice question"]
        elif level == "beginner":
            content = (
                f"**Beginner-Friendly Explanation**:\n"
                f"Imagine inspecting a photo through a tiny cutout window sliding row by row. "
                f"First, you spot edges. Then you combine edges to see shapes like circles. Finally, you combine shapes to recognize a face or dog."
            )
            actions = ["Give me an analogy", "Give me an example", "Go back to normal"]
        else: # analogy
            content = (
                f"**Analogy Mode**:\n"
                f"A CNN works like a detective solving a puzzle using a magnifying glass. "
                f"The detective first finds small clues (fingerprints/lines), puts clues together into evidence (footprints/patterns), "
                f"and finally identifies the suspect (full object classification)."
            )
            actions = ["Give me an example", "Practice question", "Reset to normal"]

        return (content, actions)
