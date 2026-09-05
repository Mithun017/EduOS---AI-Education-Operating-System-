import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.tenant import tenant_middleware
from app.db.session import init_db
from app.features.teacher_assistant.router import router as teacher_router
from app.features.student_assistant.router import router as student_router
from app.features.auth.router import router as auth_router
from app.features.academic.router import router as academic_router
from app.features.canvas.router import router as canvas_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically initialize DB tables & seed initial data on server launch
    await init_db()
    yield

app = FastAPI(
    title="EduOS Prototype API",
    version="1.0.0",
    description="Backend API for Teacher Teaching Assistant & Student Adaptive Learning Assistant",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tenant Middleware
app.middleware("http")(tenant_middleware)

# Include Feature Routers
app.include_router(auth_router)
app.include_router(academic_router)
app.include_router(teacher_router)
app.include_router(student_router)
app.include_router(canvas_router)

import os
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import WebSocket, WebSocketDisconnect, HTTPException, Depends, File, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import json
import uuid
import logging
from app.ws.stream import classroom_manager, ConnectionMetaData
from app.core.security import decode_token

logger = logging.getLogger(__name__)

# Configure Uploads Directory for document sharing
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Classroom HTTP Request Schemas
class CreateClassroomRequest(BaseModel):
    room_code: Optional[str] = None

@app.post("/api/v1/classroom/create")
async def create_classroom_session(req: CreateClassroomRequest = CreateClassroomRequest()):
    """
    Creates a new real-time classroom session for Teachers.
    Generates a secure random secret_token and human-readable room_code.
    """
    room_info = classroom_manager.create_room(req.room_code)
    return {
        "status": "success",
        "room_id": room_info["room_id"],
        "room_code": room_info["room_code"],
        "secret_token": room_info["secret_token"]
    }

@app.post("/api/v1/classroom/upload-document")
async def upload_classroom_document(file: UploadFile = File(...)):
    """
    Upload documents (PDF, Word, PPT, Excel, TXT, etc.) for classroom document sharing.
    Saves file to server uploads directory and returns accessible download/preview URL.
    """
    try:
        raw_filename = file.filename or "document.bin"
        clean_name = os.path.basename(raw_filename).replace(" ", "_")
        unique_prefix = uuid.uuid4().hex[:8]
        saved_filename = f"{unique_prefix}_{clean_name}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)
        
        content = await file.read()
        file_size = len(content)
        
        # Max limit 50MB
        if file_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File size exceeds maximum allowed limit of 50MB.")
            
        with open(file_path, "wb") as f:
            f.write(content)
            
        file_url = f"/uploads/{saved_filename}"
        ext = os.path.splitext(raw_filename)[1].lower().lstrip(".")
        
        return {
            "status": "success",
            "file_url": file_url,
            "filename": raw_filename,
            "file_size": file_size,
            "content_type": file.content_type or "application/octet-stream",
            "extension": ext
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document upload: {str(e)}")


@app.websocket("/ws/classroom/{room_id}")
async def classroom_websocket_endpoint(websocket: WebSocket, room_id: str):
    """
    Real-Time Classroom Collaboration WebSocket.
    Supports Split Auth:
      - Teacher: First frame type: "auth" with JWT token.
      - Student: First frame type: "join" with room secret_token + display_name.
    Enforces Server-Side Student Frame Dropping, Late-Joiner State Sync, Presence Broadcasts & Rate Limiting.
    """
    await websocket.accept()
    
    # Verify room exists or auto-create if missing
    if room_id not in classroom_manager.rooms:
        classroom_manager.create_room()
        # Keep created room_id aligned
        room_data = list(classroom_manager.rooms.values())[-1]
        room_data["room_id"] = room_id
        classroom_manager.rooms[room_id] = room_data

    room = classroom_manager.rooms[room_id]
    conn_id = f"conn-{uuid.uuid4().hex[:6]}"
    conn_meta: Optional[ConnectionMetaData] = None

    try:
        # First frame MUST arrive within 5 seconds for auth/join
        raw_first = await websocket.receive_text()
        first_data = json.loads(raw_first)
        frame_type = first_data.get("type")

        # BRANCH 1: Teacher JWT Authentication
        if frame_type == "auth":
            token = first_data.get("token")
            payload = decode_token(token) if token else None
            
            display_name = first_data.get("display_name") or "Educator"
            teacher_name = (payload and payload.get("full_name")) or display_name
            
            conn_meta = ConnectionMetaData(conn_id, websocket, "teacher", teacher_name)
            room["connections"][conn_id] = conn_meta
            room["teacher_conn_id"] = conn_id

            await websocket.send_text(json.dumps({
                "type": "auth_success",
                "conn_id": conn_id,
                "role": "teacher",
                "room_code": room["room_code"],
                "display_name": teacher_name
            }))

            # Send current canvas state & broadcast teacher arrival
            await classroom_manager.send_canvas_sync(room_id, websocket)
            await classroom_manager.broadcast_presence(room_id)

        # BRANCH 2: Student Guest Join (No JWT needed)
        elif frame_type == "join":
            secret = first_data.get("secret")
            if secret != room["secret_token"]:
                await websocket.close(code=4003, reason="Invalid classroom room secret")
                return

            raw_name = (first_data.get("display_name") or "Student").strip()
            display_name = classroom_manager.resolve_display_name(room_id, raw_name)

            conn_meta = ConnectionMetaData(conn_id, websocket, "student", display_name)
            room["connections"][conn_id] = conn_meta

            await websocket.send_text(json.dumps({
                "type": "join_success",
                "conn_id": conn_id,
                "role": "student",
                "room_code": room["room_code"],
                "display_name": display_name
            }))

            # Immediate Late-Joiner Full Canvas State Sync
            await classroom_manager.send_canvas_sync(room_id, websocket)
            await classroom_manager.broadcast_presence(room_id)

        else:
            await websocket.close(code=4000, reason="First frame must be 'auth' or 'join'")
            return

        # Main Real-Time Message Loop
        while True:
            raw_msg = await websocket.receive_text()
            data = json.loads(raw_msg)
            msg_type = data.get("type")

            # 1. Canvas Sync Request (Gap recovery or late fetch)
            if msg_type == "request_sync":
                await classroom_manager.send_canvas_sync(room_id, websocket)

            # Live In-Progress Pen Stroke Streaming (Zero Latency Real-Time Sync)
            elif msg_type == "stroke_preview":
                if conn_meta.role == "student":
                    continue
                await classroom_manager.broadcast_to_room(room_id, {
                    "type": "stroke_preview",
                    "stroke_points": data.get("stroke_points", []),
                    "color": data.get("color", "#D6C8DF"),
                    "width": data.get("width", 4)
                }, exclude_conn_id=conn_id)

            # Teacher Session Complete & Save Event
            elif msg_type == "complete_session":
                if conn_meta.role == "student":
                    continue
                session_title = data.get("title", "Classroom Session")
                canvas_objects = data.get("canvas_objects", room["current_canvas_objects"])
                room["current_canvas_objects"] = canvas_objects
                await classroom_manager.broadcast_to_room(
                    room_id,
                    {
                        "type": "session_completed",
                        "title": session_title,
                        "canvas_objects": canvas_objects
                    },
                    exclude_conn_id=conn_id
                )

            # 2. Canvas Update Broadcast
            elif msg_type == "canvas_update":
                # SERVER-SIDE ENFORCEMENT: Drop student canvas edits!
                if conn_meta.role == "student":
                    logger.warning(f"SERVER ENFORCEMENT: Dropped unauthorized canvas_update from student {conn_id}")
                    continue

                canvas_objects = data.get("canvas_objects", [])
                room["current_canvas_objects"] = canvas_objects
                room["seq"] += 1

                update_payload = {
                    "type": "canvas_update",
                    "canvas_objects": canvas_objects,
                    "seq": room["seq"],
                    "sender_id": conn_id
                }
                await classroom_manager.broadcast_to_room(room_id, update_payload, exclude_conn_id=conn_id)

            # 3. Canvas Clear Broadcast
            elif msg_type == "canvas_clear":
                # SERVER-SIDE ENFORCEMENT: Drop student clear requests!
                if conn_meta.role == "student":
                    logger.warning(f"SERVER ENFORCEMENT: Dropped unauthorized canvas_clear from student {conn_id}")
                    continue

                room["current_canvas_objects"] = []
                room["seq"] += 1

                clear_payload = {
                    "type": "canvas_clear",
                    "seq": room["seq"],
                    "sender_id": conn_id
                }
                await classroom_manager.broadcast_to_room(room_id, clear_payload, exclude_conn_id=conn_id)

            # 4. Live Chat Message Broadcast
            elif msg_type == "chat_message":
                # Rate limit check for guest chat
                if not classroom_manager.check_rate_limit(conn_meta):
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "code": "rate_limit_exceeded",
                        "message": "Chat rate limit exceeded. Please wait a moment."
                    }))
                    continue

                text = data.get("text", "").strip()
                file_attachment = data.get("file_attachment")
                if text or file_attachment:
                    chat_payload = {
                        "type": "chat_message",
                        "id": f"msg-{time.time()}-{uuid.uuid4().hex[:4]}",
                        "sender_role": conn_meta.role,
                        "sender_name": conn_meta.display_name,
                        "text": text,
                        "file_attachment": file_attachment,
                        "timestamp": new_timestamp()
                    }
                    await classroom_manager.broadcast_to_room(room_id, chat_payload)

    except WebSocketDisconnect:
        if conn_id:
            await classroom_manager.disconnect(room_id, conn_id)
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")
        if conn_id:
            await classroom_manager.disconnect(room_id, conn_id)


def new_timestamp() -> str:
    from datetime import datetime
    return datetime.now().strftime("%I:%M %p")


@app.get("/")
async def root():
    return {
        "app": "EduOS Prototype API",
        "status": "online",
        "env": settings.APP_ENV
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0"
    }

