# EduOS Prototype — Your Execution Plan
This file is for **you**, not the agent. It tells you exactly what to do, in what order, and when to hand things to Antigravity.

---

## Phase 0 — Before you open Antigravity (do this first)

1. **Get your API keys** — you can't build the AI orchestrator without these:
   - NVIDIA NIM API key (build.nvidia.com)
   - Google Gemini API key (aistudio.google.com)
   - Groq API key (console.groq.com)
   - Tavily API key (tavily.com)
2. **Set up infrastructure accounts**:
   - A Postgres instance with the `pgvector` extension available (Supabase, Neon, or your own Docker Postgres all work for prototype).
   - A Redis instance (Upstash free tier is fine for prototype).
   - An S3-compatible bucket (Cloudflare R2 has a generous free tier) for storing the small demo dataset of notes/PPT/PDF files.
3. **Prepare your demo dataset now** — the blueprint recommends, and I'd stick with:
   - 1 subject, 3–5 units
   - 5–10 notes/PDF/PPT resources
   - 3–5 historical question papers (optional for this build pass — you're focusing on the two assistant features, not the Academic Intelligence Engine yet)
   - One demonstration topic: **CNN** (the blueprint's own example — reuse it, it's already thought through)
4. Create a project folder and put all 4 files from this batch, plus your 15 original docs, into a `/docs` folder inside it. Antigravity should have all of it in context.

---

## Phase 1 — Give Antigravity the structure files

Open Antigravity in your new project folder and give it, in this order:
1. `EduOS_SKILL_ANTIGRAVITY.md` (the skill file) — tell it to treat this as its operating instructions for the whole project.
2. `EduOS_01_SYSTEM_ARCHITECTURE.md` — tell it: "scaffold the repo exactly as described in section 3, then implement section 1, 2, and 4 before touching any feature code."
3. `EduOS_02_FEATURE_SPECIFICATION.md` — hand this over once the skeleton + AI orchestrator exist, not before. Building the orchestrator first means both features slot into a working foundation instead of the agent inventing its own ad-hoc AI-calling code per feature.

**Do not** ask it to build both features and the orchestrator in one giant prompt. Go step by step (see Phase 2–6). You have full control at every checkpoint this way.

---

## Phase 2 — Backend skeleton + AI Orchestrator (build this first, always)

This is the highest-risk, highest-value part of the whole prototype. If the fallback chain doesn't actually work, nothing downstream matters.

1. Have Antigravity scaffold `backend/` per file 01 §3.
2. Implement the three provider wrappers (NIM, Gemini, Groq) behind the shared `AIProvider` interface.
3. Implement the orchestrator failover logic.
4. **Test it yourself before moving on**: temporarily set an invalid NIM key and confirm the system silently falls through to Gemini. Then break Gemini too and confirm it falls to Groq. Then break all three and confirm you get one clear error, not a crash.
5. Only move to Phase 3 once this test passes.

---

## Phase 3 — Minimal RAG pipeline

1. Set up the Postgres schema from file 01 §4.
2. Build ingestion for your small demo dataset (notes/PPT/PDF → chunks → embeddings).
3. Build retrieval (topic-scoped, tenant-scoped).
4. Sanity check: query "Explain CNN" against your ingested notes and confirm it retrieves the right chunks before any LLM call happens. If retrieval is wrong, no amount of prompt engineering fixes it downstream.

---

## Phase 4 — Teacher Assistant feature (backend, then frontend)

1. Backend: intent classification → response-type routing → structured responses, per file 02.
2. Frontend: the quick-action panel + per-response-type renderers.
3. Manually run through every trigger type in the file 02 table and confirm each renders correctly, not just the "explain" case.

---

## Phase 5 — Student Assistant feature (the hero feature — give this the most polish)

1. Backend: the level state machine + `student_understanding_state` persistence.
2. Frontend: the private chat UI + quick-reply chips.
3. Run the full acceptance-criteria sequence from file 02 yourself, as if you were a confused student: ask a question, say "I don't understand," say "still not understanding," ask for an example, ask for a practice question. Confirm the explanation actually changes shape at each step — this is the single feature your demo lives or dies on.

---

## Phase 6 — Smart-board-readiness check (quick, don't skip)

Before you call the prototype "done," check file 01 §5's list:
- Are Teacher Assistant responses returned as structured JSON (not pre-rendered HTML)?
- Is auth token-based, not cookie-session-based?

If yes to both, you can honestly tell an investor/institution "this backend is already board-compatible" without having built any hardware — which is exactly the credibility move the blueprint's investor narrative (§25) is built around.

---

## Phase 7 — Demo rehearsal

Run the exact investor/customer demo story from the blueprint (§16), but swap in your two features:
1. Select subject/unit/topic.
2. Teacher asks "Explain CNN with a simple real-world example" → gets a structured explanation.
3. Teacher asks "Show me a roadmap" → gets a rendered roadmap.
4. Switch to student view. Student asks "I don't understand CNN," escalates through simpler explanations, gets an example, gets a practice question.
5. Point out (verbally, doesn't need to be on screen) that if you kill your NIM API key mid-demo, the system keeps working — that's your fallback chain doing its job, and it's a genuinely strong thing to be able to show live if you're brave enough to try it.

---

## Order-of-operations summary (pin this)

```
Keys & infra → repo skeleton → AI orchestrator (test failover!) → RAG pipeline (test retrieval!)
→ Teacher Assistant → Student Assistant (polish this most) → smart-board-readiness check → demo rehearsal
```

Don't let Antigravity jump ahead to frontend polish before the orchestrator and retrieval are proven correct — a beautiful UI on top of a broken AI layer is worse for a demo than a plain UI on top of a solid one.
