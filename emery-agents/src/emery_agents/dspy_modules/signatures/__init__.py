"""
DSPy Signatures for the Emery agent system.

Signatures define typed I/O contracts that replace Jinja2 templates.
"""

from emery_agents.dspy_modules.signatures.planning import (
    CreatePlan,
    AnalyzeTask,
    PlanStep,
    Plan,
    ClarifyingQuestion,
    PlanOrQuestions,
)
from emery_agents.dspy_modules.signatures.agents import (
    BuildSchema,
    BuildSkill,
    BuildApp,
    TableSchema,
    FieldDefinition,
    FieldType,
    SkillDefinition,
    AppDefinition,
)
from emery_agents.dspy_modules.signatures.evaluation import (
    EvaluateGoal,
    AnalyzeRecovery,
    GoalEvaluation,
    RecoveryAction,
)

__all__ = [
    # Planning
    "CreatePlan",
    "AnalyzeTask",
    "PlanStep",
    "Plan",
    "ClarifyingQuestion",
    "PlanOrQuestions",
    # Agents
    "BuildSchema",
    "BuildSkill",
    "BuildApp",
    "TableSchema",
    "FieldDefinition",
    "FieldType",
    "SkillDefinition",
    "AppDefinition",
    # Evaluation
    "EvaluateGoal",
    "AnalyzeRecovery",
    "GoalEvaluation",
    "RecoveryAction",
]
