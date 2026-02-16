"""
DSPy Signatures for planning operations.

These signatures replace the Jinja2 planning templates with typed I/O contracts.
"""

from __future__ import annotations

# Enums
from .enums import (
    QuestionType,
    TaskComplexity,
    TaskDomain,
    TaskExecutionMode,
)

# Models
from .models import (
    ClarifyingQuestionOutput,
    GapAnalysisResultModel,
    GapItemOutput,
    PlanDiffResult,
    PlanOrQuestionsOutput,
    PlanOutput,
    PlanReflection,
    PlanStepOutput,
    RecordContext,
    SkillInputSpec,
    SkillOutputSpec,
    SkillTemplatePlanOutput,
    SkillTemplateStepOutput,
    StepModificationOutput,
    TaskClassificationResult,
    TriageAnalysis,
)

# Signatures
from .analysis import AnalyzeGaps, AnalyzeTask, ClassifyTask
from .create_plan import CreatePlan
from .create_plan_auto import CreatePlanAutonomous
from .replan import GeneratePlanDiff, ReflectOnPlan
from .skill_template import CreateSkillTemplate
from .triage import TriageTask

__all__ = [
    # Enums
    "TaskDomain",
    "TaskComplexity",
    "TaskExecutionMode",
    "QuestionType",
    # Models - Plan
    "PlanStepOutput",
    "PlanOutput",
    "ClarifyingQuestionOutput",
    "PlanOrQuestionsOutput",
    # Models - Record Context
    "RecordContext",
    # Models - Triage Analysis
    "TriageAnalysis",
    # Models - Classification
    "TaskClassificationResult",
    # Models - Gap Analysis
    "GapItemOutput",
    "GapAnalysisResultModel",
    # Models - Plan Diff
    "StepModificationOutput",
    "PlanDiffResult",
    # Models - Reflection
    "PlanReflection",
    # Models - Skill Template
    "SkillInputSpec",
    "SkillOutputSpec",
    "SkillTemplateStepOutput",
    "SkillTemplatePlanOutput",
    # Signatures - Planning
    "CreatePlan",
    "CreatePlanAutonomous",
    # Signatures - Analysis
    "AnalyzeTask",
    "ClassifyTask",
    "AnalyzeGaps",
    # Signatures - Triage
    "TriageTask",
    # Signatures - Skill Template
    "CreateSkillTemplate",
    # Signatures - Replanning
    "GeneratePlanDiff",
    "ReflectOnPlan",
]
