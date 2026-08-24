import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional, List
from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, ForeignKey, Enum, Boolean, Index
)
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from sqlalchemy.types import TypeDecorator

class SafeVector(TypeDecorator):
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            try:
                from pgvector.sqlalchemy import Vector
                return dialect.type_descriptor(Vector(1536))
            except Exception:
                return dialect.type_descriptor(Text)
        return dialect.type_descriptor(Text)

class Base(DeclarativeBase):
    pass

class UserRole(str, PyEnum):
    SUPER_ADMIN = "super_admin"
    COLLEGE_ADMIN = "college_admin"
    HOD = "hod"
    TEACHER = "teacher"
    STUDENT = "student"

class ResponseMode(str, PyEnum):
    INSTITUTION_GROUNDED = "institution_grounded"
    HYBRID = "hybrid"
    GENERAL = "general"

class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    departments: Mapped[List["Department"]] = relationship("Department", back_populates="institution", cascade="all, delete-orphan")
    users: Mapped[List["User"]] = relationship("User", back_populates="institution", cascade="all, delete-orphan")

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    institution: Mapped["Institution"] = relationship("Institution", back_populates="departments")
    programs: Mapped[List["Program"]] = relationship("Program", back_populates="department", cascade="all, delete-orphan")

class Program(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id: Mapped[str] = mapped_column(String, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    department: Mapped["Department"] = relationship("Department", back_populates="programs")
    semesters: Mapped[List["Semester"]] = relationship("Semester", back_populates="program", cascade="all, delete-orphan")

class Semester(Base):
    __tablename__ = "semesters"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    program_id: Mapped[str] = mapped_column(String, ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    program: Mapped["Program"] = relationship("Program", back_populates="semesters")
    subjects: Mapped[List["Subject"]] = relationship("Subject", back_populates="semester", cascade="all, delete-orphan")

class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    semester_id: Mapped[str] = mapped_column(String, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    semester: Mapped["Semester"] = relationship("Semester", back_populates="subjects")
    units: Mapped[List["Unit"]] = relationship("Unit", back_populates="subject", cascade="all, delete-orphan")

class Unit(Base):
    __tablename__ = "units"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    subject: Mapped["Subject"] = relationship("Subject", back_populates="units")
    topics: Mapped[List["Topic"]] = relationship("Topic", back_populates="unit", cascade="all, delete-orphan")

class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id: Mapped[str] = mapped_column(String, ForeignKey("units.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    unit: Mapped["Unit"] = relationship("Unit", back_populates="topics")
    resources: Mapped[List["Resource"]] = relationship("Resource", back_populates="topic", cascade="all, delete-orphan")
    chunks: Mapped[List["KnowledgeChunk"]] = relationship("KnowledgeChunk", back_populates="topic", cascade="all, delete-orphan")

class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id: Mapped[str] = mapped_column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False) # notes, ppt, pdf, question_paper, youtube
    url_or_ref: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    topic: Mapped["Topic"] = relationship("Topic", back_populates="resources")

class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # CRITICAL: direct denormalized institution_id column for instant multi-tenant filtering
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id: Mapped[str] = mapped_column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    source_resource_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("resources.id", ondelete="SET NULL"), nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(SafeVector, nullable=True) # OpenAI / standard 1536 dim embeddings
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    topic: Mapped["Topic"] = relationship("Topic", back_populates="chunks")

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.STUDENT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    institution: Mapped["Institution"] = relationship("Institution", back_populates="users")

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    topic_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True, index=True)
    mode: Mapped[str] = mapped_column(String(50), nullable=False) # teacher | student
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    messages: Mapped[List["Message"]] = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    sender: Mapped[str] = mapped_column(String(50), nullable=False) # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    response_mode: Mapped[Optional[ResponseMode]] = mapped_column(Enum(ResponseMode), nullable=True)
    provider_used: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

class StudentUnderstandingState(Base):
    __tablename__ = "student_understanding_state"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id: Mapped[str] = mapped_column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    current_level: Mapped[str] = mapped_column(String(50), nullable=False, default="technical") # technical, simplified, beginner, analogy, example
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class CanvasSession(Base):
    __tablename__ = "canvas_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id: Mapped[str] = mapped_column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True)
    topic_id: Mapped[str] = mapped_column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    objects: Mapped[List["CanvasObject"]] = relationship("CanvasObject", back_populates="session", cascade="all, delete-orphan")

class CanvasObject(Base):
    __tablename__ = "canvas_objects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    canvas_session_id: Mapped[str] = mapped_column(String, ForeignKey("canvas_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False) # stroke, shape, formula, text
    geometry_json: Mapped[str] = mapped_column(Text, nullable=False) # raw coordinates or shape properties
    style_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # color, thickness, etc.
    recognized_as: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # circle, rectangle, arrow, line, formula
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    session: Mapped["CanvasSession"] = relationship("CanvasSession", back_populates="objects")

