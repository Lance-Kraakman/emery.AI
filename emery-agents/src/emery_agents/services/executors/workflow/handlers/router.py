"""
Step handler router for workflow execution.

Routes step execution to appropriate handlers based on step type.

AIDEV-NOTE: Part of Phase 2.3 refactoring (Feb 2026).
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import TYPE_CHECKING, Any

import dspy
import httpx

from emery_agents.api import RowAPI
from emery_agents.entities.tool_config import ToolConfig
from emery_agents.tools.loader import UnifiedToolLoader
from emery_agents.types import SkillExecutionResult

from emery_agents.services.agents.factory import AgentConfig, AgentFactory
from emery_agents.services.execution.plan_step_executor import PlanStepExecutor
from emery_agents.services.models import ModelProvider

from ...shared.output_pipeline import OutputPipeline, get_output_pipeline
from ..types import WorkflowStep

if TYPE_CHECKING:
    from collections.abc import Callable

    from emery_agents.entities.configs import AuthConfig
    from emery_agents.entities.skill_config import (
        QueryFilter,
        ReadConfig,
        RowIdSource,
        SkillConfig,
        ToolInputMapping,
        WriteConfig,
    )

logger = logging.getLogger(__name__)

# Template variable pattern
_TEMPLATE_VAR = re.compile(r"\{\{(\w+)\}\}")


class StepHandlerRouter:
    """Routes step execution to appropriate handlers.

    Handles all step types:
    - inline: LLM instruction execution
    - skill: Skill delegation via callback
    - read: Table read operations
    - write: Table write operations
    - tool: Direct tool execution
    - agentic: Plan-based agentic execution
    """

    def __init__(
        self,
        tool_loader: UnifiedToolLoader | None = None,
        agent_factory: AgentFactory | None = None,
        output_pipeline: OutputPipeline | None = None,
        skill_executor_callback: Callable[[SkillConfig, dict[str, Any], bool], Any] | None = None,
    ):
        """Initialize router with dependencies.

        Args:
            tool_loader: UnifiedToolLoader for loading tools
            agent_factory: AgentFactory for creating DSPy modules
            output_pipeline: OutputPipeline for extracting outputs
            skill_executor_callback: Callback to execute delegated skills
        """
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self._agent_factory = agent_factory
        self.output_pipeline = output_pipeline or get_output_pipeline()
        self.skill_executor_callback = skill_executor_callback

    @property
    def agent_factory(self) -> AgentFactory:
        """Lazy-initialize AgentFactory with ModelProvider."""
        if self._agent_factory is None:
            self._agent_factory = AgentFactory(ModelProvider())
        return self._agent_factory

    async def handle_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> Any:
        """Route step to appropriate handler.

        Args:
            step: WorkflowStep to execute
            context: Step context with inputs and previous results
            kwargs: Additional kwargs (auth, available_skills, skill_model)

        Returns:
            Step result (varies by step type)
        """
        step_type = step.step_type
        logger.info(f"📋 Handling step '{step.name}' (type: {step_type})")

        if step_type == "skill":
            return await self._handle_skill_step(step, context, kwargs)
        elif step_type == "read":
            return await self._handle_read_step(step, context, kwargs)
        elif step_type == "write":
            return await self._handle_write_step(step, context, kwargs)
        elif step_type == "tool":
            return await self._handle_tool_step(step, context, kwargs)
        elif step_type == "agentic":
            return await self._handle_agentic_step(step, context, kwargs)
        else:
            return await self._handle_inline_step(step, context, kwargs)

    async def _handle_inline_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> str:
        """Handle inline instruction step using LLM."""
        auth: AuthConfig = kwargs["auth"]
        skill_model: str | None = kwargs.get("skill_model")

        # Resolve template variables in instruction
        instruction = self._resolve_templates(step.instruction, context)

        # Load tools
        tools = []
        if step.tools:
            tool_configs = [ToolConfig(name=t, version="1.0", config={}) for t in step.tools]
            tools = self.tool_loader.load_tools_from_configs(
                tool_configs=tool_configs,
                api_key=auth.api_key,
                organization_id=auth.org_id,
            )

        # Create executor module
        agent_config = AgentConfig(
            tools=tools,
            agent_model=skill_model,
            org_model=auth.org_model,
            max_iters=10,
            agent_name=f"step_{step.name}",
            agent_description=f"Execute step: {step.name}",
            enable_caching=False,
        )
        executor = self.agent_factory.create_agent(agent_config)

        # Execute
        context_str = json.dumps({"task": instruction, "step": step.name})
        with dspy.context(lm=executor._lm):
            result = executor.forward(
                step_description=instruction,
                context=context_str,
            )

        return str(result)

    async def _handle_skill_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> Any:
        """Handle skill delegation step."""
        if not self.skill_executor_callback:
            raise ValueError("No skill executor callback configured")

        available_skills: dict[int, SkillConfig] = kwargs.get("available_skills", {})
        skill_config = available_skills.get(step.skill_id)

        if not skill_config:
            raise ValueError(f"Skill {step.skill_id} not found in available_skills")

        # Build inputs from step input mappings
        skill_inputs = {}
        for input_name, source in step.inputs.items():
            value = self._resolve_templates(source, context)
            skill_inputs[input_name] = value

        # Execute via callback
        result = self.skill_executor_callback(
            skill_config,
            skill_inputs,
            True,  # capture_outputs
        )

        # Extract captured outputs if SkillExecutionResult
        if isinstance(result, SkillExecutionResult) and result.captured_outputs:
            return result.captured_outputs
        elif isinstance(result, SkillExecutionResult):
            return result.result
        return result

    async def _handle_read_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle table read step."""
        auth: AuthConfig = kwargs["auth"]
        read_config = step.read_config

        if not read_config or not read_config.source_table_id:
            raise ValueError(f"Step {step.name} missing source_table_id")

        table_id = read_config.source_table_id
        mode = read_config.mode or "single_row"

        logger.info(f"📖 Step {step.name}: table read -> table {table_id} ({mode})")

        # Use HTTP client for table operations (matching original implementation)
        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        base_url = f"{nextjs_base}/api"

        headers = {"Content-Type": "application/json"}
        if auth.api_key:
            headers["Authorization"] = f"Bearer {auth.api_key}"
        if auth.org_id:
            headers["X-Organization-ID"] = str(auth.org_id)

        async with httpx.AsyncClient(timeout=30.0) as client:
            if mode == "single_row":
                row_id = self._resolve_row_id_source(read_config.row_id_source, context)
                if not row_id:
                    raise ValueError("Could not resolve row ID for single_row read")

                response = await client.get(
                    f"{base_url}/rows/{table_id}/{row_id}", headers=headers
                )
                if response.status_code >= 400:
                    raise ValueError(f"Table read failed: {response.text[:500]}")

                row = response.json()
                rows = [row] if row else []
            else:  # query mode
                filters = self._build_query_filters(read_config.query_filters, context)
                limit = read_config.query_limit or 100

                params: dict[str, Any] = {"limit": limit}
                for f in filters:
                    params[f"filter[field_{f['field_id']}]"] = f"{f['operator']}:{f['value']}"

                response = await client.get(
                    f"{base_url}/rows/{table_id}", headers=headers, params=params
                )
                if response.status_code >= 400:
                    raise ValueError(f"Table query failed: {response.text[:500]}")

                result = response.json()
                rows = result.get("rows", []) if isinstance(result, dict) else result

        # Map fields to output variables
        outputs: dict[str, Any] = {}
        for mapping in read_config.field_mappings:
            field_key = f"field_{mapping.source_field_id}"
            target_var = mapping.target_variable

            if mode == "single_row" and rows:
                outputs[target_var] = rows[0].get(field_key)
            else:
                outputs[target_var] = [r.get(field_key) for r in rows]

        logger.info(f"✅ Step {step.name}: read complete, {len(outputs)} outputs")
        return outputs

    async def _handle_write_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> dict[str, Any]:
        """Handle table write step."""
        auth: AuthConfig = kwargs["auth"]
        write_config = step.write_config

        if not write_config or not write_config.target_table_id:
            raise ValueError(f"Step {step.name} missing target_table_id")

        table_id = write_config.target_table_id
        row_action = write_config.row_action or "create"

        logger.info(f"📝 Step {step.name}: table write -> table {table_id} ({row_action})")

        # Build field values from mappings
        fields: dict[str, Any] = {}
        for mapping in write_config.field_mappings:
            # Get value from skill input (resolved from context)
            value = context.get(mapping.skill_input_name)
            if value is not None:
                fields[str(mapping.target_field_id)] = value

        api = RowAPI(api_key=auth.api_key, org_id=str(auth.org_id))

        if row_action == "create":
            result = api.create_row(table_id, fields)
        elif row_action == "update":
            # Get row ID from update_match config
            row_id = None
            if write_config.update_match:
                match_input = write_config.update_match.skill_input_name
                row_id = context.get(match_input)
            if not row_id:
                raise ValueError("Update requires row_id from update_match config")
            result = api.update_row(table_id, str(row_id), fields)
        elif row_action == "upsert":
            result = api.upsert_row(table_id, fields, write_config.match_field_ids)
        else:
            raise ValueError(f"Unknown row_action: {row_action}")

        logger.info(f"✅ Step {step.name}: write complete")
        return result

    async def _handle_tool_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> Any:
        """Handle direct tool execution step."""
        auth: AuthConfig = kwargs["auth"]
        tool_config = step.tool_execution_config

        if not tool_config or not tool_config.tool_id:
            raise ValueError(f"Step {step.name} missing tool_id")

        # Load the tool
        config = ToolConfig(
            name=tool_config.tool_id,
            version="1.0",
            config={},
        )
        tools = self.tool_loader.load_tools_from_configs(
            tool_configs=[config],
            api_key=auth.api_key,
            organization_id=auth.org_id,
        )

        if not tools:
            raise ValueError(f"Failed to load tool: {tool_config.tool_id}")

        tool = tools[0]

        # Build tool inputs from input_mappings
        tool_inputs: dict[str, Any] = {}
        for mapping in tool_config.input_mappings:
            # Try skill_input_name first, then static_value
            if mapping.skill_input_name:
                value = context.get(mapping.skill_input_name)
            else:
                value = mapping.static_value
            tool_inputs[mapping.tool_param] = value

        # Execute tool
        result = tool(**tool_inputs)
        return result

    async def _handle_agentic_step(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
        kwargs: dict[str, Any],
    ) -> str:
        """Handle agentic step with stored plan."""
        auth: AuthConfig = kwargs["auth"]
        agentic_config = step.agentic_config

        if not agentic_config:
            raise ValueError(f"Step {step.name} has no agentic_config")

        # PlanStepExecutor expects Plan and PlanStep, not a dict context
        # The agentic_config should contain the plan to execute
        plan = agentic_config.plan
        if plan is None:
            raise ValueError(f"Step {step.name} agentic_config has no plan")

        executor = PlanStepExecutor(
            api_key=auth.api_key,
            org_id=str(auth.org_id),
            org_model=auth.org_model,
        )

        # Execute each step in the stored plan
        results = []
        for plan_step in plan.steps:
            outcome = executor.execute(plan, plan_step)
            results.append(outcome.summary)

        return "\n".join(results)

    def _resolve_templates(self, template: str, context: dict[str, Any]) -> str:
        """Resolve {{variable}} templates in string."""
        if not template:
            return template

        def replacer(match: re.Match[str]) -> str:
            var_name = match.group(1)
            value = context.get(var_name, match.group(0))
            return str(value) if value is not None else ""

        return _TEMPLATE_VAR.sub(replacer, template)

    def _resolve_row_id_source(
        self,
        source: RowIdSource | None,
        context: dict[str, Any],
    ) -> str | None:
        """Resolve row ID from RowIdSource config."""
        if not source:
            return None

        if source.type == "static":
            return source.static_id
        elif source.type == "skill_input":
            return context.get(source.skill_input)
        elif source.type == "skill_output":
            return context.get(source.skill_output)
        elif source.use_source_row:
            return context.get("__source_row_id__")
        return None

    def _build_query_filters(
        self,
        filters: list[QueryFilter],
        context: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Build query filters from QueryFilter configs."""
        result = []
        for f in filters:
            value = None
            if f.value_source:
                value = self._resolve_row_id_source(f.value_source, context)
            result.append({
                "field_id": f.field_id,
                "operator": f.operator,
                "value": value,
            })
        return result


# Singleton instance
_default_router: StepHandlerRouter | None = None


def get_step_handler_router() -> StepHandlerRouter:
    """Get shared StepHandlerRouter instance."""
    global _default_router
    if _default_router is None:
        _default_router = StepHandlerRouter()
    return _default_router
