"""Enums for planning operations."""

from __future__ import annotations

from enum import Enum


class TaskDomain(str, Enum):
    """Domain classification for tasks."""

    EMERY = "emery"
    WEB = "web"
    AUTOMATION = "automation"
    RESEARCH = "research"


class TaskComplexity(str, Enum):
    """Complexity level for tasks."""

    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"


class TaskExecutionMode(str, Enum):
    """Execution mode for task routing."""

    DIRECT = "DIRECT"
    PLAN_AND_APPROVE = "PLAN_AND_APPROVE"


class QuestionType(str, Enum):
    """Types of clarifying questions."""

    CHOICE = "choice"
    TEXT = "text"
    CONFIRMATION = "confirmation"
