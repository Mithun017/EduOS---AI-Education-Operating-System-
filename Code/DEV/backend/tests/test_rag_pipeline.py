import pytest
import pytest_asyncio
from fastapi import UploadFile, HTTPException
from starlette.datastructures import Headers
from io import BytesIO
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.rag.ingestion import validate_upload_file, build_tenant_s3_key, FileValidationError
from app.rag.retrieval import retrieve_relevant_chunks
from app.db.models import Base, KnowledgeChunk, Topic

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.mark.asyncio
async def test_file_validation_mime_type_rejection():
    # Attempt uploading an unallowed python file
    headers = Headers({"content-type": "application/x-python"})
    fake_file = UploadFile(filename="script.py", file=BytesIO(b"print('hello')"), headers=headers)

    with pytest.raises(HTTPException) as exc_info:
        validate_upload_file(fake_file, b"print('hello')")
    
    assert exc_info.value.status_code == 415

@pytest.mark.asyncio
async def test_file_validation_oversized_rejection():
    headers = Headers({"content-type": "application/pdf"})
    fake_file = UploadFile(filename="huge.pdf", file=BytesIO(b"0" * (51 * 1024 * 1024)), headers=headers)

    with pytest.raises(HTTPException) as exc_info:
        validate_upload_file(fake_file, b"0" * (51 * 1024 * 1024))

    assert exc_info.value.status_code == 413

@pytest.mark.asyncio
async def test_tenant_s3_key_formatting():
    key = build_tenant_s3_key("inst-demo-123", "res-notes-456", "CNN lecture notes.pdf")
    assert key == "inst-demo-123/res-notes-456/CNN_lecture_notes.pdf"
    assert key.startswith("inst-demo-123/")

@pytest_asyncio.fixture
async def rag_test_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        topic_cnn = Topic(id="topic_cnn", institution_id="inst_1", unit_id="unit_1", name="CNN")
        chunk_1 = KnowledgeChunk(
            id="c1",
            institution_id="inst_1",
            topic_id="topic_cnn",
            content="Convolutional Neural Networks use convolution filters to extract image features."
        )
        chunk_2 = KnowledgeChunk(
            id="c2",
            institution_id="inst_1",
            topic_id="topic_cnn",
            content="Pooling layers downsample feature maps in CNN architectures."
        )
        session.add_all([topic_cnn, chunk_1, chunk_2])
        await session.commit()
        yield session

    await engine.dispose()

@pytest.mark.asyncio
async def test_retrieval_scoped(rag_test_session: AsyncSession):
    chunks = await retrieve_relevant_chunks(
        session=rag_test_session,
        institution_id="inst_1",
        topic_id="topic_cnn",
        query_text="Explain convolution filters",
        top_k=2
    )

    assert len(chunks) == 2
    assert "Convolutional" in chunks[0]["content"]

    # Query wrong institution ID -> 0 chunks returned (no leak)
    empty_chunks = await retrieve_relevant_chunks(
        session=rag_test_session,
        institution_id="inst_2",
        topic_id="topic_cnn",
        query_text="Explain convolution filters"
    )
    assert len(empty_chunks) == 0
