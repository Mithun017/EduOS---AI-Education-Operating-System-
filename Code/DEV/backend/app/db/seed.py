import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from app.db.session import AsyncSessionLocal, engine
from app.db.models import (
    Base, Institution, Department, Program, Semester, Subject, Unit, Topic, Resource, KnowledgeChunk, User, UserRole
)
from app.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_data():
    local_engine = engine
    try:
        async with local_engine.begin() as conn:
            if local_engine.dialect.name == "postgresql":
                from sqlalchemy import text
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.warning(f"PostgreSQL pgvector notice: {e}. Falling back to SQLite local dev database.")
        from sqlalchemy.ext.asyncio import create_async_engine
        local_engine = create_async_engine("sqlite+aiosqlite:///./eduos.db", echo=False)
        async with local_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=local_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        # Check if demo institution already exists
        result = await session.execute(select(Institution).where(Institution.id == "demo-inst-001"))
        existing_inst = result.scalar_one_or_none()

        if existing_inst:
            logger.info("Database already seeded with demo institution.")
            return

        logger.info("Seeding initial data for EduOS Prototype...")

        # 1. Institution
        inst = Institution(
            id="demo-inst-001",
            name="EduOS Demo College"
        )
        session.add(inst)

        # 2. Users
        password_hash = get_password_hash("password123")
        
        super_admin = User(
            id="user-superadmin-001",
            institution_id=inst.id,
            email="admin@demo.eduos.ai",
            hashed_password=password_hash,
            full_name="Dr. Aris Thorne (Super Admin)",
            role=UserRole.SUPER_ADMIN
        )
        
        teacher = User(
            id="user-teacher-001",
            institution_id=inst.id,
            email="teacher@demo.eduos.ai",
            hashed_password=password_hash,
            full_name="Course Instructor",
            role=UserRole.TEACHER
        )

        student = User(
            id="user-student-001",
            institution_id=inst.id,
            email="student@demo.eduos.ai",
            hashed_password=password_hash,
            full_name="Enrolled Student",
            role=UserRole.STUDENT
        )

        session.add_all([super_admin, teacher, student])

        # 3. Academic Hierarchy
        dept = Department(
            id="dept-cs-001",
            institution_id=inst.id,
            name="General Academic Department"
        )
        session.add(dept)

        prog = Program(
            id="prog-ai-001",
            institution_id=inst.id,
            department_id=dept.id,
            name="Academic Program"
        )
        session.add(prog)

        sem = Semester(
            id="sem-6-001",
            institution_id=inst.id,
            program_id=prog.id,
            number=1
        )
        session.add(sem)

        subject = Subject(
            id="subj-001",
            institution_id=inst.id,
            semester_id=sem.id,
            name="Foundational Academic Course",
            code="EDU101"
        )
        session.add(subject)

        unit = Unit(
            id="unit-001",
            institution_id=inst.id,
            subject_id=subject.id,
            unit_number=1,
            name="Unit 1: Core Principles"
        )
        session.add(unit)

        topic = Topic(
            id="topic-core-001",
            institution_id=inst.id,
            unit_id=unit.id,
            name="Core Academic Principles",
            description="Foundational principles, methodologies, and practical applications."
        )
        session.add(topic)

        # 4. Demo Resource & Placeholder Knowledge Chunks for CNN
        res = Resource(
            id="res-cnn-notes-001",
            institution_id=inst.id,
            topic_id=topic.id,
            title="Module 3: CNN Fundamentals & Feature Extraction",
            type="notes",
            url_or_ref=f"{inst.id}/res-cnn-notes-001/cnn_fundamentals.pdf"
        )
        session.add(res)

        chunk1 = KnowledgeChunk(
            id="chunk-cnn-001",
            institution_id=inst.id,
            topic_id=topic.id,
            source_resource_id=res.id,
            content=(
                "A Convolutional Neural Network (CNN) is a class of deep neural networks commonly applied to analyzing visual imagery. "
                "Instead of matrix multiplication in fully connected layers, CNNs use convolution operations to extract local spatial features "
                "such as edges, textures, and object components using sliding filters or kernels."
            )
        )

        chunk2 = KnowledgeChunk(
            id="chunk-cnn-002",
            institution_id=inst.id,
            topic_id=topic.id,
            source_resource_id=res.id,
            content=(
                "Key building blocks of a CNN architecture include: "
                "1. Convolutional Layer: Applies kernels over the input image to generate feature maps. "
                "2. Activation Function (ReLU): Introduces non-linearity. "
                "3. Pooling Layer (Max/Average Pooling): Reduces spatial dimensions (downsampling) while preserving critical features. "
                "4. Fully Connected (FC) Layer: Flattened feature maps pass to final classification layers (e.g. Softmax)."
            )
        )

        chunk3 = KnowledgeChunk(
            id="chunk-cnn-003",
            institution_id=inst.id,
            topic_id=topic.id,
            source_resource_id=res.id,
            content=(
                "Real-World Analogy for CNN: Imagine looking through a small magnifying glass and sliding it across a large photo piece by piece. "
                "First, you notice sharp edges (low-level features). As you combine small pieces, you recognize shapes like eyes or wheels (mid-level features). "
                "Finally, combining all pieces lets you identify the full picture as a face or car (high-level object classification)."
            )
        )

        session.add_all([chunk1, chunk2, chunk3])

        await session.commit()
        logger.info("Successfully seeded EduOS demo institution, users, and CNN topic hierarchy!")

if __name__ == "__main__":
    asyncio.run(seed_data())
