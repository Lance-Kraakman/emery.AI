"""
DSPy Signatures for the Emery agent system.

Signatures define typed I/O contracts that replace Jinja2 templates.
"""

from emery_agents.reasoning.signatures.planning import (
    CreatePlan,
    AnalyzeTask,
    PlanStepOutput,
    PlanOutput,
    ClarifyingQuestionOutput,
    PlanOrQuestionsOutput,
    ClassifyTask,
    TaskClassificationResult,
    AnalyzeGaps,
    GapAnalysisResultModel,
    GeneratePlanDiff,
    PlanDiffResult,
    StepModificationOutput,
)
from emery_agents.reasoning.signatures.agents import (
    BuildSchema,
    BuildSkill,
    BuildApp,
    TableSchema,
    FieldDefinition,
    FieldType,
    SkillDefinition,
    AppDefinition,
)
from emery_agents.reasoning.signatures.evaluation import (
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
from emery_agents.reasoning.signatures.extraction import (
    create_extraction_signature,
    SKILL_TYPE_MAP,
)

__all__ = [
    # Planning (DSPy output schemas)
    "CreatePlan",
    "AnalyzeTask",
    "PlanStepOutput",
    "PlanOutput",
    "ClarifyingQuestionOutput",
    "PlanOrQuestionsOutput",
    # Task Classification
    "ClassifyTask",
    "TaskClassificationResult",
    # Gap Analysis
    "AnalyzeGaps",
    "GapAnalysisResultModel",
    # Plan Diffing
    "GeneratePlanDiff",
    "PlanDiffResult",
    "StepModificationOutput",
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
