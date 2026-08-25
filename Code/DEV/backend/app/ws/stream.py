import time
import uuid
import json
import logging
from typing import Optional, Dict, Any, List
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


class ConnectionMetaData:
    def __init__(self, conn_id: str, websocket: WebSocket, role: str, display_name: str):
        self.conn_id = conn_id
        self.websocket = websocket
        self.role = role
        self.display_name = display_name
        self.msg_timestamps: List[float] = []


class ClassroomRoomManager:
    def __init__(self):
        # rooms[room_id] = { secret_token, room_code, teacher_conn_id, connections: dict[conn_id, ConnectionMetaData], current_canvas_objects: list, seq: int, created_at: float }
        self.rooms: Dict[str, Dict[str, Any]] = {}

    def create_room(self, room_code: Optional[str] = None) -> Dict[str, str]:
        room_id = f"room-{uuid.uuid4().hex[:8]}"
        secret_token = f"sec-{uuid.uuid4().hex[:16]}"
        code = room_code or f"ROOM-{uuid.uuid4().hex[:4].upper()}"
        
        self.rooms[room_id] = {
            "room_id": room_id,
            "room_code": code,
            "secret_token": secret_token,
            "teacher_conn_id": None,
            "connections": {},
            "current_canvas_objects": [],
            "seq": 0,
            "created_at": time.time()
        }
        return {
            "room_id": room_id,
            "room_code": code,
            "secret_token": secret_token
        }

    def resolve_display_name(self, room_id: str, requested_name: str) -> str:
        room = self.rooms.get(room_id)
        if not room:
            return requested_name
            
        existing_names = [conn.display_name for conn in room["connections"].values()]
        if requested_name not in existing_names:
            return requested_name
            
        count = 2
        candidate = f"{requested_name} ({count})"
        while candidate in existing_names:
            count += 1
            candidate = f"{requested_name} ({count})"
        return candidate

    async def broadcast_to_room(self, room_id: str, payload: dict, exclude_conn_id: Optional[str] = None):
        room = self.rooms.get(room_id)
        if not room:
            return

        dead_connections = []
        msg_text = json.dumps(payload)
        
        for conn_id, meta in list(room["connections"].items()):
            if exclude_conn_id and conn_id == exclude_conn_id:
                continue
            try:
                await meta.websocket.send_text(msg_text)
            except Exception:
                dead_connections.append(conn_id)

        for conn_id in dead_connections:
            await self.disconnect(room_id, conn_id)

    async def send_canvas_sync(self, room_id: str, websocket: WebSocket):
        room = self.rooms.get(room_id)
        if not room:
            return
            
        sync_payload = {
            "type": "canvas_sync",
            "canvas_objects": room["current_canvas_objects"],
            "seq": room["seq"]
        }
        try:
            await websocket.send_text(json.dumps(sync_payload))
        except Exception as e:
            logger.warning(f"Error sending canvas_sync: {e}")

    async def broadcast_presence(self, room_id: str):
        room = self.rooms.get(room_id)
        if not room:
            return
            
        students = [
            {"conn_id": conn.conn_id, "display_name": conn.display_name}
            for conn in room["connections"].values()
            if conn.role == "student"
        ]
        presence_payload = {
            "type": "presence_update",
            "room_code": room["room_code"],
            "teacher_connected": room["teacher_conn_id"] is not None,
            "connected_students": students,
            "student_count": len(students)
        }
        await self.broadcast_to_room(room_id, presence_payload)

    def check_rate_limit(self, meta: ConnectionMetaData) -> bool:
        """Rate limit: Max 5 messages per second per connection."""
        now = time.time()
        meta.msg_timestamps = [t for t in meta.msg_timestamps if now - t < 1.0]
        if len(meta.msg_timestamps) >= 5:
            return False
        meta.msg_timestamps.append(now)
        return True

    async def disconnect(self, room_id: str, conn_id: str):
        room = self.rooms.get(room_id)
        if not room or conn_id not in room["connections"]:
            return

        meta = room["connections"].pop(conn_id)
        logger.info(f"Connection {conn_id} ({meta.role}: {meta.display_name}) left room {room_id}")

        if meta.role == "teacher":
            room["teacher_conn_id"] = None
            # Broadcast teacher_disconnected to all remaining students
            await self.broadcast_to_room(room_id, {
                "type": "teacher_disconnected",
                "message": "Teacher disconnected or reloading. Canvas updates paused."
            })
        
        await self.broadcast_presence(room_id)


classroom_manager = ClassroomRoomManager()

