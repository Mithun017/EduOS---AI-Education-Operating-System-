# EduOS Prototype — System & Technical Architecture
**Give this file to Antigravity as the primary structure/context file.**
Version 1.0 · Source-aligned with EduOS Blueprint v1.0 (15 Aug 2026) and the 14 supporting docs.

---

## 0. What this prototype actually is

This is **not** the full EduOS product. It is the software-layer prototype that proves two things first:

1. **Teacher Live Teaching Assistant** — an in-class copilot the teacher talks to while teaching.
2. **Student Private Adaptive Learning Assistant** — the hero feature. A private, judgment-free tutor that adapts explanation depth per student, per question.

Everything below is built so that a **future smart board is just a new frontend client**, not a rewrite. The backend never assumes "browser" — it assumes "a client," which today is a laptop/React app and tomorrow can be a board runtime. Keep this constraint in every architectural decision.

Core principles carried over from the blueprint (do not violate these when generating code):
- Teacher-first — AI assists, never replaces.
- Institution-grounded — answers should say what they're grounded in.
- Multi-tenant — one institution's data must never leak into another's context, even in the prototype.
- Provider-independent — no AI provider is hardcoded into business logic.
- Human-controlled — nothing generated is auto-published; it's shown for use/review.
- Prototype-first — small controlled dataset, not a full ingestion pipeline.

---

## 1. Tech Stack (locked decisions)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | fast dev loop, matches your stated stack |
| Styling/UI | **Tailwind CSS + shadcn/ui** | ships fast, looks production-grade without a design team |
| State/data | **TanStack Query** for server state, **Zustand** for local UI state | avoids Redux boilerplate |
| Realtime | **WebSocket (native or Socket.IO)** for streamed AI responses | teacher/student assistants must feel live, not spinner-then-dump |
| Backend | **Python 3.11 + FastAPI** | async, typed, matches your stack, plays well with AI SDKs |
| Validation | **Pydantic v2** | request/response contracts, also doubles as API docs source |
| Task/async jobs | **FastAPI BackgroundTasks** for prototype; note Celery+Redis as the Phase-2 upgrade path | don't over-engineer the prototype |
| Primary DB | **PostgreSQL** | relational academic hierarchy (Institution→Department→Program→Year→Semester→Subject→Unit→Topic) needs real joins |
| Vector store | **pgvector extension on the same Postgres** | avoids running a second DB in the prototype; migrate to a dedicated vector DB (Qdrant/Pinecone) only when scale demands it |
| Cache/session | **Redis** | AI response cache, session/conversation memory, rate limiting |
| Object storage | **S3-compatible (AWS S3 or Cloudflare R2)** | notes/PPT/PDF/question-paper files — never store binaries in Postgres |
| Web/scrape augmentation | **Tavily API** | used only for the "relevant institutional/external resource" lookup and general-mode fallback answers — never used to fetch the institution's own private material |
| Auth | **JWT access + refresh tokens**, RBAC (Super Admin / College Admin / HOD / Teacher / Student) | matches the SRS/API doc's stated model |
| Containerization | **Docker + docker-compose** for local/prototype; note path to a managed platform later | keeps "works on my machine" from being a problem |

---

## 2. AI Orchestrator — the part your idea depends on most

This is the single most important module. Every AI call in the system (teacher assistant, student assistant, resource recommendation, academic intelligence) goes **through this layer**, never directly to a provider SDK.

### 2.1 Provider chain (default priority — configurable per institution/task later)

```
1st choice: NVIDIA NIM      (best reasoning/quality for structured educational content)
2nd choice: Google Gemini   (strong multimodal + long-context fallback)
3rd choice: Groq            (fastest inference — also usable as a "speed mode" override, not just a failure fallback)
```

### 2.2 Required behavior

- **Automatic failover**: if the active provider errors, times out (set an explicit timeout, e.g. 12s for streaming start), or returns a rate-limit/5xx, the orchestrator silently retries the *same request* against the next provider in the chain. The teacher/student never sees an error unless **all three** providers fail.
- **Uniform interface**: every provider is wrapped behind one internal contract, e.g.

```python
class AIProvider(Protocol):
    async def generate(self, request: AIRequest) -> AsyncIterator[AIChunk]: ...
    async def health_check(self) -> bool: ...
    name: str
    priority: int
```

- **Circuit breaker**: if a provider fails N times in a rolling window, skip it for a cool-down period instead of retrying it every request (saves latency).
- **Cost/usage logging**: every call logs provider used, tokens, latency, institution_id — this is what Section 14 of the blueprint (unit economics) depends on later. Build the logging hook now even if you don't build the dashboard yet.
- **No provider-specific prompt logic** leaks into the academic engines (Teacher Assistant, Student Assistant). Those modules build a *provider-agnostic* prompt payload; the orchestrator adapts it per provider's SDK format internally.
- **Secrets**: NVIDIA NIM key, Gemini key, Groq key, Tavily key all come from environment variables / a secrets manager — never hardcoded, never logged, never returned in any API response.

### 2.3 Response modes (from the blueprint's AI System section — implement all three)

- `institution_grounded` — answer built primarily from retrieved institutional chunks.
- `hybrid` — institutional material first, general model knowledge fills gaps, and the response must **visibly separate** the two (e.g. a `grounded` vs `general` field in the structured response, not just prose).
- `general` — no institutional material matched; general AI answer, clearly labeled as such.

---

## 3. Repository Structure

```
eduos-prototype/
├── frontend/
│   ├── src/
│   │   ├── app/                     # routes: /teacher, /student, /admin(minimal)
│   │   ├── features/
│   │   │   ├── teacher-assistant/   # panel UI, message list, quick-action buttons
│   │   │   └── student-assistant/   # chat UI, difficulty controls, practice-question cards
│   │   ├── components/ui/           # shadcn components
│   │   ├── lib/api.ts               # typed API client (generated or hand-typed from backend schema)
│   │   ├── lib/ws.ts                # streaming connection handling
│   │   └── store/                   # zustand stores (session, active topic context)
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py            # env/secrets loading
│   │   │   ├── security.py          # JWT, RBAC deps
│   │   │   └── tenant.py            # institution-context middleware — EVERY query passes through this
│   │   ├── ai/
│   │   │   ├── orchestrator.py      # the failover engine described in §2
│   │   │   ├── providers/
│   │   │   │   ├── nim_provider.py
│   │   │   │   ├── gemini_provider.py
│   │   │   │   └── groq_provider.py
│   │   │   └── prompts/             # versioned prompt templates, one file per use case
│   │   ├── rag/
│   │   │   ├── ingestion.py         # doc → chunks → embeddings (small dataset only, per blueprint §15)
│   │   │   ├── retrieval.py
│   │   │   └── tavily_client.py     # external/resource-augmentation search, isolated here on purpose
│   │   ├── features/
│   │   │   ├── teacher_assistant/
│   │   │   │   ├── router.py
│   │   │   │   ├── service.py
│   │   │   │   └── schemas.py
│   │   │   └── student_assistant/
│   │   │       ├── router.py
│   │   │       ├── service.py       # holds the progressive-simplification state machine
│   │   │       └── schemas.py
│   │   ├── db/
│   │   │   ├── models.py            # SQLAlchemy models, matches §4 below
│   │   │   └── session.py
│   │   └── ws/
│   │       └── stream.py            # shared streaming handler both features use
│   ├── alembic/                     # migrations
│   ├── tests/
│   └── requirements.txt
│
├── docker-compose.yml                # postgres+pgvector, redis, backend, frontend
├── .env.example
└── docs/                             # drop all 15 of your original docs here for agent reference
```

---

## 4. Data Model (prototype scope — Postgres)

Follows the blueprint's hierarchy exactly (§29 Appendix):

```
institutions
  └─ departments
      └─ programs
          └─ semesters
              └─ subjects
                  └─ units
                      └─ topics
                          ├─ resources (notes/ppt/pdf/question_paper/youtube_link) → object storage pointer
                          ├─ knowledge_chunks (text, source_resource_id)
                          └─ embeddings (vector, chunk_id)  -- pgvector column on knowledge_chunks

users (id, institution_id, role[super_admin|college_admin|hod|teacher|student], ...)

conversations
  (id, institution_id, user_id, role[teacher|student], topic_id, mode[teacher|student], created_at)

messages
  (id, conversation_id, sender[user|assistant], content, response_mode[institution_grounded|hybrid|general],
   provider_used, tokens_used, latency_ms, created_at)

student_understanding_state   -- what makes the student feature "adaptive"
  (id, conversation_id, topic_id, current_level[technical|simplified|beginner|analogy|example], updated_at)
```

**Every table above carries `institution_id`. Every query filters by it via `core/tenant.py`.** This is non-negotiable even in the prototype — retrofitting tenant isolation later is expensive and dangerous.

---

## 5. Smart-board readiness (build this in from day one, don't bolt it on later)

The blueprint is explicit: the board is "a lightweight EduOS client" that talks to the same cloud intelligence. Practically, that means:

- The backend API and WebSocket contracts must be **transport/UI-agnostic JSON**, never something that assumes "this is a browser DOM."
- Teacher Assistant responses that include a chart/roadmap must be returned as **structured data** (e.g. `{type: "roadmap", nodes: [...]}`), not pre-rendered HTML/SVG. The React app renders it today; a board client renders the same payload tomorrow.
- Auth must support a **device/tenant token flow**, not just a browser session cookie — this is already satisfied by using JWT bearer tokens instead of cookie sessions.

You do not need to build a board client now. You need to *not paint yourself into a corner* that makes one impossible later. This section is the checklist for that.

---

## 6. What's explicitly OUT of scope for this build pass

(per blueprint §15 "Prototype — What We Build First," trimmed further to your two priority features)

- Full Academic Intelligence Engine (question-paper frequency/Bloom's analysis) — stub the data model, don't build the analysis yet.
- Voice/touch/stylus interaction — text-first for the prototype.
- Offline/edge caching — cloud-only for now.
- Multi-institution admin console beyond the bare minimum needed to seed one demo institution.

Keep the prototype small and working over broad and half-built — this matches the blueprint's own stated strategy.
