"""
Sub-Agent Planner - Orchestrates planning phase for managed agents.

Uses proven HITL pattern: planning_interval + step_callbacks + interrupt.
Each sub-agent runs in planning-only mode to generate detailed sub-plans.

AIDEV-NOTE: Two-phase question generation:
1. Gap Analysis: Check domain concerns against user request to find gaps
2. Planning: If no gaps (or after answers), agent creates detailed plan

Gap analysis ensures we only ask about genuinely unclear things,
not things the user already specified.

RECURSIVE CASCADE PLANNING:
When a sub-plan step references another managed agent, we recursively
plan for that nested agent. This creates a tree of detailed plans:

    Main Planner → app_builder
                        ↓
                  sub-plan A with steps:
                        ├─ Step 1: Create app
                        ├─ Step 2: page_builder creates Home page ← DETECTED
                        │              ↓
                        │         RECURSIVE: page_builder sub-plan
                        │              ├─ Step 2a: Add Hero
                        │              └─ Step 2b: Add Features
                        └─ Step 3: Publish
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from smolagents.agents import CodeAgent
from smolagents.memory import PlanningStep

from ..models.plan import PlanStep, SubPlan, create_step
from ..models.planning_questions import AgentQuestion, BatchedQuestions
from ..models.domain_concerns import ConcernGap, GapAnalysisResult
from ..tools.ask_question_tool import AskQuestionTool

if TYPE_CHECKING:
    from .gap_analyzer import GapAnalyzer
    from .task_classifier import TaskClassifier
    from .protocols import ModelProvider

logger = logging.getLogger(__name__)


@dataclass
class SubAgentPlanningResult:
    """Result from sub-agent planning phase."""

    success: bool
    sub_plan: Optional[SubPlan] = None
    questions: List[AgentQuestion] = field(default_factory=list)
    agent_state: Optional[Any] = None  # StatefulManagedAgent for resume
    error: Optional[str] = None

    @property
    def needs_questions(self) -> bool:
        """Check if user input is needed."""
        return len(self.questions) > 0


# Type alias for agent factory functions
AgentFactory = Callable[..., Any]


class SubAgentPlanner:
    """
    Orchestrates sub-agent planning using existing HITL patterns.

    Two-phase approach:
    1. Gap Analysis: Check domain concerns → identify what's unclear
    2. Planning: If no gaps, create detailed plan

    Supports RECURSIVE CASCADE PLANNING:
    When a sub-plan step references another managed agent, we recursively
    plan for that nested agent, creating a tree of detailed plans.

    This ensures we only ask questions about genuinely missing info,
    not things the user already specified.
    """

    def __init__(
        self,
        agent_factories: Dict[str, AgentFactory],
        original_task: str,
        model: Any,
        gap_analyzer: Optional["GapAnalyzer"] = None,
        max_planning_rounds: int = 3,
        max_depth: int = 3,
        model_provider: Optional["ModelProvider"] = None,
        org_model: Optional[str] = None,
    ):
        """
        Initialize SubAgentPlanner.

        Args:
            agent_factories: Dict mapping agent_name to factory function
            original_task: Full user request for context
            model: LLM model to use
            gap_analyzer: Analyzer for checking domain concerns (optional)
            max_planning_rounds: Max iterations for question rounds
            max_depth: Maximum recursion depth for nested agent planning (default: 3)
            model_provider: Provider for LLM access (used for step classification)
            org_model: Organization model ID for model resolution
        """
        self.agent_factories = agent_factories
        self.original_task = original_task
        self.model = model
        self.gap_analyzer = gap_analyzer
        self.max_planning_rounds = max_planning_rounds
        self.max_depth = max_depth
        self.model_provider = model_provider
        self.org_model = org_model
        self._agent_states: Dict[str, Any] = {}
        self._collected_questions: List[AgentQuestion] = []
        self._planning_round: int = 1
        self._gap_results: Dict[str, GapAnalysisResult] = {}  # Cache gap analysis per step
        self._task_classifier: Optional["TaskClassifier"] = None

        # Initialize TaskClassifier for step → agent classification
        if model_provider:
            from .task_classifier import TaskClassifier
            self._task_classifier = TaskClassifier(model_provider=model_provider)

    def run_planning(
        self,
        step: PlanStep,
        agent_name: str,
        gathered_context: Optional[str] = None,
        parent_context: Optional[str] = None,
        depth: int = 0,
    ) -> SubAgentPlanningResult:
        """
        Run sub-agent in planning-only mode with optional recursive planning.

        Two-phase approach:
        1. Gap Analysis: Check domain concerns to identify missing info
        2. Planning: If no gaps, create detailed plan

        After planning, if depth < max_depth, checks sub-plan steps for
        managed agent references and recursively plans those.

        Args:
            step: Parent PlanStep this sub-agent will detail
            agent_name: Name of agent to use
            gathered_context: Optional context from previous tools (e.g., list of tables)
            parent_context: Context from parent agent's planning (for nested agents)
            depth: Current recursion depth (0 = top-level)

        Returns:
            SubAgentPlanningResult with sub_plan and/or questions
        """
        if agent_name not in self.agent_factories:
            return SubAgentPlanningResult(
                success=False,
                error=f"Unknown agent: {agent_name}",
            )

        # Check max depth
        if depth >= self.max_depth:
            logger.warning(
                f"📋 Max depth {self.max_depth} reached at {agent_name}, "
                f"skipping recursive planning for step: {step.description[:40]}..."
            )
            # Still run planning, just don't recurse into nested agents
            return self._run_agent_planning(step, agent_name, gathered_context)

        # Merge contexts: gathered_context + parent_context
        full_context = self._merge_contexts(gathered_context, parent_context)

        # Phase 1: Gap Analysis - Check what's clear vs unclear
        if self.gap_analyzer:
            gap_result = self.gap_analyzer.analyze(
                agent_name=agent_name,
                user_request=self.original_task,
                gathered_context=full_context,
            )
            self._gap_results[step.step_id] = gap_result

            # If there are gaps, convert to questions and return early
            if gap_result.has_gaps:
                questions = self._gaps_to_questions(gap_result, step.step_id)
                self._collected_questions.extend(questions)

                logger.info(
                    f"📋 Gap analysis for {agent_name} (depth={depth}): "
                    f"{len(gap_result.clear_concerns)} clear, "
                    f"{len(gap_result.gaps)} gaps"
                )

                # Store minimal state for resume
                self._agent_states[step.step_id] = {
                    "agent": None,  # No agent created yet
                    "gap_result": gap_result,
                    "depth": depth,
                    "parent_context": parent_context,
                }

                return SubAgentPlanningResult(
                    success=True,
                    sub_plan=None,  # Can't plan yet - need answers
                    questions=questions,
                    agent_state=None,
                )

            logger.info(
                f"✅ Gap analysis for {agent_name} (depth={depth}): All concerns clear, proceeding to plan"
            )

        # Phase 2: Planning - Create detailed plan
        result = self._run_agent_planning(step, agent_name, full_context)

        # Phase 3: Recursive planning for nested agents
        if result.success and result.sub_plan and depth < self.max_depth:
            result = self._enhance_with_nested_plans(result, depth)

        return result

    def _merge_contexts(
        self,
        gathered_context: Optional[str],
        parent_context: Optional[str],
    ) -> Optional[str]:
        """Merge gathered context with parent's planning observations."""
        if gathered_context and parent_context:
            return f"{gathered_context}\n\n## Parent Agent Context\n{parent_context}"
        return gathered_context or parent_context

    def _run_agent_planning(
        self,
        step: PlanStep,
        agent_name: str,
        gathered_context: Optional[str] = None,
    ) -> SubAgentPlanningResult:
        """
        Run the actual agent planning (after gap analysis passes).

        Uses smolagents pattern:
        - planning_interval for context gathering
        - step_callbacks to capture plan + interrupt
        """
        captured_plan: Optional[str] = None

        # Create question tool (for any additional questions during planning)
        question_tool = AskQuestionTool()

        def planning_callback(memory_step: PlanningStep, agent: CodeAgent) -> None:
            nonlocal captured_plan
            captured_plan = memory_step.plan
            # Always interrupt - we're in planning-only mode
            agent.interrupt()

        # Create agent with planning callback and question tool
        try:
            agent = self.agent_factories[agent_name](
                planning_callback=planning_callback,
                planning_only=True,
                extra_tools=[question_tool],  # Agent can ask additional questions
            )
        except Exception as e:
            logger.error(f"Failed to create agent {agent_name}: {e}")
            return SubAgentPlanningResult(success=False, error=str(e))

        # Build planning task with any answered questions
        task = self._build_planning_task(step, gathered_context)

        logger.info(
            f"📋 Running {agent_name} planning for: {step.description[:50]}..."
        )

        try:
            agent(task)
        except Exception as e:
            error_str = str(e).lower()
            if "interrupt" in error_str or "stopped" in error_str:
                # Expected - we interrupted after planning
                pass
            else:
                logger.error(f"Sub-agent planning failed: {e}")
                return SubAgentPlanningResult(success=False, error=str(e))

        # Store agent state and question tool for potential resume
        self._agent_states[step.step_id] = {
            "agent": agent,
            "question_tool": question_tool,
        }

        # Collect any additional questions from the agent
        collected_questions = self._collect_questions_from_tool(
            question_tool, agent_name, step.step_id
        )
        self._collected_questions.extend(collected_questions)

        # Parse captured plan
        sub_plan = None
        if captured_plan:
            sub_plan = self._parse_plan(captured_plan, agent_name)
            logger.info(
                f"✅ Sub-plan created for {agent_name}: {len(sub_plan.steps)} steps"
            )

        if collected_questions:
            logger.info(
                f"❓ Agent asked {len(collected_questions)} additional questions"
            )

        return SubAgentPlanningResult(
            success=True,
            sub_plan=sub_plan,
            questions=collected_questions,
            agent_state=agent,
        )

    def _enhance_with_nested_plans(
        self,
        result: SubAgentPlanningResult,
        depth: int,
    ) -> SubAgentPlanningResult:
        """
        Recursively plan managed agents referenced in sub-plan steps.

        For each step in the sub-plan, checks if it references a managed agent.
        If so, runs recursive planning for that nested agent.

        Args:
            result: The planning result to enhance
            depth: Current recursion depth

        Returns:
            Enhanced SubAgentPlanningResult with nested sub-plans attached
        """
        if not result.sub_plan or not result.sub_plan.steps:
            return result

        processed_steps: List[PlanStep] = []
        nested_agent_count = 0

        for step in result.sub_plan.steps:
            nested_agent = self._detect_managed_agent(step)

            if nested_agent and nested_agent in self.agent_factories:
                logger.info(
                    f"📋 Depth {depth + 1}: Detected {nested_agent} in step: "
                    f"'{step.description[:40]}...'"
                )

                # Recursively plan the nested agent
                nested_result = self.run_planning(
                    step=step,
                    agent_name=nested_agent,
                    depth=depth + 1,
                    parent_context=result.sub_plan.planning_observations,
                )

                if nested_result.success and nested_result.sub_plan:
                    # Attach nested sub-plan to this step
                    processed_steps.append(step.with_sub_plan(nested_result.sub_plan))
                    nested_agent_count += 1

                    # Collect questions from nested agent
                    if nested_result.questions:
                        self._collected_questions.extend(nested_result.questions)
                        logger.info(
                            f"📋 Collected {len(nested_result.questions)} questions "
                            f"from nested {nested_agent}"
                        )
                    continue

            # No nested agent detected, or planning failed - keep step as-is
            processed_steps.append(step)

        if nested_agent_count > 0:
            logger.info(
                f"✅ Enhanced sub-plan with {nested_agent_count} nested agent sub-plans "
                f"at depth {depth}"
            )

        return SubAgentPlanningResult(
            success=True,
            sub_plan=result.sub_plan.with_steps(processed_steps),
            questions=result.questions,
            agent_state=result.agent_state,
        )

    def _detect_managed_agent(self, step: PlanStep) -> Optional[str]:
        """
        Detect if a step references a managed agent.

        Uses LLM-based classification if TaskClassifier is available,
        falls back to pattern matching otherwise.

        Args:
            step: The plan step to analyze

        Returns:
            Agent name if detected, None otherwise
        """
        # Fast path: check if already set
        if step.target_agent and step.target_agent in self.agent_factories:
            return step.target_agent

        # Try LLM classification first (more accurate)
        if self._task_classifier:
            from .task_classifier import StepClassification

            classification = self._task_classifier.classify_step(
                step_description=step.description,
                available_agents=list(self.agent_factories.keys()),
                org_model=self.org_model,
            )

            if classification.target_agent and classification.confidence > 0.7:
                logger.debug(
                    f"🔍 LLM classified step → {classification.target_agent} "
                    f"({classification.confidence:.0%} confidence)"
                )
                return classification.target_agent

        # Fallback: Pattern matching against agent names
        desc_lower = step.description.lower()
        for agent_name in self.agent_factories.keys():
            # Check for explicit agent name references
            if agent_name.replace('_', ' ') in desc_lower:
                logger.debug(f"🔍 Pattern matched step → {agent_name}")
                return agent_name
            if agent_name.replace('_', '') in desc_lower:
                logger.debug(f"🔍 Pattern matched step → {agent_name}")
                return agent_name

            # Check for common delegation phrases
            delegation_patterns = [
                f"{agent_name} creates",
                f"{agent_name} builds",
                f"delegate to {agent_name}",
                f"using {agent_name}",
            ]
            for pattern in delegation_patterns:
                if pattern.replace('_', ' ') in desc_lower:
                    logger.debug(f"🔍 Delegation pattern matched step → {agent_name}")
                    return agent_name

        return None

    def _gaps_to_questions(
        self,
        gap_result: GapAnalysisResult,
        step_id: str,
    ) -> List[AgentQuestion]:
        """
        Convert gap analysis gaps to AgentQuestions.

        Args:
            gap_result: Result from gap analysis
            step_id: ID of the parent step

        Returns:
            List of AgentQuestion ready for UI
        """
        questions: List[AgentQuestion] = []

        for i, gap in enumerate(gap_result.gaps):
            questions.append(AgentQuestion(
                question_id=f"{gap_result.agent_name}_{step_id}_gap_{i}",
                agent_name=gap_result.agent_name,
                step_id=step_id,
                question=gap.suggested_question,
                options=gap.suggested_options,
                context=gap.reason_unclear,
            ))

        return questions

    def resume_with_answers(
        self,
        step_id: str,
        answers: Dict[str, str],
    ) -> SubAgentPlanningResult:
        """
        Resume sub-agent planning with user's answers.

        Args:
            step_id: ID of the step to resume planning for
            answers: Dict mapping question_id to user's answer

        Returns:
            SubAgentPlanningResult with completed sub_plan
        """
        agent_state = self._agent_states.get(step_id)
        if not agent_state:
            return SubAgentPlanningResult(
                success=False,
                error="No agent state to resume",
            )

        # Extract agent from stored state (which is now a dict)
        if isinstance(agent_state, dict):
            agent = agent_state.get("agent")
        else:
            # Legacy format - agent_state is the agent itself
            agent = agent_state

        if not agent:
            return SubAgentPlanningResult(
                success=False,
                error="No agent found in state",
            )

        # Build answer context
        answer_text = "\n".join([f"- {q}: {a}" for q, a in answers.items()])
        resume_task = f"""User provided these answers to your questions:

{answer_text}

Continue planning with this information. Create your detailed plan."""

        captured_plan: Optional[str] = None

        def planning_callback(memory_step: PlanningStep, agent_obj: CodeAgent) -> None:
            nonlocal captured_plan
            captured_plan = memory_step.plan
            agent_obj.interrupt()

        # Update callback for resume
        if hasattr(agent, "step_callbacks"):
            agent.step_callbacks = {PlanningStep: planning_callback}

        logger.info(f"📋 Resuming planning for step {step_id} with answers")

        try:
            # Resume with preserved memory (reset=False)
            agent(resume_task)
        except Exception as e:
            error_str = str(e).lower()
            if "interrupt" in error_str or "stopped" in error_str:
                pass
            else:
                logger.error(f"Resume planning failed: {e}")
                return SubAgentPlanningResult(success=False, error=str(e))

        # Parse the final plan
        sub_plan = None
        agent_name = "unknown"
        if hasattr(agent, "name"):
            agent_name = agent.name

        if captured_plan:
            sub_plan = self._parse_plan(captured_plan, agent_name)

        return SubAgentPlanningResult(
            success=True,
            sub_plan=sub_plan,
            questions=[],  # Should have no more questions after answers
            agent_state=agent,
        )

    def get_all_questions(self) -> BatchedQuestions:
        """Get all collected questions from all agents."""
        return BatchedQuestions(
            questions=self._collected_questions,
            planning_round=self._planning_round,
        )

    def clear_questions(self) -> None:
        """Clear collected questions for next round."""
        self._collected_questions = []
        self._planning_round += 1

    def _build_planning_task(
        self,
        step: PlanStep,
        gathered_context: Optional[str] = None,
        answered_questions: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Build task prompt for planning-only mode.

        Args:
            step: The step to plan
            gathered_context: Context from tools (e.g., existing tables)
            answered_questions: User's answers to gap analysis questions
        """
        context_section = ""
        if gathered_context:
            context_section = f"""
## Gathered Context
{gathered_context}
"""

        answers_section = ""
        if answered_questions:
            answers_text = "\n".join([
                f"- {q}: {a}" for q, a in answered_questions.items()
            ])
            answers_section = f"""
## User's Answers (from clarifying questions)
{answers_text}

Use these answers to inform your plan. Do NOT ask about things already answered.
"""

        return f"""PLANNING MODE: Create a detailed plan based on the information provided.

## Original User Request
{self.original_task}

## Your Task
{step.description}
{context_section}{answers_section}
## Instructions

1. Review the user's request and any provided answers
2. Create a detailed step-by-step plan
3. Only ask additional questions if something critical is STILL unclear
4. Your plan should be COMPLETE and SPECIFIC

Output numbered steps describing exactly what will be done.
"""

    def _collect_questions_from_tool(
        self,
        question_tool: AskQuestionTool,
        agent_name: str,
        step_id: str,
    ) -> List[AgentQuestion]:
        """
        Collect structured questions from the AskQuestionTool.

        This is the PRIMARY method for collecting questions.
        Questions captured via tool calls have proper options and context.

        Args:
            question_tool: The tool instance used by the agent
            agent_name: Name of the agent that asked questions
            step_id: ID of the parent step

        Returns:
            List of AgentQuestion with structured data
        """
        questions: List[AgentQuestion] = []

        for i, q_data in enumerate(question_tool.get_questions()):
            questions.append(
                AgentQuestion(
                    question_id=f"{agent_name}_{step_id}_{i}",
                    agent_name=agent_name,
                    step_id=step_id,
                    question=q_data.get("question", ""),
                    options=q_data.get("options"),  # Now properly populated!
                    context=q_data.get("context"),  # Now properly populated!
                )
            )

        return questions

    def _extract_questions_fallback(
        self,
        plan_text: str,
        agent_name: str,
        step_id: str,
    ) -> List[AgentQuestion]:
        """
        FALLBACK: Extract questions from plan text via pattern matching.

        This is a BACKUP method for when the agent doesn't use ask_clarifying_question.
        Prefer _collect_questions_from_tool which provides structured data.

        Looks for question patterns where agent is asking for clarification.
        """
        if not plan_text:
            return []

        questions: List[AgentQuestion] = []
        lines = plan_text.split("\n")

        # Keywords indicating a question needing user input
        question_keywords = [
            "should i",
            "do you want",
            "would you like",
            "which",
            "how many",
            "what type",
            "prefer",
            "clarify",
            "need to know",
        ]

        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            # Check if line contains question mark and question keywords
            if "?" in line and any(kw in line_lower for kw in question_keywords):
                questions.append(
                    AgentQuestion(
                        question_id=f"{agent_name}_{step_id}_{i}",
                        agent_name=agent_name,
                        step_id=step_id,
                        question=line.strip(),
                    )
                )

        if questions:
            logger.info(
                f"📋 Extracted {len(questions)} questions from {agent_name}"
            )

        return questions

    def _parse_plan(self, plan_text: str, agent_name: str) -> SubPlan:
        """
        Parse plan text into SubPlan structure.

        Extracts goal from first line, steps from numbered/bulleted items.
        """
        if not plan_text:
            return SubPlan(
                agent_name=agent_name,
                goal="Execute plan",
                steps=[],
            )

        lines = plan_text.strip().split("\n")

        # Extract goal (first non-empty line or first line before steps)
        goal = "Execute plan"
        for line in lines:
            line = line.strip()
            if line and not re.match(r"^[\d\.\-\*]+\s", line):
                goal = line[:200]
                break

        # Parse numbered/bulleted steps
        steps: List[PlanStep] = []
        step_pattern = r"^[\d\.\-\*]+\s*(.+)$"

        for line in lines:
            match = re.match(step_pattern, line.strip())
            if match:
                step_desc = match.group(1).strip()
                # Skip if this looks like a question
                if step_desc and "?" not in step_desc:
                    steps.append(create_step(description=step_desc))

        # Fallback: if no structured steps found, create single step
        if not steps:
            # Use first 200 chars of plan as single step
            clean_text = plan_text.replace("\n", " ").strip()[:200]
            steps = [create_step(description=clean_text)]

        return SubPlan(
            agent_name=agent_name,
            goal=goal,
            steps=steps,
            planning_observations=plan_text,
        )
