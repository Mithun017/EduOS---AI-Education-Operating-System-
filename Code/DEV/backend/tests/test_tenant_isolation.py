import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.db.models import Base, Institution, User, UserRole, Topic, KnowledgeChunk, Conversation
from app.core.security import create_access_token, decode_token

# Use in-memory SQLite for testing tenant isolation queries
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def test_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        # Seed Inst A
        inst_a = Institution(id="inst_a", name="Institution A")
        user_a = User(id="user_a", institution_id="inst_a", email="a@test.com", hashed_password="hash", full_name="User A", role=UserRole.TEACHER)
        topic_a = Topic(id="topic_a", institution_id="inst_a", unit_id="unit_a", name="Topic A")
        chunk_a = KnowledgeChunk(id="chunk_a", institution_id="inst_a", topic_id="topic_a", content="Private content for Inst A")
        conv_a = Conversation(id="conv_a", institution_id="inst_a", user_id="user_a", role=UserRole.TEACHER, mode="teacher")

        # Seed Inst B
        inst_b = Institution(id="inst_b", name="Institution B")
        user_b = User(id="user_b", institution_id="inst_b", email="b@test.com", hashed_password="hash", full_name="User B", role=UserRole.TEACHER)
        topic_b = Topic(id="topic_b", institution_id="inst_b", unit_id="unit_b", name="Topic B")
        chunk_b = KnowledgeChunk(id="chunk_b", institution_id="inst_b", topic_id="topic_b", content="Private content for Inst B")
        conv_b = Conversation(id="conv_b", institution_id="inst_b", user_id="user_b", role=UserRole.TEACHER, mode="teacher")

        session.add_all([inst_a, user_a, topic_a, chunk_a, conv_a, inst_b, user_b, topic_b, chunk_b, conv_b])
        await session.commit()

        yield session

    await engine.dispose()

@pytest.mark.asyncio
async def test_tenant_isolation_token_payload():
    token_a = create_access_token({"sub": "user_a", "institution_id": "inst_a", "role": "teacher"})
    token_b = create_access_token({"sub": "user_b", "institution_id": "inst_b", "role": "teacher"})

    payload_a = decode_token(token_a)
    payload_b = decode_token(token_b)

    assert payload_a["institution_id"] == "inst_a"
    assert payload_b["institution_id"] == "inst_b"
    assert payload_a["institution_id"] != payload_b["institution_id"]

@pytest.mark.asyncio
async def test_tenant_query_isolation(test_session: AsyncSession):
    # Query chunks for Inst A context
    tenant_a_id = "inst_a"
    query_a = select(KnowledgeChunk).where(KnowledgeChunk.institution_id == tenant_a_id)
    result_a = await test_session.execute(query_a)
    chunks_a = result_a.scalars().all()

    # Assert Inst A user sees chunk A and ONLY chunk A
    assert len(chunks_a) == 1
    assert chunks_a[0].id == "chunk_a"
    assert chunks_a[0].content == "Private content for Inst A"
    assert "chunk_b" not in [c.id for c in chunks_a]

    # Query chunks for Inst B context
    tenant_b_id = "inst_b"
    query_b = select(KnowledgeChunk).where(KnowledgeChunk.institution_id == tenant_b_id)
    result_b = await test_session.execute(query_b)
    chunks_b = result_b.scalars().all()

    # Assert Inst B user sees chunk B and ONLY chunk B
    assert len(chunks_b) == 1
    assert chunks_b[0].id == "chunk_b"
    assert "chunk_a" not in [c.id for c in chunks_b]

@pytest.mark.asyncio
async def test_conversation_tenant_isolation(test_session: AsyncSession):
    # User A tries to query conversations filtering by Inst A
    stmt_a = select(Conversation).where(
        Conversation.institution_id == "inst_a",
        Conversation.user_id == "user_a"
    )
    res_a = await test_session.execute(stmt_a)
    convs_a = res_a.scalars().all()

    assert len(convs_a) == 1
    assert convs_a[0].id == "conv_a"

    # Verify Inst A query NEVER returns conv_b
    stmt_cross = select(Conversation).where(
        Conversation.institution_id == "inst_a",
        Conversation.id == "conv_b"
    )
    res_cross = await test_session.execute(stmt_cross)
    assert res_cross.scalar_one_or_none() is None
