"""
DSPy Signatures for the Emery agent system.

Signatures define typed I/O contracts that replace Jinja2 templates.
"""

from emery_agents.reasoning.signatures.agents import (
    AppDefinition,
    BuildApp,
    BuildSchema,
    BuildSkill,
    FieldDefinition,
    FieldType,
    SkillDefinition,
    TableSchema,
)
from emery_agents.reasoning.signatures.evaluation import (
    AnalyzeRecovery,
    ClassifyInterrupt,
    EvaluateGoal,
    ExecutionInsightModel,
    ExecutionInsightsResult,
    ExtractExecutionInsights,
    # ACE signatures
    ExtractPlanningInsights,
    GoalEvaluation,
    InterruptClassificationResult,
    PlanningInsightModel,
    PlanningInsightsResult,
    RankStrategies,
    RecoveryAction,
    StrategyRankingModel,
    StrategyRankingsResult,
)
from emery_agents.reasoning.signatures.extraction import (
    SKILL_TYPE_MAP,
    create_extraction_signature,
)
from emery_agents.reasoning.signatures.planning import (
    AnalyzeGaps,
    AnalyzeTask,
    ClarifyingQuestionOutput,
    ClassifyTask,
    CreatePlan,
    CreatePlanAutonomous,
    CreateSkillTemplate,
    GapAnalysisResultModel,
    GapItemOutput,
    GeneratePlanDiff,
    PlanDiffResult,
    PlanOrQuestionsOutput,
    PlanOutput,
    PlanReflection,
    PlanStepOutput,
    QuestionType,
    ReflectOnPlan,
    SkillInputSpec,
    SkillOutputSpec,
    SkillTemplatePlanOutput,
    SkillTemplateStepOutput,
    StepModificationOutput,
    TaskClassificationResult,
    TaskComplexity,
    TaskDomain,
    TaskExecutionMode,
    TriageTask,
)

__all__ = [
    # Planning - Enums
    "TaskDomain",
    "TaskComplexity",
    "TaskExecutionMode",
    "QuestionType",
    # Planning - Models
    "PlanStepOutput",
    "PlanOutput",
    "ClarifyingQuestionOutput",
    "PlanOrQuestionsOutput",
    "PlanReflection",
    "SkillInputSpec",
    "SkillOutputSpec",
    "SkillTemplateStepOutput",
    "SkillTemplatePlanOutput",
    # Planning - Signatures
    "CreatePlan",
    "CreatePlanAutonomous",
    "AnalyzeTask",
    "ClassifyTask",
    "AnalyzeGaps",
    "TriageTask",
    "CreateSkillTemplate",
    "GeneratePlanDiff",
    "ReflectOnPlan",
    # Task Classification
    "TaskClassificationResult",
    # Gap Analysis
    "GapAnalysisResultModel",
    "GapItemOutput",
    # Plan Diffing
    "StepModificationOutput",
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
