"""
Task Classifier - LLM-based task classification for routing decisions.

AIDEV-NOTE: Replaces brittle string-matching patterns with intelligent LLM-based
classification. Uses the proven tool-based structured output pattern (like
EvaluatorAgent and GapAnalyzer) for reliable results.

The classifier determines:
1. Execution mode: DIRECT (simple) or PLAN_AND_APPROVE (complex)
2. Whether clarification questions should be asked first
3. Which agent should handle the task (if clear)
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent

from .protocols import ModelProvider
from ..prompts import render_template
from ..tools.task_classifier_tool import TaskClassifierTool

logger = logging.getLogger(__name__)


@dataclass
class TaskClassification:
    """Result of task classification."""

    mode: str  # "DIRECT" or "PLAN_AND_APPROVE"
    needs_clarification: bool
    target_agent: Optional[str] = None
    clarification_questions: List[str] = field(default_factory=list)
    reasoning: str = ""
    use_cascade_planning: bool = False  # True if task involves multiple agents needing sub-planning


@dataclass
class StepClassification:
    """Result of step → agent classification for recursive cascade planning."""

    target_agent: Optional[str] = None  # Agent that should handle this step, or None
    confidence: float = 0.0  # 0.0 to 1.0
    reasoning: str = ""


class TaskClassifier:
    """
    LLM-based task classification for routing decisions.

    Uses a ToolCallingAgent with TaskClassifierTool to classify tasks
    and determine execution mode. This replaces string-matching patterns
    with intelligent LLM-based classification.

    Classification decisions:
    - DIRECT: Simple, clear command with all details provided
    - PLAN_AND_APPROVE: Complex task, multiple steps, or needs clarification

    When needs_clarification is True, questions are returned to be shown
    to the user before proceeding with execution.

    AIDEV-NOTE: The classifier can use research_agent as a managed agent for
    comprehensive context gathering (apps, tables, URLs) before deciding
    whether clarification is needed.
    """

    def __init__(
        self,
        model_provider: ModelProvider,
        research_agent: Optional[Any] = None,
    ):
        """
        Initialize the task classifier.

        Args:
            model_provider: Provider for LLM access
            research_agent: Optional research agent for comprehensive context gathering
                           (web research + system introspection via research_emery)
        """
        self.model_provider = model_provider
        self.research_agent = research_agent

    def classify(
        self,
        task: str,
        available_agents: Optional[List[Dict[str, Any]]] = None,
        context: Optional[str] = None,
        org_model: Optional[str] = None,
    ) -> TaskClassification:
        """
        Classify a task to determine execution mode and questions.

        Uses ToolCallingAgent with TaskClassifierTool for structured output.
        The LLM analyzes the task and reports its classification via the tool.

        Args:
            task: The user's task/request text
            available_agents: Agent info dicts with 'name' and 'description' keys
            context: Additional context (e.g., existing databases)
            org_model: Organization model ID for model resolution hierarchy

        Returns:
            TaskClassification with mode, clarification needs, and questions
        """
        logger.info(f"🔍 Classifying task: {task[:100]}...")

        prompt = self._build_prompt(task, available_agents, context)
        tool = TaskClassifierTool()

        try:
            # Use resolved model from organization hierarchy
            model_id = self.model_provider.resolve_model_selection(org_model=org_model)
            model = self.model_provider.get_model(model_id=model_id)

            # Build tools list: just the classifier tool
            # Context gathering is done via research_agent (managed agent)
            tools = [tool]

            # Add research_agent as managed agent if available
            managed_agents = [self.research_agent] if self.research_agent else None
            if managed_agents:
                logger.info(f"🔍 Classifier has research_agent for context gathering")

            classifier = ToolCallingAgent(
                tools=tools,
                model=model,
                max_steps=8,  # Allow research + context gathering + classify
                managed_agents=managed_agents,
            )
            classifier.run(prompt)

            result = tool.get_result()
            if result:
                classification = TaskClassification(**result)
                logger.info(
                    f"✅ Classification: mode={classification.mode}, "
                    f"needs_clarification={classification.needs_clarification}, "
                    f"target_agent={classification.target_agent}, "
                    f"cascade={classification.use_cascade_planning}"
                )
                if classification.clarification_questions:
                    logger.info(
                        f"📋 Questions to ask: {classification.clarification_questions}"
                    )
                return classification

            # Fallback if tool not called
            logger.warning("⚠️ Classifier did not call tool, using fallback")
            return self._fallback_classification(task)

        except Exception as e:
            logger.error(f"❌ Classification failed: {e}")
            return self._fallback_classification(task)

    def _build_prompt(
        self,
        task: str,
        available_agents: Optional[List[Dict[str, Any]]],
        context: Optional[str],
    ) -> str:
        """Build the classification prompt using jinja template."""
        return render_template(
            "planning/task_classifier.j2",
            task=task,
            available_agents=available_agents or [],
            context=context,
        )

    def _fallback_classification(self, task: str) -> TaskClassification:
        """
        Fallback classification when LLM fails.

        Defaults to PLAN_AND_APPROVE without clarification questions.
        Classification is an optimization, not a requirement - if it fails,
        we should proceed with planning rather than blocking the user.
        """
        return TaskClassification(
            mode="PLAN_AND_APPROVE",
            needs_clarification=False,
            target_agent=None,
            clarification_questions=[],
            reasoning="Proceeding with planning (classification unavailable)",
            use_cascade_planning=False,
        )

    def classify_step(
        self,
        step_description: str,
        available_agents: List[str],
        org_model: Optional[str] = None,
    ) -> StepClassification:
        """
        Classify which agent should handle a sub-plan step.

        Used in recursive cascade planning to detect when a step
        references a managed agent that needs its own sub-planning.

        Args:
            step_description: The step description text to analyze
            available_agents: List of agent names that could handle the step
            org_model: Organization model ID for model resolution

        Returns:
            StepClassification with target_agent and confidence
        """
        if not available_agents:
            return StepClassification(
                target_agent=None,
                confidence=0.0,
                reasoning="No available agents to classify against",
            )

        logger.debug(f"🔍 Classifying step: {step_description[:60]}...")

        # Build classification prompt
        agent_list = ", ".join(available_agents)
        prompt = f"""Analyze this step and determine which agent should handle it.

Step: {step_description}

Available agents: {agent_list}

Rules:
1. If the step clearly references one of these agents (e.g., "page_builder creates...",
   "delegate to table_builder", "schema_builder designs..."), return that agent name.
2. If the step describes work that matches an agent's domain but doesn't explicitly name it,
   still return the appropriate agent with moderate confidence.
3. If the step doesn't need delegation to any specific agent (e.g., it's a simple tool call
   or coordination step), return "none".

Return JSON only: {{"agent": "agent_name or none", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}"""

        try:
            # Get model and run simple completion
            model_id = self.model_provider.resolve_model_selection(org_model=org_model)
            model = self.model_provider.get_model(model_id=model_id)

            # Use direct model call for simple classification
            response = model(prompt)

            # Extract JSON from response (handle markdown code blocks)
            response_text = str(response)
            json_match = re.search(r'\{[^}]+\}', response_text)

            if json_match:
                result = json.loads(json_match.group())
                agent = result.get("agent", "none")
                confidence = float(result.get("confidence", 0.0))
                reasoning = result.get("reasoning", "")

                # Validate agent is in available list or is "none"
                if agent != "none" and agent not in available_agents:
                    logger.debug(f"🔍 Agent '{agent}' not in available agents, returning none")
                    return StepClassification(
                        target_agent=None,
                        confidence=0.0,
                        reasoning=f"Agent '{agent}' not available",
                    )

                target = agent if agent != "none" else None
                logger.debug(
                    f"🔍 Step classified: agent={target}, confidence={confidence:.2f}"
                )

                return StepClassification(
                    target_agent=target,
                    confidence=confidence,
                    reasoning=reasoning,
                )

            logger.warning("🔍 Could not parse step classification response")
            return StepClassification(
                target_agent=None,
                confidence=0.0,
                reasoning="Failed to parse classification response",
            )

        except Exception as e:
            logger.error(f"🔍 Step classification failed: {e}")
            return StepClassification(
                target_agent=None,
                confidence=0.0,
                reasoning=f"Classification error: {e}",
            )
