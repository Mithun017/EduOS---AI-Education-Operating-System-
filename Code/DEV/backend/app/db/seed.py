import asyncio
import logging
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, engine
from app.db.models import (
    Base, Institution, Department, Program, Semester, Subject, Unit, Topic, Resource, KnowledgeChunk, User, UserRole
)
from app.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_data():
    async with engine.begin() as conn:
        # Create vector extension if postgres, create tables
        try:
            await conn.run_sync(Base.metadata.create_all)
        except Exception as e:
            logger.warning(f"Metadata create_all notice: {e}")

    async with AsyncSessionLocal() as session:
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
            full_name="Prof. Sarah Jenkins",
            role=UserRole.TEACHER
        )

        student = User(
            id="user-student-001",
            institution_id=inst.id,
            email="student@demo.eduos.ai",
            hashed_password=password_hash,
            full_name="Alex Chen",
            role=UserRole.STUDENT
        )

        session.add_all([super_admin, teacher, student])

        # 3. Academic Hierarchy
        dept = Department(
            id="dept-cs-001",
            institution_id=inst.id,
            name="Computer Science & Engineering"
        )
        session.add(dept)

        prog = Program(
            id="prog-ai-001",
            institution_id=inst.id,
            department_id=dept.id,
            name="B.Tech Artificial Intelligence"
        )
        session.add(prog)

        sem = Semester(
            id="sem-6-001",
            institution_id=inst.id,
            program_id=prog.id,
            number=6
        )
        session.add(sem)

        subject = Subject(
            id="subj-dl-001",
            institution_id=inst.id,
            semester_id=sem.id,
            name="Deep Learning & Neural Networks",
            code="CS601DL"
        )
        session.add(subject)

        unit = Unit(
            id="unit-3-001",
            institution_id=inst.id,
            subject_id=subject.id,
            unit_number=3,
            name="Computer Vision & Spatial Networks"
        )
        session.add(unit)

        topic = Topic(
            id="topic-cnn-001",
            institution_id=inst.id,
            unit_id=unit.id,
            name="Convolutional Neural Networks (CNN)",
            description="Architecture, kernels, feature maps, pooling layers, and image classification."
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
