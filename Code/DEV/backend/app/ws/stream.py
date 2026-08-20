import json
import logging
from typing import Optional, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect, status
from app.core.security import decode_token

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect_and_authenticate(self, websocket: WebSocket) -> Optional[dict]:
        """
        Enforces first-frame WebSocket JWT authentication.
        Token is NEVER passed as a query string parameter (?token=...) to avoid log leaking.
        Connection is accepted, but closed immediately with code 4001 if first frame isn't valid auth.
        """
        await websocket.accept()
        try:
            # First frame MUST arrive within 5 seconds
            raw_msg = await websocket.receive_text()
            data = json.loads(raw_msg)
            
            if data.get("type") != "auth" or not data.get("token"):
                logger.warning("WebSocket auth failed: First message is not an auth frame")
                await websocket.close(code=4001, reason="Authentication required in first message frame")
                return None
            
            payload = decode_token(data["token"])
            user_id = payload.get("sub")
            institution_id = payload.get("institution_id")
            
            if not user_id or not institution_id:
                logger.warning("WebSocket auth failed: Invalid token payload")
                await websocket.close(code=4001, reason="Invalid authentication token payload")
                return None
                
            return payload

        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"WebSocket auth exception: {e}")
            await websocket.close(code=4001, reason="Authentication error")
            return None

manager = ConnectionManager()
