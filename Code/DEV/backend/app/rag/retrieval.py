import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.db.models import KnowledgeChunk, Resource

logger = logging.getLogger(__name__)

async def retrieve_relevant_chunks(
    session: AsyncSession,
    institution_id: str,
    topic_id: str,
    query_text: str,
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    Tenant-scoped and topic-scoped RAG retrieval engine.
    Ensures institution_id filter is ALWAYS applied at the database query level.
    """
    # 1. Base tenant & topic filtered query
    stmt = select(KnowledgeChunk).where(
        and_(
            KnowledgeChunk.institution_id == institution_id,
            KnowledgeChunk.topic_id == topic_id
        )
    )

    result = await session.execute(stmt)
    chunks = result.scalars().all()

    if not chunks:
        # Fallback query: check all chunks in topic under institution
        return []

    # Simple keyword scoring for ranking prototype chunks
    query_words = set(query_text.lower().split())
    scored_chunks = []

    for chunk in chunks:
        chunk_words = set(chunk.content.lower().split())
        match_score = len(query_words.intersection(chunk_words))
        scored_chunks.append((match_score, chunk))

    # Sort descending by match score
    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    retrieved = []
    for score, chunk in scored_chunks[:top_k]:
        retrieved.append({
            "chunk_id": chunk.id,
            "topic_id": chunk.topic_id,
            "source_resource_id": chunk.source_resource_id,
            "content": chunk.content,
            "score": float(score)
        })

    logger.info(f"Retrieved {len(retrieved)} chunks for inst={institution_id}, topic={topic_id}")
    return retrieved
