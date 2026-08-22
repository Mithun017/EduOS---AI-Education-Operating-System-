import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status, UploadFile
import cloudinary
import cloudinary.uploader

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

def configure_cloudinary():
    if settings.CLOUDINARY_CLOUD_NAME:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )

# Initialize configuration
configure_cloudinary()

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

    storage_key = build_tenant_s3_key(institution_id, resource_id, file.filename or "resource.bin")

    if settings.CLOUDINARY_CLOUD_NAME:
        try:
            # Upload raw file (handles PDFs, slides, text etc)
            cloudinary.uploader.upload(
                content,
                public_id=storage_key,
                resource_type="raw"
            )
            logger.info(f"Successfully uploaded resource file to Cloudinary: {storage_key}")
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
    else:
        logger.info(f"Cloudinary not configured. Virtual key generated: {storage_key}")

    return storage_key

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
