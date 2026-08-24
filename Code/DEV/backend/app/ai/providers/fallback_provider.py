import json
import logging
from typing import AsyncIterator
from app.ai.providers.base import AIRequest, AIChunk

logger = logging.getLogger(__name__)

class FallbackLocalProvider:
    name: str = "fallback_local"
    priority: int = 99

    async def health_check(self) -> bool:
        return True

    async def generate(self, request: AIRequest) -> AsyncIterator[AIChunk]:
        last_msg = request.messages[-1].content if request.messages else "general"
        system_prompt = request.system_prompt or ""

        if "JSON" in system_prompt or "json" in system_prompt:
            content = self._build_json_response(last_msg)
        else:
            content = self._build_text_response(last_msg)

        words = content.split(" ")
        for i in range(0, len(words), 3):
            chunk_text = " ".join(words[i:i+3]) + " "
            yield AIChunk(text=chunk_text, provider_name=self.name)

        yield AIChunk(text="", is_final=True, provider_name=self.name, latency_ms=10)

    def _build_json_response(self, prompt: str) -> str:
        prompt_lower = prompt.lower()
        if "roadmap" in prompt_lower:
            data = {
                "nodes": [
                    {"id": "n1", "label": "1. Fundamental Concepts & Definitions", "order": 1},
                    {"id": "n2", "label": "2. Core Architecture & Operations", "order": 2},
                    {"id": "n3", "label": "3. Practical Application & Lab Exercises", "order": 3},
                    {"id": "n4", "label": "4. Performance Optimization & Evaluation", "order": 4}
                ],
                "edges": [
                    {"from": "n1", "to": "n2"},
                    {"from": "n2", "to": "n3"},
                    {"from": "n3", "to": "n4"}
                ]
            }
        elif "chart" in prompt_lower:
            data = {
                "chart_type": "bar",
                "labels": ["Module 1", "Module 2", "Module 3", "Module 4"],
                "series": [
                    {"name": "Class Comprehension %", "data": [85, 78, 92, 88]},
                    {"name": "Quiz Performance %", "data": [80, 72, 89, 84]}
                ]
            }
        elif "key point" in prompt_lower or "points" in prompt_lower:
            data = {
                "points": [
                    "Master foundational concepts and operational definitions.",
                    "Understand key structural mechanisms and workflow processes.",
                    "Apply diagnostic methods for evaluation and optimization."
                ]
            }
        elif "resource" in prompt_lower:
            data = {
                "resources": [
                    {"title": "Curriculum Lecture Notes & Study Guide", "type": "notes", "url_or_ref": "docs/lecture_notes.pdf"},
                    {"title": "Interactive Code Repository & Lab Manual", "type": "lab", "url_or_ref": "github/lab_manual"}
                ]
            }
        elif "question" in prompt_lower:
            data = {
                "question": "What is the primary operational trade-off when optimizing system throughput vs latency?",
                "expected_answer_hint": "Throughput emphasizes batch processing volume; latency prioritizes immediate response time."
            }
        else:
            data = {
                "summary": "Here is a structured explanation based on core curriculum principles.",
                "real_world_example": "Consider a real-world system processing dynamic user requests with fault tolerance.",
                "key_points": [
                    "Core theoretical foundation.",
                    "Optimized execution and state management.",
                    "Best practices for scalability and maintenance."
                ]
            }
        return json.dumps(data)

    def _build_text_response(self, prompt: str) -> str:
        clean_topic = prompt.strip()
        return (
            f"Here is an explanation for **{clean_topic}**:\n\n"
            f"1. **Core Concept**: The topic centers on fundamental principles that govern theoretical structure and practical execution.\n"
            f"2. **Key Mechanism**: Key components interact dynamically to process inputs, optimize performance, and achieve consistent outcomes.\n"
            f"3. **Practical Application**: In real-world environments, this approach ensures reliable operation, maintainability, and scalable deployment.\n\n"
            f"Feel free to ask for a visual roadmap, chart comparison, or practice quiz questions on this topic!"
        )
