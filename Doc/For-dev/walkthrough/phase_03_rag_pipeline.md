# Phase 3 — RAG Pipeline Execution Log

## Overview
Phase 3 implemented the minimal RAG pipeline with document validation, S3 object key tenant isolation, tenant-scoped vector/content retrieval, and isolated Tavily web search.

## Completed Deliverables

1. **Ingestion & Validation Engine** (`backend/app/rag/ingestion.py`)
   - **MIME-Type Validation**: Restricts uploads strictly to `PDF`, `PPT`, `PPTX`, `TXT` (HTTP 415 rejection for unallowed types).
   - **Size Limit Validation**: Configurable max limit (default 50 MB, HTTP 413 rejection for oversized files).
   - **S3 Object Key Tenant Namespacing**: Enforces `s3://bucket/{institution_id}/{resource_id}/{filename}` format so files cannot cross tenant boundaries at the storage layer.

2. **Topic & Tenant-Scoped Retrieval Engine** (`backend/app/rag/retrieval.py`)
   - Mandatory database query filter on `KnowledgeChunk.institution_id` and `KnowledgeChunk.topic_id`.
   - Ranked matching over ingested topic chunks returning content, score, and source metadata.

3. **Isolated Tavily Search Boundary** (`backend/app/rag/tavily_client.py`)
   - Called **only** when `response_mode = general` or for external reference lookups.
   - Isolated from private institutional document RAG pipeline.

4. **Automated Test Suite** (`backend/tests/test_rag_pipeline.py`)
   - `test_file_validation_mime_type_rejection`: Verified HTTP 415 error on invalid file formats.
   - `test_file_validation_oversized_rejection`: Verified HTTP 413 error on oversized uploads.
   - `test_tenant_s3_key_formatting`: Verified `{institution_id}/` prefixed keys.
   - `test_retrieval_scoped`: Verified retrieved chunks are strictly scoped to the requesting institution.

## Verification Results
Ran `python -m pytest tests/ -v`:
- All 12 unit tests across `test_orchestrator.py`, `test_tenant_isolation.py`, and `test_rag_pipeline.py` **PASSED 100%**.
