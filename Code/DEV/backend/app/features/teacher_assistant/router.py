import json
import logging
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_role
from app.core.tenant import require_tenant_context
from app.ws.stream import manager
from app.features.teacher_assistant.schemas import TeacherAskRequest, TeacherAskResponse
from app.features.teacher_assistant.service import TeacherAssistantService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/teacher-assistant", tags=["Teacher Assistant"])

@router.post("/ask", response_model=TeacherAskResponse)
async def ask_teacher_assistant(
    req: TeacherAskRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(require_tenant_context),
    token_payload: dict = Depends(require_role(["teacher", "super_admin", "college_admin"]))
):
    user_id = token_payload["sub"]
    service = TeacherAssistantService(session=db)
    result = await service.process_teacher_query(
        institution_id=tenant_id,
        user_id=user_id,
        req=req
    )
    return result

@router.websocket("/ws/{conversation_id}")
async def teacher_assistant_ws(
    websocket: WebSocket,
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Enforce first-frame JWT auth handshake
    auth_payload = await manager.connect_and_authenticate(websocket)
    if not auth_payload:
        return # Connection closed with 4001 by manager

    tenant_id = auth_payload.get("institution_id")
    user_id = auth_payload.get("sub")
    service = TeacherAssistantService(session=db)

    try:
        while True:
            raw_text = await websocket.receive_text()
            data = json.loads(raw_text)

            req = TeacherAskRequest(
                topic_id=data.get("topic_id", "topic-cnn-001"),
                message=data.get("message", "Explain CNN")
            )

            result = await service.process_teacher_query(
                institution_id=tenant_id,
                user_id=user_id,
                req=req
            )

            await websocket.send_text(json.dumps(result))

    except WebSocketDisconnect:
        logger.info(f"Teacher Assistant WS disconnected for conv {conversation_id}")
    except Exception as e:
        logger.error(f"Teacher Assistant WS error: {e}")
        await websocket.close(code=1011, reason="Internal processing error")
