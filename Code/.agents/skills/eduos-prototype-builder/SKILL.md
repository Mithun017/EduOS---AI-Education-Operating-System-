---
name: eduos-prototype-builder
description: Operating instructions for building the EduOS prototype (Teacher Live Teaching Assistant + Student Private Adaptive Learning Assistant). Read this before writing any code in this repo.
---

# EduOS Prototype Builder — Skill

You are building the software-layer prototype of **EduOS**, an institution-aware AI Education Operating System. Two companion files define what to build:

- `EduOS_01_SYSTEM_ARCHITECTURE.md` — tech stack, repo structure, AI orchestrator design, data model.
- `EduOS_02_FEATURE_SPECIFICATION.md` — exact behavior of the two features you're building.

Read both in full before writing code. This file governs **how** you build, not what.

## Non-negotiable principles

These come directly from the product's own design principles and override convenience shortcuts:

- **Teacher-first, human-controlled.** Nothing the AI generates is auto-published or auto-shown to a class. It's always presented for the teacher/student to use, review, or act on.
- **Tenant isolation is not optional, even in a prototype.** Every database query that touches academic or user data must be filtered by `institution_id`. If you write a query without it, stop and add it before continuing. Do not defer this to "later."
- **Provider independence.** No feature module (`teacher_assistant`, `student_assistant`, `rag`) may import an AI SDK directly. Everything goes through `ai/orchestrator.py`. If you catch yourself writing `import openai` or `import google.generativeai` inside a feature file, that's a sign to stop and route it through the orchestrator instead.
- **Institution-grounded vs general must always be distinguishable in the response**, never silently blended. If you can't tell which category a piece of content falls into, treat it as `general` and label it as such rather than guessing.
- **Small dataset, working workflow > large dataset, broken workflow.** Do not build a bulk-ingestion pipeline for the prototype. The demo dataset is deliberately small (see file 03, Phase 0).
- **Never hardcode a secret.** NIM/Gemini/Groq/Tavily keys and DB credentials come from environment variables read in `core/config.py`. Never print them, log them, or return them in any API response — including error responses.

## Build order (do not reorder this)

1. Repo skeleton (file 01 §3).
2. AI Orchestrator with real failover between NIM → Gemini → Groq (file 01 §2). **Prove failover works with a manual test before moving on** — this is the foundation everything else depends on.
3. Data model + migrations (file 01 §4).
4. Minimal RAG ingestion + retrieval (file 01, small dataset only).
5. Teacher Assistant feature (file 02).
6. Student Assistant feature (file 02) — this is the hero feature; give it the most care, especially the level state machine.
7. Frontend for both, using the structured-response renderers described in file 02.

If the user (Mithun) hands you file 02 before step 2–4 are done, push back and finish the foundation first — a feature built against a stubbed orchestrator will need to be redone.

## Coding conventions

**Backend (Python/FastAPI)**
- Async everywhere an I/O call happens (DB, AI provider calls, Tavily, Redis).
- Pydantic v2 models for every request/response — no raw dicts crossing a router boundary.
- One router per feature (`features/teacher_assistant/router.py`, etc.), business logic lives in `service.py`, never in the router function itself.
- Streaming responses use the shared handler in `ws/stream.py` — don't reimplement streaming per feature.

**Frontend (React/TypeScript)**
- Functional components + hooks only.
- One renderer component per `response_type` (see file 02's table) — don't build a single component with a giant switch statement that renders everything inline; keep them composable and separately testable.
- Server state (conversations, messages) through TanStack Query; ephemeral UI state (which quick-action is highlighted, chat scroll position) through local state or Zustand — don't mix the two.
- Tailwind utility classes, shadcn/ui primitives — don't hand-roll components that shadcn already provides.

**AI Orchestrator specifically**
- Implement the `AIProvider` protocol from file 01 §2.2 for each of the three providers as separate files under `ai/providers/`.
- Circuit breaker state can be in-memory for the prototype (a simple failure-count + cooldown dict), no need for a distributed circuit breaker yet.
- Every generation call logs: provider used, latency, token count, institution_id, feature (teacher/student) — even if nothing consumes these logs yet, the hooks must exist (unit economics tracking depends on this later, per the blueprint's cost section).

## Self-check before marking any task done

Before telling the user a step is complete, verify:
- [ ] Does this touch institution data? If yes, is `institution_id` filtered at the query level?
- [ ] Does this call an AI provider? If yes, does it go through the orchestrator, not a direct SDK call?
- [ ] Does this return content to the frontend? If yes, is it structured JSON matching file 02's contract, not a raw text blob the frontend has to parse?
- [ ] Did you add/update a test or at least a manual verification step for this piece, per file 03's phase checkpoints?

If any answer is no, the task isn't actually done — say so plainly rather than reporting success.

## What NOT to build in this pass

Do not build, even if it seems easy to add along the way:
- The Academic Intelligence Engine (question-paper frequency/Bloom's analysis).
- Voice, touch, or stylus interaction.
- Offline/edge caching.
- A full multi-institution admin console — seed one demo institution directly if needed, don't build a UI for it yet.

Staying inside this scope is a deliberate product decision (blueprint §15), not a limitation to work around.
