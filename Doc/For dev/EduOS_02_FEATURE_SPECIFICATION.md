# EduOS Prototype — Feature & API Specification
**Give this file to Antigravity alongside file 01. This is the "what to build, exactly" spec.**

Both features share one backend AI Orchestrator (see file 01 §2) and one streaming transport. They differ in **conversation shape**, **response structure**, and **who can see the conversation**.

---

## Feature 1 — Teacher Live Teaching Assistant

### Purpose
The teacher is mid-class. They ask EduOS for something and get it back in seconds, in a form they can immediately use or show. The teacher stays in control — nothing is auto-shown to students.

### Trigger types (map each to a distinct response renderer, not one generic text blob)

| Teacher says | Response type | Structured shape |
|---|---|---|
| "Explain CNN with a simple real-world example" | `explanation` | `{summary, real_world_example, key_points[]}` |
| "Show me a simple roadmap for this topic" | `roadmap` | `{nodes: [{id, label, order}], edges: [{from, to}]}` |
| "Give me a chart for X" | `chart` | `{chart_type, labels[], series[]}` |
| "Key points for this unit" | `key_points` | `{points: string[]}` |
| "What resources do I have for this topic?" | `resources` | `{resources: [{title, type, url_or_ref}]}` |
| "What did we cover / what came up before on this topic?" | `previous_question_context` | `{prior_questions: [{question, answer_summary, date}]}` |
| "Give me a quick question to ask the class" | `quick_question` | `{question, expected_answer_hint}` |

### Backend contract

```
POST /api/v1/teacher-assistant/ask
Headers: Authorization: Bearer <token>
Body: {
  "topic_id": "uuid",
  "message": "Explain CNN with a simple real-world example",
  "response_mode_hint": "institution_grounded" | "hybrid" | "general" | null
}
```

Response is **streamed** over WebSocket (`/ws/teacher-assistant/{conversation_id}`) as chunks, with a final structured payload:

```json
{
  "conversation_id": "...",
  "response_type": "explanation",
  "response_mode": "hybrid",
  "grounded_content": "...",
  "general_content": "...",
  "sources": [{"resource_id": "...", "title": "..."}],
  "provider_used": "nvidia_nim"
}
```

`response_type` is **classified server-side** (intent classification step before the main generation call — can be a small/fast model call, e.g. via Groq, to keep latency low) so the frontend knows which React component to render.

### UI (React) — `features/teacher-assistant/`
- Persistent side panel or bottom bar (teacher is teaching — this must never take over the full screen).
- Quick-action chips: "Explain simply," "Real-world example," "Roadmap," "Key points," "Resources," "Quiz question" — these pre-fill the message so the teacher doesn't have to type a full sentence mid-class.
- Each `response_type` gets its own renderer component (`ExplanationCard`, `RoadmapDiagram`, `ChartCard`, `KeyPointsList`, `ResourceList`, `QuickQuestionCard`) — matches the structured-data requirement in file 01 §5.

### Acceptance criteria (demo-ready definition of done)
- Teacher picks topic → asks "Explain CNN simply" → gets grounded explanation + real-world example in under ~4s to first token.
- Teacher asks for a roadmap → gets a rendered node diagram, not a paragraph describing one.
- If institutional material has nothing on the topic, response is clearly labeled `general` mode, not silently fabricated as if grounded.

---

## Feature 2 — Student Private Adaptive Learning Assistant (hero feature)

### Purpose
A student never has to raise their hand. They ask privately, and the assistant **remembers where they got stuck** within the session and adapts, rather than repeating the same explanation.

### Conversation state machine

```
LEVEL 0: technical/standard explanation (institution-grounded first)
   ↓ student: "I don't understand"
LEVEL 1: simplified explanation
   ↓ student: "still not understanding" / "explain like I'm a beginner"
LEVEL 2: beginner-level, minimal jargon
   ↓ student: "give me an example"
BRANCH:  worked example (does not reset level — attaches to current level)
   ↓ student: "give me a practice question"
BRANCH:  generated practice question (difficulty matched to current level)
```

This state lives in `student_understanding_state` (file 01 §4), keyed per `conversation_id` + `topic_id`. **The level only moves down (simplifies) on explicit signals** ("don't understand," "still confused," "explain like I'm new," "simpler") — it does not silently guess frustration from sentiment. Keep the trigger phrases in a small, extensible intent-matching list server-side, backed by a fast classification call so odd phrasings still map correctly.

### Backend contract

```
POST /api/v1/student-assistant/ask
Body: {
  "topic_id": "uuid",
  "conversation_id": "uuid | null",   // null starts a new private session
  "message": "I don't understand CNN"
}
```

```json
// response
{
  "conversation_id": "...",
  "current_level": "simplified",
  "response_type": "explanation" | "example" | "analogy" | "step_by_step" | "visual" | "practice_question",
  "content": "...",
  "grounded": true,
  "sources": [...],
  "suggested_next_actions": ["Give me an example", "Explain even simpler", "Practice question"]
}
```

`suggested_next_actions` drives the UI's quick-reply buttons so the student doesn't need to guess what to type next — critical for the "safe, low-friction" positioning from the blueprint.

### Privacy requirement (non-negotiable, matches blueprint §5)
- `conversations` where `role = student` are visible **only** to that student and (optionally, later) to the student themself for review — **never** surfaced to the teacher's view or classmates by default. Enforce this at the query layer (`core/tenant.py` + a `user_id` check), not just in the UI.

### UI (React) — `features/student-assistant/`
- Full-page or modal private chat, deliberately styled differently from the teacher panel (calmer, less "classroom," more "just you and this").
- Quick-reply chips generated from `suggested_next_actions` — reduces typing friction, which matters because hesitation is exactly the barrier this feature exists to remove.
- Visible (subtle) indicator of current level, e.g. "Explaining: Beginner level" — gives the student a sense of control, they can say "go back to normal" to reset.

### Acceptance criteria
- Student: "I don't understand CNN" → grounded explanation.
- Student: "still not understanding" → **visibly different, simpler** explanation, not a rephrase of the same content.
- Student: "explain like I'm a beginner" → jargon-minimal version.
- Student: "give me an example" → concrete worked example at current level.
- Student: "give me a practice question" → one question, appropriately scoped, with an answer available on request (don't dump the answer unasked).
- Reloading the page mid-conversation preserves `current_level` (state is server-side, not just React state).

---

## Shared: Tavily integration boundary

Tavily is called **only** in two situations, both inside `rag/tavily_client.py`, never from the feature services directly:
1. `response_mode = general` and the query has no institutional grounding — Tavily supplements the LLM with current web context.
2. Resource recommendation for **approved external resources** (e.g. suggesting a YouTube explainer) — and only when the product policy for that institution allows external suggestions.

Tavily results are never used to answer from a student's or teacher's **private institutional documents** — those come only from the internal RAG pipeline. This boundary matters for the "institution-grounded" trust claim in the blueprint; don't let it blur.

---

## Cross-feature: intent classification step

Both features need a cheap, fast "what is the user asking for" step before the expensive generation call. Use the **fastest provider in the chain (Groq)** for this classification sub-call regardless of which provider ends up generating the main response — this keeps perceived latency low without touching the main failover logic in file 01 §2.
