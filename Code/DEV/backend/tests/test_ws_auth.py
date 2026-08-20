import pytest
import pytest_asyncio
import json
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.db.session import get_db
from app.db.models import Base, Institution, User, UserRole, Topic
from app.core.security import create_access_token
from app.features.teacher_assistant.router import router as teacher_router

app.include_router(teacher_router)

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(autouse=True)
def override_db_dependency():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
    import asyncio
    asyncio.run(init_db())

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def _get_test_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()

client = TestClient(app)

def test_ws_unauthenticated_connection_closed_4001():
    """
    Attempting to open the WebSocket and sending a non-auth frame or raw text first
    MUST immediately close the connection with code 4001 and send ZERO stream data.
    """
    with client.websocket_connect("/api/v1/teacher-assistant/ws/conv-test-123") as websocket:
        websocket.send_text(json.dumps({"type": "chat", "message": "Hello without token"}))

        data = websocket.receive()
        assert data["type"] == "websocket.close"
        assert data["code"] == 4001

def test_ws_invalid_token_closed_4001():
    with client.websocket_connect("/api/v1/teacher-assistant/ws/conv-test-123") as websocket:
        websocket.send_text(json.dumps({"type": "auth", "token": "invalid_jwt_token"}))

        data = websocket.receive()
        assert data["type"] == "websocket.close"
        assert data["code"] == 4001

def test_ws_valid_auth_frame_accepted():
    token = create_access_token({"sub": "user_teacher_1", "institution_id": "inst_demo", "role": "teacher"})
    with client.websocket_connect("/api/v1/teacher-assistant/ws/conv-test-123") as websocket:
        # Send valid first-frame auth
        websocket.send_text(json.dumps({"type": "auth", "token": token}))

        # Query after successful auth
        websocket.send_text(json.dumps({"topic_id": "topic-cnn-001", "message": "Show me a roadmap"}))
        response = websocket.receive_text()
        res_json = json.loads(response)

        assert "response_type" in res_json
        assert res_json["response_type"] in ["roadmap", "explanation"]
