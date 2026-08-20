import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status, UploadFile
import boto3
from botocore.exceptions import BotoCoreError

from app.core.config import settings
from app.db.models import KnowledgeChunk, Resource

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain"
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 # 50 MB

class FileValidationError(HTTPException):
    pass

def validate_upload_file(file: UploadFile, content: bytes):
    # 1. Size check
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise FileValidationError(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
        )

    # 2. MIME type check
    content_type = file.content_type
    filename = file.filename or ""
    
    # Fallback extension check if generic octet-stream
    if content_type not in ALLOWED_MIME_TYPES:
        if filename.endswith(".pdf"):
            content_type = "application/pdf"
        elif filename.endswith(".txt"):
            content_type = "text/plain"
        elif filename.endswith(".ppt"):
            content_type = "application/vnd.ms-powerpoint"
        elif filename.endswith(".pptx"):
            content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

    if content_type not in ALLOWED_MIME_TYPES:
        raise FileValidationError(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Allowed types: PDF, PPT, PPTX, TXT."
        )

def get_s3_client():
    if not settings.S3_ACCESS_KEY_ID or settings.S3_ACCESS_KEY_ID == "your_r2_access_key_id":
        return None
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL or None,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name=settings.S3_REGION
    )

def build_tenant_s3_key(institution_id: str, resource_id: str, filename: str) -> str:
    """Enforce tenant isolation at object storage layer: {institution_id}/{resource_id}/{filename}"""
    safe_filename = filename.replace(" ", "_")
    return f"{institution_id}/{resource_id}/{safe_filename}"

async def upload_resource_file(
    institution_id: str,
    resource_id: str,
    file: UploadFile
) -> str:
    content = await file.read()
    validate_upload_file(file, content)

    s3_key = build_tenant_s3_key(institution_id, resource_id, file.filename or "resource.bin")
    s3_client = get_s3_client()

    if s3_client:
        try:
            s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=content,
                ContentType=file.content_type
            )
            logger.info(f"Successfully uploaded resource file to S3: {s3_key}")
        except BotoCoreError as e:
            logger.error(f"S3 upload failed: {e}")
    else:
        logger.info(f"S3 not configured. Virtual key generated: {s3_key}")

    return s3_key

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """Splits plain text into overlapping chunks."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))
        i += chunk_size - overlap
    return chunks
