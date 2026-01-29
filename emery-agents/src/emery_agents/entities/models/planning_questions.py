"""
Planning Questions Models

Dataclasses for batched question collection during cascading planning.
Questions are collected from all sub-agents before presenting to user.
"""

from dataclasses import dataclass, field
from itertools import groupby
from typing import Any, Dict, List, Optional


@dataclass
class AgentQuestion:
    """
    Question from a sub-agent during planning phase.

    Collected during cascading planning when a sub-agent needs
    clarification before finalizing its detailed plan.
    """
    question_id: str
    agent_name: str  # "schema_builder", "skill_builder", etc.
    step_id: str  # Parent step this question relates to
    question: str
    options: Optional[List[str]] = None  # For multiple choice questions
    context: Optional[str] = None  # Why the agent needs this info

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "questionId": self.question_id,
            "agentName": self.agent_name,
            "stepId": self.step_id,
            "question": self.question,
            "options": self.options,
            "context": self.context,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentQuestion":
        """Create from dictionary."""
        return cls(
            question_id=data.get("questionId", data.get("question_id", "")),
            agent_name=data.get("agentName", data.get("agent_name", "")),
            step_id=data.get("stepId", data.get("step_id", "")),
            question=data.get("question", ""),
            options=data.get("options"),
            context=data.get("context"),
        )


@dataclass
class BatchedQuestions:
    """
    All questions collected during cascading planning.

    Presented to user in a single UI, grouped by agent.
    """
    questions: List[AgentQuestion] = field(default_factory=list)
    planning_round: int = 1  # For iterative planning

    def group_by_agent(self) -> Dict[str, List[AgentQuestion]]:
        """Group questions by agent for UI display."""
        sorted_qs = sorted(self.questions, key=lambda q: q.agent_name)
        result: Dict[str, List[AgentQuestion]] = {}
        for agent_name, group in groupby(sorted_qs, key=lambda q: q.agent_name):
            result[agent_name] = list(group)
        return result

    def group_by_step(self) -> Dict[str, List[AgentQuestion]]:
        """Group questions by parent step."""
        sorted_qs = sorted(self.questions, key=lambda q: q.step_id)
        result: Dict[str, List[AgentQuestion]] = {}
        for step_id, group in groupby(sorted_qs, key=lambda q: q.step_id):
            result[step_id] = list(group)
        return result

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "questions": [q.to_dict() for q in self.questions],
            "planningRound": self.planning_round,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BatchedQuestions":
        """Create from dictionary."""
        questions_data = data.get("questions", [])
        planning_round = data.get("planningRound", data.get("planning_round", 1))
        return cls(
            questions=[AgentQuestion.from_dict(q) for q in questions_data],
            planning_round=int(planning_round) if planning_round else 1,
        )

    @property
    def is_empty(self) -> bool:
        """Check if there are no questions."""
        return len(self.questions) == 0

    def add_question(self, question: AgentQuestion) -> "BatchedQuestions":
        """Return new BatchedQuestions with added question."""
        return BatchedQuestions(
            questions=self.questions + [question],
            planning_round=self.planning_round,
        )


@dataclass
class QuestionAnswers:
    """
    User's answers to batched questions.

    Maps question_id to the user's answer.
    """
    answers: Dict[str, str] = field(default_factory=dict)  # question_id → answer

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {"answers": self.answers}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QuestionAnswers":
        """Create from dictionary."""
        answers_data = data.get("answers", {})
        return cls(answers=answers_data if isinstance(answers_data, dict) else {})

    def get_answer(self, question_id: str) -> Optional[str]:
        """Get answer for a specific question."""
        return self.answers.get(question_id)

    def get_answers_for_agent(
        self,
        agent_name: str,
        questions: BatchedQuestions,
    ) -> Dict[str, str]:
        """Get answers for a specific agent's questions."""
        agent_questions = questions.group_by_agent().get(agent_name, [])
        return {
            q.question_id: self.answers.get(q.question_id, "")
            for q in agent_questions
            if q.question_id in self.answers
        }
