"""Shared skill execution for agent and operation modes.

AIDEV-NOTE: Only supports 'agentic' and 'workflow' execution types.
Dead code for 'operation', 'tool', 'read', 'write' modes removed Jan 2026.
DTO migration: executor accepts SkillConfigDTO only. Proto converted at boundary.
"""

import json
import logging
from typing import Any, Callable, Dict, List, Literal, Optional, Tuple, Union, overload

from PIL import Image

from ...entities.skill_config import (
    SkillConfigDTO, SkillStepDTO,
    AgenticStepConfig as AgenticStepConfigDTO,
    ReadConfig as ReadConfigDTO, WriteConfig as WriteConfigDTO,
    RowIdSource, ReadFieldMapping, WriteFieldMapping,
)
from ...entities.task import SkillOutputValue
from ...reasoning.modules.extractor import OutputExtractorModule
from ...types import SkillExecutionResult
from ...utils.step_utils import step_to_progress_dict, RawProgressDict
from ..agents.factory import AgentFactory, AgentConfig
from .step_executor import StepExecutorService, execute_steps_sync
from ..tools.loader import UnifiedToolLoader
from ...entities.models.plan import Plan


logger = logging.getLogger(__name__)


def map_node_outputs_to_skill_outputs(
    all_node_outputs: Dict[str, Dict[str, Any]],
    skill_outputs: List[Any]
) -> Dict[str, Any]:
    """Map captured node outputs to skill outputs via source config.

    Args:
        all_node_outputs: Dict mapping node_id/step_name to its captured outputs
        skill_outputs: Skill-level output definitions with source config

    Returns:
        Dict mapping skill output name to value
    """
    result = {}

    for output in skill_outputs:
        source = getattr(output, 'source', None)
        if source and getattr(source, 'type', None) == 'node_output':
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

    Accepts SkillConfigDTO only. Proto callers convert at boundary via
    SkillConfigDTO.from_proto() in create_executor_callback().
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
        skill_config: SkillConfigDTO,
    ) -> Optional[Plan]:
        """Extract stored plan from skill's agentic step configuration.

        Returns:
            Plan entity if found, None otherwise
        """

        for step in skill_config.steps:
            if step.agentic_config and step.agentic_config.plan:
                return step.agentic_config.plan
        return None

    def _build_wrapper_dag(
        self,
        skill_config: SkillConfigDTO,
        runtime_inputs: Dict[str, Any],
    ) -> List[SkillStepDTO]:
        """Build wrapper DAG from agentic skill config.

        Generates:
        - Read step (if skill has input mappings)
        - Agentic step (always, with stored plan)
        - Write step (if skill has output mappings)

        Returns:
            List of SkillStepDTO for DAG execution
        """
        steps: List[SkillStepDTO] = []

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

        agentic_step = SkillStepDTO(
            id=f"agentic_{skill_config.id}",
            name=skill_config.name,
            step_type="agentic",
            agentic_config=agentic_config,
        )
        steps.append(agentic_step)

        # Step 3: Generate Write step from output mappings
        write_step = self._build_write_step_from_outputs(skill_config)
        if write_step:
            steps.append(write_step)
            logger.info(f"📝 Generated Write step for skill {skill_config.name}")

        logger.info(f"📋 Built wrapper DAG: {len(steps)} steps for skill {skill_config.name}")
        return steps

    def _build_read_step_from_inputs(
        self,
        skill_config: SkillConfigDTO,
    ) -> Optional[SkillStepDTO]:
        """Generate Read step from skill input mappings.

        Returns:
            SkillStepDTO with read_config, or None if no input mappings
        """
        inputs_with_mapping = [
            inp for inp in skill_config.inputs
            if inp.input_mapping is not None
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
                field_mappings.append(ReadFieldMapping(
                    source_field_id=source["field_id"],
                    target_variable=inp.name,
                ))

        read_config = ReadConfigDTO(
            mode="single_row",
            source_table_id=first_source["table_id"],
            row_id_source=row_id_source,
            field_mappings=field_mappings,
        )

        return SkillStepDTO(
            id=f"read_{skill_config.id}",
            name=f"Read inputs for {skill_config.name}",
            step_type="read",
            read_config=read_config,
        )

    def _build_write_step_from_outputs(
        self,
        skill_config: SkillConfigDTO,
    ) -> Optional[SkillStepDTO]:
        """Generate Write step from skill output mappings.

        Returns:
            SkillStepDTO with write_config, or None if no output mappings
        """
        outputs_with_mapping = [
            out for out in skill_config.outputs
            if out.output_mapping is not None
            and len(out.output_mapping.get("table_mappings", [])) > 0
        ]

        if not outputs_with_mapping:
            return None

        # Use first table mapping as target
        first_table = outputs_with_mapping[0].output_mapping["table_mappings"][0]

        field_mappings = []
        for fm in first_table.get("field_mappings", []):
            field_mappings.append(WriteFieldMapping(
                skill_input_name=fm["source_name"],
                target_field_id=fm["field_id"],
            ))

        write_config = WriteConfigDTO(
            target_table_id=first_table["table_id"],
            row_action=first_table.get("row_action", "create"),
            field_mappings=field_mappings,
        )

        return SkillStepDTO(
            id=f"write_{skill_config.id}",
            name=f"Write outputs for {skill_config.name}",
            step_type="write",
            write_config=write_config,
        )

    @overload
    def execute_skill(
        self,
        skill_config: SkillConfigDTO,
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str] = None,
        capture_outputs: Literal[False] = False,
        attachments: Optional[List[Any]] = None,
        return_message_parts: bool = False,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> str: ...

    @overload
    def execute_skill(
        self,
        skill_config: SkillConfigDTO,
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str] = None,
        capture_outputs: Literal[True] = ...,
        attachments: Optional[List[Any]] = None,
        return_message_parts: bool = False,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> SkillExecutionResult: ...

    def execute_skill(
        self,
        skill_config: SkillConfigDTO,
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str] = None,
        capture_outputs: bool = False,
        attachments: Optional[List[Any]] = None,
        return_message_parts: bool = False,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Union[str, SkillExecutionResult]:
        """Execute a skill.

        Args:
            skill_config: SkillConfigDTO (from API or proto boundary)
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
        logger.info(f"🎯 Executing skill: {skill_config.name} (capture_outputs={capture_outputs})")

        try:
            if skill_config.is_workflow():
                return self._execute_steps(
                    skill_config, runtime_inputs, org_model,
                    api_key=api_key, organization_id=organization_id
                )
            else:
                return self._execute_agentic(
                    skill_config, runtime_inputs, org_model,
                    capture_outputs, api_key, organization_id
                )
        except Exception as e:
            error_msg = f"Skill execution error: {str(e)}"
            logger.error(f"❌ Skill {skill_config.name} failed: {e}", exc_info=True)
            if capture_outputs:
                return SkillExecutionResult(result=error_msg, captured_outputs=None)
            return error_msg

    def _execute_agentic(
        self,
        skill_config: SkillConfigDTO,
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str],
        capture_outputs: bool,
        api_key: Optional[str],
        organization_id: Optional[int],
    ) -> Union[str, SkillExecutionResult]:
        """Execute agentic skill via unified StepExecutorService path.

        Builds a wrapper DAG: [Read Node?] → [Agentic Node] → [Write Node?]
        This ensures consistent execution regardless of how the skill is invoked.
        """
        # Build wrapper DAG steps for StepExecutorService
        steps = self._build_wrapper_dag(skill_config, runtime_inputs)

        if not steps:
            raise ValueError(f"Failed to build wrapper DAG for skill {skill_config.name}")

        # Require stored plan for agentic skills
        if not self._extract_plan_from_skill(skill_config):
            raise ValueError(
                f"Agentic skill '{skill_config.name}' requires a stored plan. "
                f"No fallback execution available."
            )

        # Create step executor with callback for skill delegation
        step_executor = StepExecutorService(
            tool_loader=self.tool_loader,
            agent_factory=self.agent_factory,
            skill_executor_callback=self.create_executor_callback(
                org_model=org_model,
                return_message_parts=False,
                api_key=api_key,
                organization_id=organization_id
            )
        )

        # Execute steps synchronously
        result = execute_steps_sync(
            step_executor=step_executor,
            steps=steps,
            available_skills={},
            initial_inputs=runtime_inputs,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id
        )

        logger.info(f"✅ Agentic skill execution complete: {skill_config.name}")

        # Map node outputs to skill outputs via source config
        if skill_config.outputs and result.captured_outputs:
            skill_outputs = map_node_outputs_to_skill_outputs(
                all_node_outputs=result.captured_outputs,
                skill_outputs=list(skill_config.outputs)
            )
            logger.info(f"📤 Mapped node outputs to skill outputs: {list(skill_outputs.keys())}")
            return SkillExecutionResult(
                result=result.result,
                captured_outputs=skill_outputs
            )

        if capture_outputs:
            return result
        return result.result

    def _execute_agent(
        self,
        skill_config: SkillConfigDTO,
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str],
        capture_outputs: bool,
        attachments: Optional[List[Any]],
        return_message_parts: bool,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Union[str, SkillExecutionResult]:
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
                api_key=None,
                api_key_mode="user"
            )
            logger.info(f"🔧 Loaded {len(skill_tools)} tools for skill {skill_config.name}")

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
            max_steps=10,
            agent_name=f"skill_{skill_config.name}",
            agent_description=skill_config.description,
            enable_caching=False,
            use_code_execution=skill_agent_type == "code_agent",
        )
        executor_module = self.agent_factory.create_agent(agent_config)
        logger.info(f"✨ Created DSPy executor for skill {skill_config.name} (has_images={has_images})")

        # 6. Execute using DSPy module
        # Build context with task and image info
        import json as json_module
        context_str = json_module.dumps({
            "task": task,
            "skill": skill_config.name,
            "has_images": len(images) > 0 if images else False,
            "image_count": len(images) if images else 0,
        })

        # Emit progress start if callback provided
        if progress_callback:
            progress_callback({
                "skill_name": skill_config.name,
                "step_type": "action",
                "step_index": 0,
                "content": f"Executing skill: {skill_config.name}",
            })

        result = executor_module.forward(
            step_description=task,
            context=context_str,
        )

        # Emit progress complete if callback provided
        if progress_callback:
            progress_callback({
                "skill_name": skill_config.name,
                "step_type": "final",
                "step_index": 1,
                "content": "Skill execution completed",
            })

        logger.info(f"🔍 Skill output type: {type(result).__name__}")

        # 7. Build result
        if return_message_parts:
            result_json = self._build_message_parts_json(result)
        else:
            result_json = str(result)

        logger.info(f"✅ Skill {skill_config.name} completed")

        # 8. Return with captured outputs if requested
        if capture_outputs and skill_config.outputs:
            # Extract outputs using DSPy module (separate extraction step)
            extractor = OutputExtractorModule(
                skill_outputs=[{
                    'name': o.name,
                    'type': o.type,
                    'description': o.description
                } for o in skill_config.outputs]
            )
            captured = extractor.extract(content=result_json)

            # Check if all values are null (complete extraction failure)
            if captured and all(v is None for v in captured.values()):
                logger.error("No data was extracted - all fields were null")
                return SkillExecutionResult(
                    result="FAILED: No data could be extracted from the input.",
                    captured_outputs=None
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
        self,
        step: Any,
        index: int,
        skill_name: str
    ) -> Optional[RawProgressDict]:
        """Delegate to shared utility for step-to-dict conversion."""
        return step_to_progress_dict(step, index, skill_name, name_key="skill_name")

    def _execute_steps(
        self,
        skill_config: SkillConfigDTO,
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> SkillExecutionResult:
        """Execute skill via step-based DAG workflow.

        Args:
            skill_config: Skill configuration with steps[]
            runtime_inputs: Runtime inputs from caller
            org_model: Organization default model (fallback)
            api_key: API key for authenticated calls
            organization_id: Organization ID for RLS context

        Returns:
            SkillExecutionResult with results from all steps
        """
        logger.info(f"🚀 Step-based execution: {skill_config.name} ({len(skill_config.steps)} steps)")

        # Create step executor with callback for skill delegation
        step_executor = StepExecutorService(
            tool_loader=self.tool_loader,
            agent_factory=self.agent_factory,
            skill_executor_callback=self.create_executor_callback(
                org_model=org_model,
                return_message_parts=False,
                api_key=api_key,
                organization_id=organization_id
            )
        )

        available_skills: Dict[int, Any] = {}

        # Execute steps synchronously (DTO steps passed directly)
        result = execute_steps_sync(
            step_executor=step_executor,
            steps=list(skill_config.steps),
            available_skills=available_skills,
            initial_inputs=runtime_inputs,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id
        )

        logger.info(f"✅ Step-based execution complete: {skill_config.name}")

        # Map node outputs to skill outputs via source config
        if skill_config.outputs and result.captured_outputs:
            skill_outputs = map_node_outputs_to_skill_outputs(
                all_node_outputs=result.captured_outputs,
                skill_outputs=list(skill_config.outputs)
            )
            logger.info(f"📤 Mapped node outputs to skill outputs: {list(skill_outputs.keys())}")
            return SkillExecutionResult(
                result=result.result,
                captured_outputs=skill_outputs
            )

        return result

    def _process_skill_attachments(
        self,
        skill_config: SkillConfigDTO,
    ) -> Tuple[List[Image.Image], List[str]]:
        """Process attachments from skill_config.content (raw proto MessagePart objects)."""
        images = []
        text_parts = []

        if not skill_config.content:
            return images, text_parts

        logger.info(f"📎 Processing {len(skill_config.content)} attachments from skill config")

        try:
            from ..grpc.mappers.message_mapper import proto_parts_to_content
            content_list = run_async_in_thread(
                proto_parts_to_content(skill_config.content)
            )

            for content_item in content_list:
                if content_item["type"] == "image":
                    images.append(content_item["image"])
                elif content_item["type"] == "text":
                    text_parts.append(f"\n\n{content_item['text']}")

            logger.info(f"✅ Processed: {len(images)} images, {len(text_parts)} text parts")
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
                message_parts.append({
                    "type": "file",
                    "url": url,
                    "mime_type": "audio/wav",
                    "filename": "audio.wav",
                })
            else:
                # Convert dict to text
                text_content = json.dumps(result)
                logger.info(f"📝 Skill generated dict result")
                message_parts.append({"type": "text", "text": text_content})
        else:
            # String or other type - convert to text
            text_content = str(result)
            logger.info(f"📝 Skill generated text: {text_content[:100]}...")
            message_parts.append({"type": "text", "text": text_content})

        return json.dumps({"parts": message_parts})

    def create_executor_callback(
        self,
        org_model: Optional[str] = None,
        return_message_parts: bool = False,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> Callable:
        """Create callback for SkillTool delegation.

        Accepts SkillConfigDTO directly (callers pass DTOs, not protos).

        Returns:
            Callable that takes (skill_config, inputs, capture_outputs) and returns result
        """
        def callback(
            skill_config: SkillConfigDTO,
            runtime_inputs: Dict[str, Any],
            capture_outputs: bool = False
        ) -> Union[str, SkillExecutionResult]:
            return self.execute_skill(
                skill_config=skill_config,
                runtime_inputs=runtime_inputs,
                org_model=org_model,
                capture_outputs=capture_outputs,
                return_message_parts=return_message_parts,
                api_key=api_key,
                organization_id=organization_id
            )

        return callback
