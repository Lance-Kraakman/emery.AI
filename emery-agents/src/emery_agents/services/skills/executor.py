"""Shared skill execution for agent and operation modes.

AIDEV-NOTE: Only supports 'agentic' and 'workflow' execution types.
Dead code for 'operation', 'tool', 'read', 'write' modes removed Jan 2026.
Executor accepts SkillConfig entity only. Proto converted at boundary.
"""

import json
import logging
from collections.abc import Callable
from typing import Any, Dict, Literal, Optional, Union, overload

import dspy
from PIL import Image

from emery_agents.api import TableAPI
from emery_agents.tools.loader import UnifiedToolLoader

from ...entities.models.plan import Plan
from ...entities.skill_config import (
    AgenticStepConfig as AgenticStepConfigDTO,
)
from ...entities.skill_config import (
    ReadConfig as ReadConfigDTO,
)
from ...entities.skill_config import (
    ReadFieldMapping,
    RowIdSource,
    SkillConfig,
    SkillStep,
    WriteFieldMapping,
)
from ...entities.skill_config import (
    WriteConfig as WriteConfigDTO,
)
from ...reasoning.signatures.extraction import TargetFieldMeta
from ...types import SkillExecutionResult
from ..executors.shared.human_skill import HumanSkillHandler, get_human_skill_handler
from ..executors.shared.output_pipeline import OutputPipeline, get_output_pipeline
from ...utils import run_async_in_thread
from ...utils.step_utils import RawProgressDict, step_to_progress_dict
from ..agents.factory import AgentConfig, AgentFactory
from .step_executor import StepExecutorService, execute_steps_sync

logger = logging.getLogger(__name__)


def map_node_outputs_to_skill_outputs(
    all_node_outputs: dict[str, dict[str, Any]], skill_outputs: list[Any]
) -> dict[str, Any]:
    """Map captured node outputs to skill outputs via source config.

    Args:
        all_node_outputs: Dict mapping node_id/step_name to its captured outputs
        skill_outputs: Skill-level output definitions with source config

    Returns:
        Dict mapping skill output name to value
    """
    result = {}

    for output in skill_outputs:
        source = getattr(output, "source", None)
        if source and getattr(source, "type", None) == "node_output":
            node_id = source.node_id
            output_name = source.output_name
            node_outputs = all_node_outputs.get(node_id, {})
            result[output.name] = node_outputs.get(output_name)
            logger.debug(f"Mapped {node_id}.{output_name} -> {output.name}")
        else:
            # No source config - output won't be mapped
            # User must resave skill to add source mappings
            result[output.name] = None

    return result


class SkillExecutorService:
    """Executes skills via agentic (LLM orchestration) or workflow (DAG steps).

    Accepts SkillConfig only (created from API response).
    """

    def __init__(
        self,
        tool_loader: UnifiedToolLoader,
        agent_factory: AgentFactory,
    ):
        self.tool_loader = tool_loader
        self.agent_factory = agent_factory

    def _extract_plan_from_skill(
        self,
        skill_config: SkillConfig,
    ) -> Plan | None:
        """Extract stored plan from skill's agentic step configuration.

        Returns:
            Plan entity if found, None otherwise
        """
        logger.info(
            f"[PLAN-EXTRACT] Skill '{skill_config.name}': "
            f"{len(skill_config.steps)} steps, execution_type={skill_config.execution_type}"
        )
        for i, step in enumerate(skill_config.steps):
            has_config = step.agentic_config is not None
            has_plan = has_config and step.agentic_config.plan is not None
            logger.info(
                f"[PLAN-EXTRACT]   Step {i} '{step.name}': "
                f"agentic_config={has_config}, plan={has_plan}"
            )
            if has_plan:
                return step.agentic_config.plan
        return None

    def _handle_human_skill(
        self,
        skill_config: SkillConfig,
        runtime_inputs: Dict[str, Any],
        capture_outputs: bool,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> Union[str, SkillExecutionResult]:
        """Handle human skill execution by emitting AwaitingHumanSkill event.

        Human skills pause execution and wait for a human to complete the work.
        The caller (chat stream or task runner) handles the actual waiting.

        Args:
            skill_config: Human skill configuration
            runtime_inputs: Context provided to the human
            capture_outputs: Return type flag
            progress_callback: Optional callback for streaming the event

        Returns:
            SkillExecutionResult with awaiting_human status
        """
        # Delegate to unified HumanSkillHandler
        handler = get_human_skill_handler()
        return handler.emit_sync(
            skill=skill_config,
            runtime_inputs=runtime_inputs,
            progress_callback=progress_callback,
            capture_outputs=capture_outputs,
            step_id="",  # Empty for top-level skill
        )

    def _build_wrapper_dag(
        self,
        skill_config: SkillConfig,
        runtime_inputs: dict[str, Any],
    ) -> list[SkillStep]:
        """Build wrapper DAG from agentic skill config.

        Generates:
        - Read step (if skill has input mappings)
        - Agentic step (always, with stored plan)

        Write step is NOT in the DAG — agentic steps produce text, not structured
        data. Extraction + write happen as post-DAG phases in _execute_agentic().

        Returns:
            List of SkillStep for DAG execution
        """
        steps: list[SkillStep] = []

        # Step 1: Generate Read step from input mappings
        read_step = self._build_read_step_from_inputs(skill_config)
        if read_step:
            steps.append(read_step)
            logger.info(f"📖 Generated Read step for skill {skill_config.name}")

        # Step 2: Build Agentic step with stored plan
        stored_plan = self._extract_plan_from_skill(skill_config)

        agentic_config = AgenticStepConfigDTO(
            instructions=skill_config.instructions,
            agent_type=skill_config.agent_type or "",
            model=skill_config.model or "",
            tools=[t.name for t in skill_config.tools] if skill_config.tools else [],
            plan=stored_plan,
        )
        if stored_plan:
            logger.info(f"📋 Skill {skill_config.name}: using stored plan")

        agentic_step = SkillStep(
            id=f"agentic_{skill_config.id}",
            name=skill_config.name,
            step_type="agentic",
            agentic_config=agentic_config,
            inputs={inp.name: f"{{{{{inp.name}}}}}" for inp in skill_config.inputs},
        )
        steps.append(agentic_step)

        logger.info(
            f"📋 Built wrapper DAG: {len(steps)} steps for skill {skill_config.name}"
        )
        return steps

    def _build_read_step_from_inputs(
        self,
        skill_config: SkillConfig,
    ) -> SkillStep | None:
        """Generate Read step from skill input mappings.

        Returns:
            SkillStep with read_config, or None if no input mappings
        """
        inputs_with_mapping = [
            inp for inp in skill_config.inputs if inp.input_mapping is not None
        ]

        if not inputs_with_mapping:
            return None

        # For now, use first input's mapping as source table
        first_source = inputs_with_mapping[0].input_mapping["source"]

        row_id_source = None
        if "row_source" in first_source:
            rs = first_source["row_source"]
            row_id_source = RowIdSource(
                static_id=rs.get("static_id", ""),
                skill_input=rs.get("skill_input", ""),
                skill_output=rs.get("skill_output", ""),
                use_source_row=rs.get("use_source_row", False),
            )

        # Build field mappings: table field -> variable name
        field_mappings = []
        for inp in inputs_with_mapping:
            if inp.input_mapping is not None and "source" in inp.input_mapping:
                source = inp.input_mapping["source"]
                field_mappings.append(
                    ReadFieldMapping(
                        source_field_id=source["field_id"],
                        target_variable=inp.name,
                    )
                )

        read_config = ReadConfigDTO(
            mode="single_row",
            source_table_id=first_source["table_id"],
            row_id_source=row_id_source,
            field_mappings=field_mappings,
        )

        return SkillStep(
            id=f"read_{skill_config.id}",
            name=f"Read inputs for {skill_config.name}",
            step_type="read",
            read_config=read_config,
        )

    def _build_write_step_from_outputs(
        self,
        skill_config: SkillConfig,
    ) -> SkillStep | None:
        """Generate Write step from skill output mappings.

        Returns:
            SkillStep with write_config, or None if no output mappings
        """
        outputs_with_mapping = [
            out
            for out in skill_config.outputs
            if out.output_mapping is not None
            and len(out.output_mapping.table_mappings) > 0
        ]

        if not outputs_with_mapping:
            return None

        # Use first output's table mapping for target table config
        first_table = outputs_with_mapping[0].output_mapping.table_mappings[0]
        target_table_id = first_table.target_table_id

        # Collect field mappings from ALL outputs targeting the same table
        field_mappings: list[WriteFieldMapping] = []
        for out in outputs_with_mapping:
            for tm in out.output_mapping.table_mappings:
                if tm.target_table_id == target_table_id:
                    for fm in tm.mappings:
                        field_mappings.append(
                            WriteFieldMapping(
                                skill_input_name=fm.source.name,
                                target_field_id=fm.target_field_id,
                            )
                        )

        if not field_mappings:
            return None

        write_config = WriteConfigDTO(
            target_table_id=target_table_id,
            row_action=first_table.row_action,
            field_mappings=field_mappings,
            match_field_ids=first_table.match_field_ids,
        )

        return SkillStep(
            id=f"write_{skill_config.id}",
            name=f"Write outputs for {skill_config.name}",
            step_type="write",
            write_config=write_config,
            inputs={
                fm.skill_input_name: f"{{{{{fm.skill_input_name}}}}}"
                for fm in field_mappings
            },
        )

    def _build_target_field_metadata(
        self,
        skill_config: SkillConfig,
        target_table_id: int,
        api_key: str,
        org_id: int,
    ) -> dict[str, TargetFieldMeta]:
        """Fetch table schema and build typed metadata for output fields.

        Maps each output name to its target field constraints (type, select options).
        """
        try:
            table = TableAPI(api_key, str(org_id)).get(target_table_id)
        except Exception as e:
            logger.warning(f"Failed to fetch table {target_table_id} metadata: {e}")
            return {}

        if not table:
            return {}

        fields_by_id = {f["id"]: f for f in table.fields}
        metadata: dict[str, TargetFieldMeta] = {}

        for out in skill_config.outputs:
            if not out.output_mapping:
                continue
            for tm in out.output_mapping.table_mappings:
                if tm.target_table_id != target_table_id:
                    continue
                for fm in tm.mappings:
                    field = fields_by_id.get(fm.target_field_id, {})
                    raw_opts = (field.get("metadata") or {}).get("options", [])
                    metadata[fm.source.name] = TargetFieldMeta(
                        type=field.get("type", "text"),
                        options=[
                            o["value"]
                            for o in raw_opts
                            if isinstance(o, dict) and "value" in o
                        ],
                    )

        return metadata

    def _post_dag_output_pipeline(
        self,
        skill_config: SkillConfig,
        result: SkillExecutionResult,
        step_executor: StepExecutorService,
        org_model: str | None,
        api_key: str,
        organization_id: int,
    ) -> dict[str, Any] | None:
        """Unified post-DAG pipeline for both agentic and workflow flows.

        Three steps:
        1. Source mapping: map captured_outputs via OutputDefinition.source config
        2. Extraction: for unmapped outputs, extract from text result via LLM
        3. Write: execute write step with final skill_outputs

        Returns:
            Dict of {output_name: value}, or None if no outputs configured
        """
        if not skill_config.outputs:
            return None

        # Build write step early to get target_table_id for metadata fetch
        write_step = self._build_write_step_from_outputs(skill_config)
        target_field_metadata: dict[str, TargetFieldMeta] = {}
        if write_step and write_step.write_config:
            target_field_metadata = self._build_target_field_metadata(
                skill_config,
                write_step.write_config.target_table_id,
                api_key,
                organization_id,
            )
            if target_field_metadata:
                logger.info(
                    f"📋 Loaded field metadata for {len(target_field_metadata)} outputs"
                )

        # Step 1: Source mapping (works when captured_outputs has structured data)
        skill_outputs: dict[str, Any] | None = None
        if result.captured_outputs:
            skill_outputs = map_node_outputs_to_skill_outputs(
                all_node_outputs=result.captured_outputs,
                skill_outputs=list(skill_config.outputs),
            )
            mapped_count = sum(1 for v in skill_outputs.values() if v is not None)
            logger.info(
                f"📤 Source mapping: {mapped_count}/{len(skill_outputs)} outputs mapped"
            )

        # Step 2: Extraction for unmapped outputs (agentic text results)
        if result.result:
            unmapped = [
                o
                for o in skill_config.outputs
                if not skill_outputs or skill_outputs.get(o.name) is None
            ]
            if unmapped:
                logger.info(
                    f"🔍 Extracting {len(unmapped)} unmapped outputs from text result"
                )
                # Use OutputPipeline for extraction and coercion
                output_pipeline = get_output_pipeline()
                extracted = output_pipeline.extract_and_coerce(
                    content=result.result,
                    skill_outputs=unmapped,
                    skill_model=skill_config.model,
                    org_model=org_model,
                    target_field_metadata=target_field_metadata,
                )
                if extracted:
                    if skill_outputs is None:
                        skill_outputs = {}
                    skill_outputs.update(
                        {k: v for k, v in extracted.items() if v is not None}
                    )
                    extracted_count = sum(
                        1 for v in extracted.values() if v is not None
                    )
                    logger.info(
                        f"🔍 Extracted {extracted_count}/{len(unmapped)} outputs"
                    )

        # Step 3: Write (if output mappings configured and we have values)
        if skill_outputs and any(v is not None for v in skill_outputs.values()):
            if write_step:
                logger.info(
                    f"📝 Post-DAG: writing output mappings for {skill_config.name}"
                )
                try:
                    execute_steps_sync(
                        step_executor=step_executor,
                        steps=[write_step],
                        available_skills={},
                        initial_inputs=skill_outputs,
                        org_model=org_model,
                        api_key=api_key,
                        organization_id=organization_id,
                    )
                except Exception as e:
                    logger.error(f"📝 Write step failed for {skill_config.name}: {e}")

        # Return None if all outputs are None (complete failure)
        if skill_outputs and all(v is None for v in skill_outputs.values()):
            return None

        return skill_outputs

    @overload
    def execute_skill(
        self,
        skill_config: SkillConfig,
        runtime_inputs: dict[str, Any],
        org_model: str | None = None,
        capture_outputs: Literal[False] = False,
        attachments: list[Any] | None = None,
        return_message_parts: bool = False,
        api_key: str = "",
        organization_id: int = 0,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> str: ...

    @overload
    def execute_skill(
        self,
        skill_config: SkillConfig,
        runtime_inputs: dict[str, Any],
        org_model: str | None = None,
        capture_outputs: Literal[True] = ...,
        attachments: list[Any] | None = None,
        return_message_parts: bool = False,
        api_key: str = "",
        organization_id: int = 0,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> SkillExecutionResult: ...

    def execute_skill(
        self,
        skill_config: SkillConfig,
        runtime_inputs: dict[str, Any],
        org_model: str | None = None,
        capture_outputs: bool = False,
        attachments: list[Any] | None = None,
        return_message_parts: bool = False,
        api_key: str = "",
        organization_id: int = 0,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> str | SkillExecutionResult:
        """Execute a skill.

        Args:
            skill_config: SkillConfig (from API or proto boundary)
            runtime_inputs: Runtime inputs from caller
            org_model: Organization default model (fallback)
            capture_outputs: If True, return SkillExecutionResult with captured outputs
            attachments: Optional file attachments for skill context
            return_message_parts: If True, return MessageParts JSON (chat mode)
            api_key: API key for output mappings
            organization_id: Organization ID for output mappings
            progress_callback: Optional callback for step progress visibility

        Returns:
            str if capture_outputs=False
            SkillExecutionResult if capture_outputs=True
        """
        logger.info(
            f"🎯 Executing skill: {skill_config.name} (capture_outputs={capture_outputs})"
        )

        try:
            # Check for human skill first - emit event and pause
            if skill_config.is_human_skill():
                return self._handle_human_skill(
                    skill_config=skill_config,
                    runtime_inputs=runtime_inputs,
                    capture_outputs=capture_outputs,
                    progress_callback=progress_callback,
                )

            if skill_config.is_workflow():
                return self._execute_steps(
                    skill_config,
                    runtime_inputs,
                    org_model,
                    api_key=api_key,
                    organization_id=organization_id,
                )
            else:
                # Use wrapper DAG if skill has a stored plan, otherwise fall back
                # to direct LLM agent execution with instructions
                if self._extract_plan_from_skill(skill_config):
                    return self._execute_agentic(
                        skill_config,
                        runtime_inputs,
                        org_model,
                        capture_outputs,
                        api_key,
                        organization_id,
                    )
                else:
                    return self._execute_agent(
                        skill_config,
                        runtime_inputs,
                        org_model,
                        capture_outputs,
                        attachments=attachments,
                        return_message_parts=return_message_parts,
                        progress_callback=progress_callback,
                        api_key=api_key,
                        organization_id=organization_id,
                    )
        except Exception as e:
            error_msg = f"Skill execution error: {str(e)}"
            logger.error(f"❌ Skill {skill_config.name} failed: {e}", exc_info=True)
            if capture_outputs:
                return SkillExecutionResult(result=error_msg, captured_outputs=None)
            return error_msg

    def _execute_agentic(
        self,
        skill_config: SkillConfig,
        runtime_inputs: dict[str, Any],
        org_model: str | None,
        capture_outputs: bool,
        api_key: str,
        organization_id: int,
    ) -> str | SkillExecutionResult:
        """Execute agentic skill via unified StepExecutorService path.

        Builds a wrapper DAG: [Read Node?] → [Agentic Node]
        Then runs post-DAG pipeline: source mapping → extraction → write.
        """
        # Build wrapper DAG steps for StepExecutorService
        steps = self._build_wrapper_dag(skill_config, runtime_inputs)

        if not steps:
            raise ValueError(
                f"Failed to build wrapper DAG for skill {skill_config.name}"
            )

        # Create step executor with callback for skill delegation
        step_executor = StepExecutorService(
            tool_loader=self.tool_loader,
            agent_factory=self.agent_factory,
            skill_executor_callback=self.create_executor_callback(
                org_model=org_model,
                return_message_parts=False,
                api_key=api_key,
                organization_id=organization_id,
            ),
        )

        # Execute wrapper DAG
        result = execute_steps_sync(
            step_executor=step_executor,
            steps=steps,
            available_skills={},
            initial_inputs=runtime_inputs,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id,
        )

        logger.info(f"✅ Agentic skill execution complete: {skill_config.name}")

        # --- Post-DAG pipeline (same pattern as _execute_steps) ---
        skill_outputs = self._post_dag_output_pipeline(
            skill_config=skill_config,
            result=result,
            step_executor=step_executor,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id,
        )

        if skill_outputs:
            return SkillExecutionResult(
                result=result.result, captured_outputs=skill_outputs
            )
        if capture_outputs:
            return result
        return result.result

    def _execute_agent(
        self,
        skill_config: SkillConfig,
        runtime_inputs: dict[str, Any],
        org_model: str | None,
        capture_outputs: bool,
        attachments: list[Any] | None,
        return_message_parts: bool,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
        api_key: str = "",
        organization_id: int = 0,
    ) -> str | SkillExecutionResult:
        """Execute skill via LLM agent orchestration.

        Args:
            progress_callback: Optional callback for step progress. Called with step dict:
                {'type': 'planning'|'action'|'final', 'content': str, 'metadata': dict}
        """

        # 1. Load skill's tools
        skill_tools = []
        if skill_config.tools:
            skill_tools = self.tool_loader.load_tools_from_configs(
                tool_configs=list(skill_config.tools),
                api_key=api_key,
                api_key_mode="user",
            )
            logger.info(
                f"🔧 Loaded {len(skill_tools)} tools for skill {skill_config.name}"
            )

        # 2. Note: Output capture now uses separate extraction step after execution
        # This is cleaner than requiring the agent to call a submit_result tool

        # 3. Process attachments from skill_config.content
        images, text_parts = self._process_skill_attachments(skill_config)

        # 4. Build task from instructions + inputs + attachments
        task_parts = [skill_config.instructions]

        if runtime_inputs:
            task_parts.append("\n\nInputs:")
            for key, value in runtime_inputs.items():
                task_parts.append(f"- {key}: {value}")

        # Add text parts from attachments
        task_parts.extend(text_parts)

        # Note: Output capture instructions removed - extraction happens after execution

        task = "\n".join(task_parts)
        logger.info(f"📝 Skill task: {task[:200]}...")

        # 5. Create sub-agent
        has_images = bool(images)
        skill_model = skill_config.model if skill_config.model else None
        skill_agent_type = skill_config.agent_type if skill_config.agent_type else None

        agent_config = AgentConfig(
            tools=skill_tools,
            skill_model=skill_model,
            org_model=org_model,
            has_images=has_images,
            max_iters=10,
            agent_name=f"skill_{skill_config.name}",
            agent_description=skill_config.description,
            enable_caching=False,
            use_code_execution=skill_agent_type == "code_agent",
        )
        executor_module = self.agent_factory.create_agent(agent_config)
        logger.info(
            f"✨ Created DSPy executor for skill {skill_config.name} (has_images={has_images})"
        )

        # 6. Execute using DSPy module
        # Build context with task and image info
        import json as json_module

        context_str = json_module.dumps(
            {
                "task": task,
                "skill": skill_config.name,
                "has_images": len(images) > 0 if images else False,
                "image_count": len(images) if images else 0,
            }
        )

        # Emit progress start if callback provided
        if progress_callback:
            progress_callback(
                {
                    "skill_name": skill_config.name,
                    "step_type": "action",
                    "step_index": 0,
                    "content": f"Executing skill: {skill_config.name}",
                }
            )

        with dspy.context(lm=executor_module._lm):
            result = executor_module.forward(
                step_description=task,
                context=context_str,
            )

        # Emit progress complete if callback provided
        if progress_callback:
            progress_callback(
                {
                    "skill_name": skill_config.name,
                    "step_type": "final",
                    "step_index": 1,
                    "content": "Skill execution completed",
                }
            )

        logger.info(f"🔍 Skill output type: {type(result).__name__}")

        # 7. Build result
        if return_message_parts:
            result_json = self._build_message_parts_json(result)
        else:
            result_json = str(result)

        logger.info(f"✅ Skill {skill_config.name} completed")

        # 8. Return with captured outputs if requested
        if capture_outputs and skill_config.outputs:
            # Extract outputs using OutputPipeline
            output_pipeline = get_output_pipeline()
            captured = output_pipeline.extract_outputs(
                content=result_json,
                skill_outputs=list(skill_config.outputs),
                skill_model=skill_config.model,
                org_model=org_model,
            )

            # Check if all values are null (complete extraction failure)
            if captured and all(v is None for v in captured.values()):
                logger.error("No data was extracted - all fields were null")
                return SkillExecutionResult(
                    result="FAILED: No data could be extracted from the input.",
                    captured_outputs=None,
                )

            if captured:
                extracted = sum(1 for v in captured.values() if v is not None)
                logger.info(f"Extracted {extracted}/{len(captured)} outputs")

            return SkillExecutionResult(result=result_json, captured_outputs=captured)
        elif capture_outputs:
            return SkillExecutionResult(result=result_json, captured_outputs=None)
        else:
            return result_json

    def _step_to_progress_dict(
        self, step: Any, index: int, skill_name: str
    ) -> RawProgressDict | None:
        """Delegate to shared utility for step-to-dict conversion."""
        return step_to_progress_dict(step, index, skill_name, name_key="skill_name")

    def _execute_steps(
        self,
        skill_config: SkillConfig,
        runtime_inputs: dict[str, Any],
        org_model: str | None = None,
        api_key: str = "",
        organization_id: int = 0,
    ) -> SkillExecutionResult:
        """Execute skill via step-based DAG workflow.

        Three-phase execution:
        1. Pre-DAG: fetch input mapping data (same as agentic wrapper DAG)
        2. DAG: execute canvas steps with enriched inputs
        3. Post-DAG: write output mapping data (same as agentic wrapper DAG)

        Args:
            skill_config: Skill configuration with steps[]
            runtime_inputs: Runtime inputs from caller
            org_model: Organization default model (fallback)
            api_key: API key for authenticated calls
            organization_id: Organization ID for RLS context

        Returns:
            SkillExecutionResult with results from all steps
        """
        logger.info(
            f"🚀 Step-based execution: {skill_config.name} ({len(skill_config.steps)} steps)"
        )

        # Create step executor with callback for skill delegation
        step_executor = StepExecutorService(
            tool_loader=self.tool_loader,
            agent_factory=self.agent_factory,
            skill_executor_callback=self.create_executor_callback(
                org_model=org_model,
                return_message_parts=False,
                api_key=api_key,
                organization_id=organization_id,
            ),
        )

        enriched_inputs = dict(runtime_inputs)

        # Phase 1: Pre-DAG — fetch input mapping data
        read_step = self._build_read_step_from_inputs(skill_config)
        if read_step:
            logger.info(f"📖 Pre-DAG: reading input mappings for {skill_config.name}")
            read_result = execute_steps_sync(
                step_executor=step_executor,
                steps=[read_step],
                available_skills={},
                initial_inputs=enriched_inputs,
                org_model=org_model,
                api_key=api_key,
                organization_id=organization_id,
            )
            # Merge read outputs into inputs for the DAG
            if read_result.captured_outputs:
                for node_outputs in read_result.captured_outputs.values():
                    if isinstance(node_outputs, dict):
                        enriched_inputs.update(node_outputs)
                logger.info("📖 Pre-DAG: merged read outputs into inputs")

        # Phase 2: Execute canvas DAG
        available_skills: dict[int, Any] = {}
        result = execute_steps_sync(
            step_executor=step_executor,
            steps=list(skill_config.steps),
            available_skills=available_skills,
            initial_inputs=enriched_inputs,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id,
        )

        logger.info(f"✅ Step-based execution complete: {skill_config.name}")

        # Post-DAG pipeline: source mapping → extraction → write
        skill_outputs = self._post_dag_output_pipeline(
            skill_config=skill_config,
            result=result,
            step_executor=step_executor,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id,
        )

        if skill_outputs:
            return SkillExecutionResult(
                result=result.result, captured_outputs=skill_outputs
            )

        return result

    def _process_skill_attachments(
        self,
        skill_config: SkillConfig,
    ) -> tuple[list[Image.Image], list[str]]:
        """Process attachments from skill_config.content (entity MessagePart objects)."""
        from ...entities.message import ImagePart, TextPart
        from ..data.image_processor import ImageProcessor

        images = []
        text_parts = []

        if not skill_config.content:
            return images, text_parts

        logger.info(
            f"📎 Processing {len(skill_config.content)} attachments from skill config"
        )

        try:
            image_urls = []
            for part in skill_config.content:
                if isinstance(part, TextPart):
                    text_parts.append(f"\n\n{part.text}")
                elif isinstance(part, ImagePart) and part.url:
                    image_urls.append(part.url)

            if image_urls:
                pil_images = run_async_in_thread(
                    ImageProcessor.download_images_from_urls(image_urls)
                )
                images.extend(pil_images)

            logger.info(
                f"✅ Processed: {len(images)} images, {len(text_parts)} text parts"
            )
        except Exception as e:
            logger.error(f"❌ Failed to process attachments: {e}")

        return images, text_parts

    def _build_message_parts_json(self, result: Any) -> str:
        """Build MessageParts JSON from DSPy module result (for chat mode).

        DSPy modules return strings or dicts, so we convert to MessageParts format.
        """
        message_parts = []

        if isinstance(result, dict):
            # Handle structured dict results
            if "image" in result or "image_url" in result:
                url = result.get("image") or result.get("image_url")
                logger.info(f"📸 Skill generated image: {url}")
                message_parts.append({"type": "image", "url": url})
            elif "audio" in result or "audio_url" in result:
                url = result.get("audio") or result.get("audio_url")
                logger.info(f"🔊 Skill generated audio: {url}")
                message_parts.append(
                    {
                        "type": "file",
                        "url": url,
                        "mime_type": "audio/wav",
                        "filename": "audio.wav",
                    }
                )
            else:
                # Convert dict to text
                text_content = json.dumps(result)
                logger.info("📝 Skill generated dict result")
                message_parts.append({"type": "text", "text": text_content})
        else:
            # String or other type - convert to text
            text_content = str(result)
            logger.info(f"📝 Skill generated text: {text_content[:100]}...")
            message_parts.append({"type": "text", "text": text_content})

        return json.dumps({"parts": message_parts})

    def create_executor_callback(
        self,
        org_model: str | None = None,
        return_message_parts: bool = False,
        api_key: str = "",
        organization_id: int = 0,
    ) -> Callable:
        """Create callback for SkillTool delegation.

        Accepts SkillConfig directly (callers pass DTOs, not protos).

        Returns:
            Callable that takes (skill_config, inputs, capture_outputs) and returns result
        """

        def callback(
            skill_config: SkillConfig,
            runtime_inputs: dict[str, Any],
            capture_outputs: bool = False,
        ) -> str | SkillExecutionResult:
            return self.execute_skill(
                skill_config=skill_config,
                runtime_inputs=runtime_inputs,
                org_model=org_model,
                capture_outputs=capture_outputs,
                return_message_parts=return_message_parts,
                api_key=api_key,
                organization_id=organization_id,
            )

        return callback
