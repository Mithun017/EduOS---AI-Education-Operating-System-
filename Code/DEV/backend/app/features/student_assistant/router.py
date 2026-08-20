import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_role
from app.core.tenant import require_tenant_context
from app.features.student_assistant.schemas import StudentAskRequest, StudentAskResponse
from app.features.student_assistant.service import StudentAssistantService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/student-assistant", tags=["Student Assistant"])

@router.post("/ask", response_model=StudentAskResponse)
async def ask_student_assistant(
    req: StudentAskRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(require_tenant_context),
    token_payload: dict = Depends(require_role(["student", "super_admin"]))
):
    user_id = token_payload["sub"]
    service = StudentAssistantService(session=db)
    result = await service.process_student_query(
        institution_id=tenant_id,
        user_id=user_id,
        req=req
    )
    return result
