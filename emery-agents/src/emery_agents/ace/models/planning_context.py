"""
Planning Context Models - phase-based context during planning.

Part of ACE (Agentic Context Engineering).
Curates context between planning phases (Schema, App, Automation, etc.)

AIDEV-NOTE: This complements execution_context.py which handles execution phase.
Planning context:
- Tracks phase goals (each phase has its own goal)
- Curates insights between phases
- Manages token budget for context passing
"""

from dataclasses import dataclass, field
from enum import Enum


class PlanningInsightType(Enum):
    """Types of insights extracted during planning."""

    ENTITY = "entity"  # Found entity (table, app, field)
    DECISION = "decision"  # Planning decision made
    CONSTRAINT = "constraint"  # Discovered limitation
    DEPENDENCY = "dependency"  # Dependency between phases


@dataclass(frozen=True)
class PhaseGoal:
    """
    Goal for a planning phase.

    Each phase has a specific goal derived from the overall instructions.
    Goals provide focus and accountability for each phase.
    """

    phase_name: str  # "Schema Implementation", "CRM App", etc.
    goal: str  # What this phase should achieve
    generated_by: str  # Which phase generated this (e.g., "Planning")


@dataclass(frozen=True)
class PlanningInsight:
    """
    Single insight extracted from planning phase output.

    Insights are distilled from raw context to preserve important
    information while managing token budget.
    """

    insight_id: str
    insight_type: PlanningInsightType
    summary: str
    key_facts: tuple[str, ...]
    source_phase: str  # Which phase produced this insight
    relevance_score: float = 1.0


@dataclass
class PlanningContext:
    """
    Context accumulated during planning, curated between phases.

    Replaces raw string concatenation with structured, goal-aware context.
    Each phase receives:
    1. Its specific goal (from phase_goals)
    2. Curated insights from completed phases (not raw context)
    """

    overall_goal: str
    phase_goals: list[PhaseGoal] = field(default_factory=list)
    insights: list[PlanningInsight] = field(default_factory=list)
    completed_phases: list[str] = field(default_factory=list)

    def add_phase_goal(
        self, phase_name: str, goal: str, generated_by: str = "Planning"
    ) -> None:
        """
        Register a phase goal.

        Called when Planning meta-phase generates phases, or when
        deriving simple goals from planner type.
        """
        self.phase_goals.append(PhaseGoal(phase_name, goal, generated_by))

    def get_phase_goal(self, phase_name: str) -> str | None:
        """Get the goal for a specific phase."""
        for pg in self.phase_goals:
            if pg.phase_name == phase_name:
                return pg.goal
        return None

    def format_for_phase(self, next_phase: str) -> str:
        """
        Format curated context for the next phase.

        Returns context including:
        1. This phase's specific goal (if registered)
        2. Relevant insights from completed phases

        Args:
            next_phase: Name of the phase receiving the context

        Returns:
            Formatted context string for the phase
        """
        parts = []

        # Include this phase's goal
        phase_goal = self.get_phase_goal(next_phase)
        if phase_goal:
            parts.append(f"## Your Goal\n{phase_goal}")

        # Include relevant insights from completed phases
        if self.completed_phases:
            parts.append(f"\n## Context from {', '.join(self.completed_phases)}")
            relevant = [i for i in self.insights if i.relevance_score > 0.3]
            relevant.sort(key=lambda x: x.relevance_score, reverse=True)
            for insight in relevant:
                parts.append(f"- [{insight.insight_type.value}] {insight.summary}")

        return "\n".join(parts) if parts else ""

    def add_insight(self, insight: PlanningInsight) -> None:
        """Add a new insight to the context."""
        self.insights.append(insight)

    def mark_phase_completed(self, phase_name: str) -> None:
        """Mark a phase as completed."""
        if phase_name not in self.completed_phases:
            self.completed_phases.append(phase_name)

    def format_context_for_plan(self) -> str:
        """
        Format discovered entities for the Plan's context field.

        Returns a summary of all ENTITY insights (what was discovered).
        """
        parts = [f"## Overall Goal\n{self.overall_goal}"]

        # Group entities by source phase
        for phase in self.completed_phases:
            phase_entities = [
                i
                for i in self.insights
                if i.source_phase == phase
                and i.insight_type == PlanningInsightType.ENTITY
            ]
            if phase_entities:
                parts.append(f"\n### {phase} - Discovered")
                for entity in phase_entities:
                    parts.append(f"- {entity.summary}")
                    for fact in entity.key_facts:
                        parts.append(f"  - {fact}")

        return "\n".join(parts) if parts else ""

    def format_analysis_for_plan(self) -> str:
        """
        Format decisions and constraints for the Plan's analysis field.

        Returns a summary of DECISION, CONSTRAINT, and DEPENDENCY insights.
        """
        parts = []

        # Group by insight type
        decisions = [
            i for i in self.insights if i.insight_type == PlanningInsightType.DECISION
        ]
        constraints = [
            i for i in self.insights if i.insight_type == PlanningInsightType.CONSTRAINT
        ]
        dependencies = [
            i for i in self.insights if i.insight_type == PlanningInsightType.DEPENDENCY
        ]

        if decisions:
            parts.append("## Decisions Made")
            for d in decisions:
                parts.append(f"- [{d.source_phase}] {d.summary}")

        if constraints:
            parts.append("\n## Constraints Identified")
            for c in constraints:
                parts.append(f"- [{c.source_phase}] {c.summary}")

        if dependencies:
            parts.append("\n## Dependencies")
            for dep in dependencies:
                parts.append(f"- [{dep.source_phase}] {dep.summary}")

        # Include phase goals as planned approach
        if self.phase_goals:
            parts.append("\n## Planned Approach")
            for pg in self.phase_goals:
                parts.append(f"- **{pg.phase_name}**: {pg.goal}")

        return "\n".join(parts) if parts else ""
