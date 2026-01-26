"""
Domain Concerns Model

Defines what each agent type needs to know to do its job.
Used for gap analysis - checking what's clear vs. unclear from user request.

AIDEV-NOTE: Each agent has domain-specific concerns. During planning,
we check which concerns are already addressed by the user's request
and only ask questions about the gaps.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class DomainConcern:
    """
    A single concern that an agent needs clarity on.

    Attributes:
        id: Unique identifier for this concern
        category: Grouping (e.g., "structure", "fields", "relationships")
        description: What the agent needs to know
        check_prompt: How to check if this is clear from context
        question_template: Template for asking user (with {placeholders})
        options_generator: Optional key for generating dynamic options
        priority: Higher = ask first (1-10)
        required: If True, must be answered before planning
    """
    id: str
    category: str
    description: str
    check_prompt: str
    question_template: str
    options_generator: Optional[str] = None
    priority: int = 5
    required: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "category": self.category,
            "description": self.description,
            "checkPrompt": self.check_prompt,
            "questionTemplate": self.question_template,
            "optionsGenerator": self.options_generator,
            "priority": self.priority,
            "required": self.required,
        }


@dataclass
class ConcernGap:
    """
    A concern that needs user clarification.

    Created during gap analysis when a concern is determined to be unclear.
    """
    concern: DomainConcern
    context_found: str  # What we found in context (if anything)
    reason_unclear: str  # Why it's still unclear
    suggested_question: str  # Formatted question to ask
    suggested_options: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "concernId": self.concern.id,
            "category": self.concern.category,
            "contextFound": self.context_found,
            "reasonUnclear": self.reason_unclear,
            "suggestedQuestion": self.suggested_question,
            "suggestedOptions": self.suggested_options,
        }


@dataclass
class GapAnalysisResult:
    """
    Result of analyzing concerns against user request.

    Contains which concerns are clear and which need questions.
    """
    agent_name: str
    clear_concerns: List[str] = field(default_factory=list)  # IDs of clear concerns
    gaps: List[ConcernGap] = field(default_factory=list)
    context_summary: str = ""  # Summary of what we understood

    @property
    def has_gaps(self) -> bool:
        """Check if there are any gaps needing questions."""
        return len(self.gaps) > 0

    @property
    def required_gaps(self) -> List[ConcernGap]:
        """Get only required gaps that must be answered."""
        return [g for g in self.gaps if g.concern.required]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agentName": self.agent_name,
            "clearConcerns": self.clear_concerns,
            "gaps": [g.to_dict() for g in self.gaps],
            "contextSummary": self.context_summary,
            "hasGaps": self.has_gaps,
        }


# =============================================================================
# Domain Concern Definitions per Agent Type
# =============================================================================

SCHEMA_BUILDER_CONCERNS: List[DomainConcern] = [
    DomainConcern(
        id="tables_needed",
        category="structure",
        description="What tables/entities need to be created",
        check_prompt="Are the tables or entities to create explicitly listed or clearly implied?",
        question_template="What tables do you need? For example: {examples}",
        priority=10,
        required=True,
    ),
    DomainConcern(
        id="table_purpose",
        category="structure",
        description="Purpose/use case of each table",
        check_prompt="Is the purpose of each table clear from the request?",
        question_template="What is the purpose of the {table_name} table?",
        priority=8,
        required=False,
    ),
    DomainConcern(
        id="key_fields",
        category="fields",
        description="Important fields for each table",
        check_prompt="Are the key fields for each table specified or clearly implied?",
        question_template="What fields should the {table_name} table have?",
        options_generator="common_fields",
        priority=9,
        required=True,
    ),
    DomainConcern(
        id="field_types",
        category="fields",
        description="Data types for fields (text, number, date, etc.)",
        check_prompt="Are there any special data type requirements mentioned?",
        question_template="What type of data should {field_name} store?",
        options_generator="data_types",
        priority=5,
        required=False,
    ),
    DomainConcern(
        id="relationships",
        category="relationships",
        description="How tables relate to each other",
        check_prompt="If multiple tables, are relationships between them clear?",
        question_template="How should {table1} and {table2} be related?",
        options_generator="relationship_types",
        priority=7,
        required=True,
    ),
    DomainConcern(
        id="constraints",
        category="validation",
        description="Required fields, unique constraints, etc.",
        check_prompt="Are there any validation requirements or constraints mentioned?",
        question_template="Are there any required fields or constraints for {table_name}?",
        priority=4,
        required=False,
    ),
    DomainConcern(
        id="existing_integration",
        category="integration",
        description="How new tables integrate with existing schema",
        check_prompt="If there's existing schema, is the integration approach clear?",
        question_template="How should the new tables integrate with existing data?",
        priority=6,
        required=False,
    ),
]

SKILL_BUILDER_CONCERNS: List[DomainConcern] = [
    DomainConcern(
        id="skill_purpose",
        category="purpose",
        description="What the skill should accomplish",
        check_prompt="Is the overall purpose of the skill clear?",
        question_template="What should this skill do? What's the end goal?",
        priority=10,
        required=True,
    ),
    DomainConcern(
        id="trigger_conditions",
        category="workflow",
        description="When/how the skill should be triggered",
        check_prompt="Is it clear when or how this skill should run?",
        question_template="When should this skill run? (manual, scheduled, triggered by event?)",
        options_generator="trigger_types",
        priority=8,
        required=True,
    ),
    DomainConcern(
        id="input_data",
        category="data",
        description="What data the skill needs as input",
        check_prompt="Is the input data for the skill specified?",
        question_template="What data does this skill need as input?",
        priority=7,
        required=True,
    ),
    DomainConcern(
        id="output_actions",
        category="workflow",
        description="What actions/outputs the skill produces",
        check_prompt="Are the expected outputs or actions clear?",
        question_template="What should happen when this skill runs? What's the output?",
        priority=7,
        required=True,
    ),
    DomainConcern(
        id="workflow_steps",
        category="workflow",
        description="Step-by-step process the skill follows",
        check_prompt="Is the workflow or process clear?",
        question_template="What steps should this skill follow?",
        priority=6,
        required=False,
    ),
    DomainConcern(
        id="error_handling",
        category="reliability",
        description="How to handle errors or edge cases",
        check_prompt="Are there any error handling requirements mentioned?",
        question_template="How should errors be handled? (retry, notify, skip?)",
        options_generator="error_strategies",
        priority=4,
        required=False,
    ),
    DomainConcern(
        id="permissions",
        category="security",
        description="Who can run this skill",
        check_prompt="Are there any permission or access requirements?",
        question_template="Who should be able to run this skill?",
        priority=3,
        required=False,
    ),
]

DOCUMENT_BUILDER_CONCERNS: List[DomainConcern] = [
    DomainConcern(
        id="document_type",
        category="structure",
        description="Type of document to create",
        check_prompt="Is the document type clear (report, template, form, etc.)?",
        question_template="What type of document do you need?",
        options_generator="document_types",
        priority=10,
        required=True,
    ),
    DomainConcern(
        id="document_purpose",
        category="purpose",
        description="Purpose/audience of the document",
        check_prompt="Is the purpose and intended audience clear?",
        question_template="What is this document for? Who will use it?",
        priority=8,
        required=True,
    ),
    DomainConcern(
        id="content_sections",
        category="structure",
        description="Main sections or content areas",
        check_prompt="Are the main sections or content areas specified?",
        question_template="What sections should this document have?",
        priority=7,
        required=True,
    ),
    DomainConcern(
        id="data_source",
        category="data",
        description="Where content comes from",
        check_prompt="Is the data source for the content clear?",
        question_template="Where should the content come from? (manual entry, database, etc.)",
        priority=6,
        required=False,
    ),
    DomainConcern(
        id="formatting",
        category="style",
        description="Formatting or style requirements",
        check_prompt="Are there any specific formatting requirements?",
        question_template="Are there any formatting requirements? (branding, style, etc.)",
        priority=4,
        required=False,
    ),
]

# Registry mapping agent names to their concerns
AGENT_CONCERNS: Dict[str, List[DomainConcern]] = {
    "schema_builder": SCHEMA_BUILDER_CONCERNS,
    "skill_builder": SKILL_BUILDER_CONCERNS,
    "document_builder": DOCUMENT_BUILDER_CONCERNS,
}


def get_concerns_for_agent(agent_name: str) -> List[DomainConcern]:
    """
    Get domain concerns for an agent type.

    Args:
        agent_name: Name of the agent (e.g., "schema_builder")

    Returns:
        List of DomainConcern for that agent type, sorted by priority
    """
    concerns = AGENT_CONCERNS.get(agent_name, [])
    return sorted(concerns, key=lambda c: c.priority, reverse=True)


def get_required_concerns(agent_name: str) -> List[DomainConcern]:
    """Get only required concerns for an agent."""
    return [c for c in get_concerns_for_agent(agent_name) if c.required]
