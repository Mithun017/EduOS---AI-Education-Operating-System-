import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.db.models import Base, Institution, User, UserRole, Topic, KnowledgeChunk
from app.features.student_assistant.schemas import StudentAskRequest
from app.features.student_assistant.service import StudentAssistantService

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def student_test_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        inst = Institution(id="inst_demo", name="Demo Inst")
        student_a = User(id="user_a", institution_id="inst_demo", email="a@student.com", hashed_password="pw", full_name="Student A", role=UserRole.STUDENT)
        student_b = User(id="user_b", institution_id="inst_demo", email="b@student.com", hashed_password="pw", full_name="Student B", role=UserRole.STUDENT)
        topic_cnn = Topic(id="topic-cnn-001", institution_id="inst_demo", unit_id="u1", name="CNN")
        chunk = KnowledgeChunk(id="c1", institution_id="inst_demo", topic_id="topic-cnn-001", content="CNN visual features")

        session.add_all([inst, student_a, student_b, topic_cnn, chunk])
        await session.commit()
        yield session

    await engine.dispose()

@pytest.mark.asyncio
async def test_full_student_adaptive_escalation_sequence(student_test_session: AsyncSession):
    service = StudentAssistantService(session=student_test_session)

    # Step 1: Initial question -> technical level
    req1 = StudentAskRequest(topic_id="topic-cnn-001", message="Explain CNN")
    res1 = await service.process_student_query("inst_demo", "user_a", req1)
    
    conv_id = res1["conversation_id"]
    assert res1["current_level"] == "technical"
    assert res1["response_type"] == "explanation"

    # Step 2: "I don't understand" -> simplified level
    req2 = StudentAskRequest(topic_id="topic-cnn-001", conversation_id=conv_id, message="I don't understand CNN")
    res2 = await service.process_student_query("inst_demo", "user_a", req2)
    assert res2["current_level"] == "simplified"
    assert "Simplified" in res2["content"]

    # Step 3: "still not understanding" -> beginner level
    req3 = StudentAskRequest(topic_id="topic-cnn-001", conversation_id=conv_id, message="still not understanding")
    res3 = await service.process_student_query("inst_demo", "user_a", req3)
    assert res3["current_level"] == "beginner"
    assert "Beginner" in res3["content"]

    # Step 4: "give me an example" -> worked example at current level
    req4 = StudentAskRequest(topic_id="topic-cnn-001", conversation_id=conv_id, message="give me an example")
    res4 = await service.process_student_query("inst_demo", "user_a", req4)
    assert res4["current_level"] == "beginner"
    assert res4["response_type"] == "example"
    assert "Worked Example" in res4["content"]

    # Step 5: "give me a practice question" -> practice question
    req5 = StudentAskRequest(topic_id="topic-cnn-001", conversation_id=conv_id, message="give me a practice question")
    res5 = await service.process_student_query("inst_demo", "user_a", req5)
    assert res5["response_type"] == "practice_question"
    assert "Practice Question" in res5["content"]

@pytest.mark.asyncio
async def test_student_privacy_isolation(student_test_session: AsyncSession):
    service = StudentAssistantService(session=student_test_session)

    # Student A starts private session
    req_a = StudentAskRequest(topic_id="topic-cnn-001", message="Private question for Student A")
    res_a = await service.process_student_query("inst_demo", "user_a", req_a)
    conv_a_id = res_a["conversation_id"]

    # Student B attempts asking using Student A's conversation_id
    req_b = StudentAskRequest(topic_id="topic-cnn-001", conversation_id=conv_a_id, message="Student B attempt")
    res_b = await service.process_student_query("inst_demo", "user_b", req_b)

    # System MUST generate a new private conversation_id for Student B
    assert res_b["conversation_id"] != conv_a_id
