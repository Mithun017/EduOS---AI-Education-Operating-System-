from contextvars import ContextVar
from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from app.core.security import get_current_token_payload

_tenant_context: ContextVar[Optional[str]] = ContextVar("current_institution_id", default=None)

def get_current_tenant_id() -> Optional[str]:
    return _tenant_context.get()

def set_current_tenant_id(tenant_id: Optional[str]):
    _tenant_context.set(tenant_id)

async def tenant_middleware(request: Request, call_next):
    # Reset tenant context per request
    token = _tenant_context.set(None)
    try:
        response = await call_next(request)
        return response
    finally:
        _tenant_context.reset(token)

async def require_tenant_context(payload: dict = Depends(get_current_token_payload)) -> str:
    tenant_id = payload.get("institution_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing institution context in authentication token"
        )
    set_current_tenant_id(tenant_id)
    return tenant_id
