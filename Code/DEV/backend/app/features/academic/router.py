from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.db.session import get_db
from app.db.models import Subject, Unit, Topic
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/academic", tags=["Academic Context"])

class TopicSchema(BaseModel):
    id: str
    name: str
    description: str | None

class UnitSchema(BaseModel):
    id: str
    name: str
    unit_number: int
    topics: List[TopicSchema]

class SubjectSchema(BaseModel):
    id: str
    name: str
    code: str
    units: List[UnitSchema]

@router.get("/context", response_model=List[SubjectSchema])
async def get_academic_context(db: AsyncSession = Depends(get_db)):
    # Simple query to build hierarchy
    subj_stmt = select(Subject)
    res = await db.execute(subj_stmt)
    subjects = res.scalars().all()
    
    result = []
    for sub in subjects:
        # Load units
        unit_stmt = select(Unit).where(Unit.subject_id == sub.id)
        u_res = await db.execute(unit_stmt)
        units = u_res.scalars().all()
        
        unit_list = []
        for u in units:
            # Load topics
            topic_stmt = select(Topic).where(Topic.unit_id == u.id)
            t_res = await db.execute(topic_stmt)
            topics = t_res.scalars().all()
            
            topic_list = [
                TopicSchema(id=t.id, name=t.name, description=t.description)
                for t in topics
            ]
            unit_list.append(
                UnitSchema(id=u.id, name=u.name, unit_number=u.unit_number, topics=topic_list)
            )
            
        result.append(
            SubjectSchema(id=sub.id, name=sub.name, code=sub.code, units=unit_list)
        )
    return result
