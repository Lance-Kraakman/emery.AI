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
    ClassifyTask,
    TaskClassificationResult,
    AnalyzeGaps,
    GapAnalysisResultModel,
    GeneratePlanDiff,
    PlanDiffResult,
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
    ClassifyInterrupt,
    InterruptClassificationResult,
    # ACE signatures
    ExtractPlanningInsights,
    PlanningInsightsResult,
    PlanningInsightModel,
    ExtractExecutionInsights,
    ExecutionInsightsResult,
    ExecutionInsightModel,
    RankStrategies,
    StrategyRankingsResult,
    StrategyRankingModel,
)
from emery_agents.dspy_modules.signatures.extraction import (
    create_extraction_signature,
    SKILL_TYPE_MAP,
)

__all__ = [
    # Planning
    "CreatePlan",
    "AnalyzeTask",
    "PlanStep",
    "Plan",
    "ClarifyingQuestion",
    "PlanOrQuestions",
    # Task Classification
    "ClassifyTask",
    "TaskClassificationResult",
    # Gap Analysis
    "AnalyzeGaps",
    "GapAnalysisResultModel",
    # Plan Diffing
    "GeneratePlanDiff",
    "PlanDiffResult",
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
    # Interrupt Classification
    "ClassifyInterrupt",
    "InterruptClassificationResult",
    # ACE (Agentic Context Engineering)
    "ExtractPlanningInsights",
    "PlanningInsightsResult",
    "PlanningInsightModel",
    "ExtractExecutionInsights",
    "ExecutionInsightsResult",
    "ExecutionInsightModel",
    "RankStrategies",
    "StrategyRankingsResult",
    "StrategyRankingModel",
    # Output Extraction
    "create_extraction_signature",
    "SKILL_TYPE_MAP",
]
