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
