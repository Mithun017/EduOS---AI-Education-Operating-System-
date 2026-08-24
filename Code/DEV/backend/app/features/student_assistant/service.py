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

        # 5. Generate AI Adaptive Content
        content, suggested_actions, provider_used = await self._generate_adaptive_response(
            level=new_level,
            rtype=response_type,
            grounded_context=grounded_context,
            topic_id=req.topic_id,
            msg=req.message,
            institution_id=institution_id
        )

        # 6. Save message
        msg = Message(
            conversation_id=conv.id,
            institution_id=institution_id,
            sender="assistant",
            content=content,
            response_mode=ResponseMode.INSTITUTION_GROUNDED if grounded else ResponseMode.GENERAL,
            provider_used=provider_used
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

    async def _generate_adaptive_response(
        self,
        level: str,
        rtype: str,
        grounded_context: str,
        topic_id: str,
        msg: str,
        institution_id: str
    ) -> tuple[str, List[str], str]:
        """Generate dynamic adaptive learning content using LLM provider via AIOrchestrator."""
        topic_title = topic_id.replace("topic-", "").replace("-", " ").title()

        prompt = (
            f"You are EduOS Private Adaptive Tutor. The student is asking about '{msg}' in topic '{topic_title}'.\n"
            f"Understanding Level: {level.upper()}.\n"
            f"Response Type: {rtype.upper()}.\n"
            f"Grounding Material: {grounded_context[:400] if grounded_context else 'General curriculum context'}.\n\n"
            f"Instructions based on level/type:\n"
        )

        if rtype == "practice_question":
            prompt += f"- Generate a difficulty-matched practice question at {level} level with a subtle hint. Do not reveal the full answer immediately."
        elif rtype == "example":
            prompt += f"- Provide a clear, concrete worked example at {level} level illustrating '{msg}'."
        elif level == "technical":
            prompt += "- Provide a standard, mathematically/technically rigorous explanation using precise terminology."
        elif level == "simplified":
            prompt += "- Explain with reduced jargon, clearer breakdown, and intuitive concept steps."
        elif level == "beginner":
            prompt += "- Explain using plain everyday language, zero heavy jargon, and clear foundational concepts."
        else: # analogy
            prompt += "- Explain using a creative, vivid real-world analogy."

        ai_req = AIRequest(
            messages=[AIMessage(role="user", content=msg)],
            system_prompt=prompt,
            institution_id=institution_id,
            max_tokens=500
        )

        generated_text = ""
        provider_used = "nvidia_nim"
        try:
            async for chunk in self.orchestrator.generate_stream(ai_req):
                if chunk.text:
                    generated_text += chunk.text
                if chunk.provider_name:
                    provider_used = chunk.provider_name
        except Exception as e:
            logger.warning(f"AI Student generation fallback: {e}")

        # Determine suggested next actions dynamically based on level
        if rtype == "practice_question":
            actions = ["Explain the answer", "Give me another question", "Explain simpler"]
        elif rtype == "example":
            actions = ["Give me a practice question", "Explain simpler", "Go back to standard"]
        elif level == "technical":
            actions = ["I don't understand", "Give me an example", "Give me a practice question"]
        elif level == "simplified":
            actions = ["Still not understanding", "Give me an example", "Practice question"]
        elif level == "beginner":
            actions = ["Give me an analogy", "Give me an example", "Go back to normal"]
        else:
            actions = ["Give me an example", "Practice question", "Reset to normal"]

        if generated_text.strip():
            # Formatting header depending on level/type
            level_label = rtype.replace("_", " ").capitalize() if rtype in ["practice_question", "example"] else f"{level.capitalize()} Explanation"
            formatted_content = f"**{level_label}**:\n{generated_text.strip()}"
            return (formatted_content, actions, provider_used)

        # Dynamic fallback when AI Orchestrator is unconfigured/offline
        if rtype == "practice_question":
            content = (
                f"**Practice Question ({level.capitalize()} Level)**:\n"
                f"How would you apply the core principles of {msg} to solve a standard problem in {topic_title}?\n\n"
                f"*Hint: Consider the main functional components and their step-by-step interactions.*"
            )
        elif rtype == "example":
            content = (
                f"**Worked Example ({level.capitalize()} Level)**:\n"
                f"Consider a step-by-step application of {msg} in {topic_title}.\n"
                f"Step 1: Input data is prepared.\n"
                f"Step 2: {msg} processes the core features.\n"
                f"Step 3: Output result is produced for evaluation."
            )
        elif level == "technical":
            content = (
                f"**Technical Explanation**:\n"
                f"{grounded_context if grounded_context else f'Core theoretical formulation of {msg} in {topic_title}.'} "
                f"Includes mathematical relationships, structural components, and precise domain terminology."
            )
        elif level == "simplified":
            content = (
                f"**Simplified Explanation**:\n"
                f"Breaking down {msg} into essential concepts for {topic_title}. "
                f"Focuses on key functional steps while reducing complex jargon."
            )
        elif level == "beginner":
            content = (
                f"**Beginner-Friendly Explanation**:\n"
                f"An easy, step-by-step overview of {msg} without complicated technical terms."
            )
        else:
            content = (
                f"**Analogy Mode**:\n"
                f"Think of {msg} in {topic_title} like an everyday system where each component works together to achieve the final outcome."
            )

        return (content, actions, provider_used)

