"""
Agentic Executor for skill-based LLM orchestration.

Handles skill execution where the LLM uses tools to accomplish the skill's goal.
Extracted from SkillExecutorService as part of Phase 2.1 refactoring.

AIDEV-NOTE: Part of Phase 2.1 refactoring (Feb 2026).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

import dspy

from emery_agents.entities.tool_config import ToolConfig
from emery_agents.tools.loader import UnifiedToolLoader
from emery_agents.types import SkillExecutionResult

from ..agents.factory import AgentConfig, AgentFactory
from ..models import ModelProvider
from .shared.attachments import AttachmentProcessor, get_attachment_processor
from .shared.human_skill import HumanSkillHandler, get_human_skill_handler
from .shared.output_pipeline import OutputPipeline, get_output_pipeline

if TYPE_CHECKING:
    from emery_agents.entities.configs import AuthConfig, SkillRequest
    from emery_agents.entities.skill_config import SkillConfig

logger = logging.getLogger(__name__)


class AgenticExecutor:
    """Executes skills using LLM orchestration with tools.

    Handles agentic skill execution:
    1. Check for human skill (delegate to HumanSkillHandler)
    2. Load tools from skill config
    3. Resolve template variables in instructions
    4. Create DSPy executor module
    5. Execute skill and capture outputs
    6. Extract outputs using OutputPipeline

    Replaces SkillExecutorService._execute_agent() method.
    """

    def __init__(
        self,
        tool_loader: UnifiedToolLoader | None = None,
        agent_factory: AgentFactory | None = None,
        output_pipeline: OutputPipeline | None = None,
        human_skill_handler: HumanSkillHandler | None = None,
        attachment_processor: AttachmentProcessor | None = None,
    ):
        """Initialize with optional dependencies.

        Args:
            tool_loader: UnifiedToolLoader for loading tools
            agent_factory: AgentFactory for creating DSPy modules
            output_pipeline: OutputPipeline for extracting outputs
            human_skill_handler: HumanSkillHandler for human skills
            attachment_processor: AttachmentProcessor for skill attachments
        """
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self._agent_factory = agent_factory
        self.output_pipeline = output_pipeline or get_output_pipeline()
        self.human_skill_handler = human_skill_handler or get_human_skill_handler()
        self.attachment_processor = attachment_processor or get_attachment_processor()

    @property
    def agent_factory(self) -> AgentFactory:
        """Lazy-initialize AgentFactory with ModelProvider."""
        if self._agent_factory is None:
            self._agent_factory = AgentFactory(ModelProvider())
        return self._agent_factory

    def execute(
        self,
        request: SkillRequest,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> str | SkillExecutionResult:
        """Execute a skill request using LLM orchestration.

        Args:
            request: SkillRequest with skill config, inputs, and auth
            progress_callback: Optional callback for streaming progress

        Returns:
            SkillExecutionResult if capture_outputs=True, else result string
        """
        skill = request.skill
        logger.info(f"🤖 Agentic execution: {skill.name}")

        # Handle human skills
        if skill.is_human_skill():
            return self.human_skill_handler.emit_sync(
                skill=skill,
                runtime_inputs=request.inputs,
                progress_callback=progress_callback,
                capture_outputs=request.capture_outputs,
            )

        # 1. Process attachments from skill_config.content
        images, text_parts = self.attachment_processor.process(skill)
        has_images = len(images) > 0

        # 2. Build task with resolved variables and attachments
        base_task = self._resolve_task(skill, request.inputs)
        task = self.attachment_processor.build_task_with_attachments(
            instructions=base_task,
            inputs=request.inputs,
            text_parts=text_parts,
        ) if text_parts else base_task

        # 3. Load tools
        tools = self._load_tools(skill, request.auth)

        # 4. Create executor module with image support
        skill_model = skill.model if skill.model else request.skill_model
        skill_agent_type = skill.agent_type if skill.agent_type else None

        agent_config = AgentConfig(
            tools=tools,
            agent_model=skill_model,
            org_model=request.auth.org_model,
            has_images=has_images,
            max_iters=10,  # Default for agentic execution
            agent_name=f"skill_{skill.name}",
            agent_description=skill.description,
            enable_caching=False,
            use_code_execution=skill_agent_type == "code_agent",
        )
        executor_module = self.agent_factory.create_agent(agent_config)
        logger.info(
            f"✨ Created DSPy executor for skill {skill.name} (has_images={has_images})"
        )

        # 5. Emit progress start
        if progress_callback:
            progress_callback({
                "skill_name": skill.name,
                "step_type": "action",
                "step_index": 0,
                "content": f"Executing skill: {skill.name}",
            })

        # 6. Execute using DSPy module
        context_str = json.dumps({
            "task": task,
            "skill": skill.name,
            "has_images": has_images,
            "image_count": len(images),
        })

        with dspy.context(lm=executor_module._lm):
            result = executor_module.forward(
                step_description=task,
                context=context_str,
            )

        # 7. Emit progress complete
        if progress_callback:
            progress_callback({
                "skill_name": skill.name,
                "step_type": "final",
                "step_index": 1,
                "content": "Skill execution completed",
            })

        result_str = str(result)
        logger.info(f"✅ Skill {skill.name} completed")

        # 8. Extract outputs if requested
        if request.capture_outputs and skill.outputs:
            captured = self.output_pipeline.extract_outputs(
                content=result_str,
                skill_outputs=list(skill.outputs),
                skill_model=request.skill_model,
                org_model=request.auth.org_model,
            )

            # Check for complete extraction failure
            if captured and all(v is None for v in captured.values()):
                logger.error("No data was extracted - all fields were null")
                return SkillExecutionResult(
                    result="FAILED: No data could be extracted from the input.",
                    captured_outputs=None,
                )

            if captured:
                extracted = sum(1 for v in captured.values() if v is not None)
                logger.info(f"Extracted {extracted}/{len(captured)} outputs")

            return SkillExecutionResult(result=result_str, captured_outputs=captured)
        elif request.capture_outputs:
            return SkillExecutionResult(result=result_str, captured_outputs=None)
        else:
            return result_str

    def _resolve_task(
        self,
        skill: SkillConfig,
        inputs: dict[str, Any],
    ) -> str:
        """Resolve template variables in skill instructions.

        Args:
            skill: Skill config with instructions
            inputs: Runtime inputs for template substitution

        Returns:
            Resolved task string
        """
        task = skill.instructions or ""

        # Simple template substitution: {{variable_name}} -> value
        for key, value in inputs.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in task:
                task = task.replace(placeholder, str(value))

        return task

    def _load_tools(
        self,
        skill: SkillConfig,
        auth: AuthConfig,
    ) -> list[Any]:
        """Load tools configured for the skill.

        Args:
            skill: Skill config with tools list
            auth: Auth config with API key and org ID

        Returns:
            List of DSPy-compatible tools
        """
        if not skill.tools:
            return []

        # Convert StepToolConfig to ToolConfig
        tool_configs = [
            ToolConfig(name=t.name, version="1.0", config=t.config)
            for t in skill.tools
        ]

        tools = self.tool_loader.load_tools_from_configs(
            tool_configs=tool_configs,
            api_key=auth.api_key,
            api_key_mode="user",
            organization_id=auth.org_id,
        )

        logger.info(f"🔧 Loaded {len(tools)} tools for skill '{skill.name}'")
        return tools


# Singleton instance for convenience
_default_executor: AgenticExecutor | None = None


def get_agentic_executor() -> AgenticExecutor:
    """Get shared AgenticExecutor instance."""
    global _default_executor
    if _default_executor is None:
        _default_executor = AgenticExecutor()
    return _default_executor
