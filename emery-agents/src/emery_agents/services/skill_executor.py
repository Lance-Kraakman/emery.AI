"""Shared skill execution for agent and operation modes."""

import json
import logging
from typing import Any, Callable, Dict, List, Literal, Optional, Tuple, Union, overload

from PIL import Image

from ..clients import HuggingFaceInferenceClient, TaskResult
from ..entities.skill_io import SkillOutputValue
from ..grpc.generated import agent_worker_pb2
from ..utils.output_instructions import render_output_instructions
from ..dspy_modules.tools.output import (
    OutputCollector,
    create_output_tool,
    build_target_field_metadata_from_mappings,
)
from ..types import SkillExecutionResult
from ..utils import run_async_in_thread
from ..utils.step_utils import step_to_progress_dict, RawProgressDict
from .agent_factory import AgentFactory, AgentConfig
from .output_mapping_service import MappingContext, OutputMappingService
from .step_executor import StepExecutorService, execute_steps_sync
from .tool_loader import UnifiedToolLoader

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
    """Executes skills via agent (LLM orchestration) or operation (direct inference)."""

    def __init__(
        self,
        tool_loader: UnifiedToolLoader,
        agent_factory: AgentFactory,
        inference_client: Optional[HuggingFaceInferenceClient] = None
    ):
        self.tool_loader = tool_loader
        self.agent_factory = agent_factory
        self._inference_client = inference_client

    def _get_inference_client(self) -> HuggingFaceInferenceClient:
        """Get or create inference client (lazy init)."""
        if self._inference_client is None:
            self._inference_client = HuggingFaceInferenceClient()
        return self._inference_client

    def _is_operation_skill(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill uses direct operation execution."""
        return skill_config.execution_type == 'operation'

    def _is_tool_skill(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill uses direct tool execution (no LLM)."""
        return skill_config.execution_type == 'tool'

    def _is_write_skill(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill uses direct table write (no LLM)."""
        return skill_config.execution_type == 'write'

    def _is_read_skill(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill uses direct table read (no LLM)."""
        return skill_config.execution_type == 'read'

    def _is_agentic_skill(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill uses agentic execution (flat instructions, LLM orchestration)."""
        # 'agentic' is the explicit type, but also treat empty/missing as agentic for backwards compat
        return skill_config.execution_type in ('agentic', '', None) or not skill_config.execution_type

    def _is_agent_skill(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill uses step-based agent execution (DAG workflow)."""
        return skill_config.execution_type == 'agent' and len(skill_config.steps) > 0

    def _has_output_mappings(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill has output mappings configured."""
        if not skill_config.outputs:
            return False
        for output in skill_config.outputs:
            if output.HasField('output_mapping') and len(output.output_mapping.table_mappings) > 0:
                return True
        return False

    @overload
    def execute_skill(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
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
        skill_config: 'agent_worker_pb2.SkillConfig',
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
        skill_config: 'agent_worker_pb2.SkillConfig',
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str] = None,
        capture_outputs: bool = False,
        attachments: Optional[List[Any]] = None,
        return_message_parts: bool = False,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Union[str, SkillExecutionResult]:
        """
        Execute a skill via agent or direct operation.

        Args:
            skill_config: Full skill definition
            runtime_inputs: Runtime inputs from caller
            org_model: Organization default model (fallback)
            capture_outputs: If True, add OutputTool and return SkillExecutionResult with captured outputs
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
            if self._is_tool_skill(skill_config):
                return self._execute_tool(
                    skill_config, runtime_inputs,
                    api_key=api_key, organization_id=organization_id
                )
            elif self._is_write_skill(skill_config):
                return self._execute_write(
                    skill_config, runtime_inputs,
                    api_key=api_key, organization_id=organization_id
                )
            elif self._is_read_skill(skill_config):
                return self._execute_read(
                    skill_config, runtime_inputs,
                    api_key=api_key, organization_id=organization_id
                )
            elif self._is_operation_skill(skill_config):
                return self._execute_operation(
                    skill_config, runtime_inputs,
                    api_key=api_key, organization_id=organization_id
                )
            elif self._is_agent_skill(skill_config):
                # Step-based DAG execution
                return self._execute_steps(
                    skill_config, runtime_inputs, org_model,
                    api_key=api_key, organization_id=organization_id
                )
            else:
                # Agentic execution (flat instructions, LLM orchestration)
                return self._execute_agent(
                    skill_config, runtime_inputs, org_model,
                    capture_outputs, attachments, return_message_parts,
                    progress_callback=progress_callback
                )
        except Exception as e:
            error_msg = f"Skill execution error: {str(e)}"
            logger.error(f"❌ Skill {skill_config.name} failed: {e}", exc_info=True)
            if capture_outputs:
                return SkillExecutionResult(result=error_msg, captured_outputs=None)
            return error_msg

    def _execute_agent(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
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

        # 2. Add output tool if capturing outputs
        #
        # TODO: Support node→skill output separation
        # Currently output tool uses skill_config.outputs directly.
        # Future enhancement: Use step.output_defs for output tool, then map
        # captured node outputs → skill outputs based on output.source config.
        # See: OutputSource type in skill.ts (nodeId, outputName)
        #
        output_collector = None
        if capture_outputs and skill_config.outputs:
            # Extract target field metadata from output mappings for rich LLM guidance
            target_metadata = build_target_field_metadata_from_mappings(list(skill_config.outputs))
            output_collector = OutputCollector()
            output_tool = create_output_tool(
                output_collector,
                skill_outputs=list(skill_config.outputs),
                target_field_metadata=target_metadata
            )
            skill_tools.append(output_tool)
            logger.info(f"📤 Added output tool for {len(list(skill_config.outputs))} outputs")

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

        # Add output instructions if capturing
        if capture_outputs and skill_config.outputs:
            # Build target field metadata for type-aware guidance
            target_metadata = build_target_field_metadata_from_mappings(list(skill_config.outputs))
            target_meta_dict = {
                name: {
                    'field_type': meta.field_type,
                    'options': meta.options,
                    'max_selections': meta.max_selections
                }
                for name, meta in target_metadata.items()
            }
            output_instructions = render_output_instructions(
                list(skill_config.outputs),
                target_field_metadata=target_meta_dict
            )
            if output_instructions:
                task_parts.append(f"\n\n{output_instructions}")
                logger.info(f"📤 Added output capture instructions ({len(output_instructions)} chars)")

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
        if capture_outputs:
            was_called = output_collector.was_called() if output_collector else False
            captured = output_collector.get_captured_values() if output_collector and was_called else None

            # Check for extraction failure
            if not was_called:
                logger.error("❌ Output tool was NOT called - skill execution failed")
                return SkillExecutionResult(
                    result="FAILED: Skill did not submit results. Data extraction may have failed.",
                    captured_outputs=None
                )

            # Check if all values are null (complete extraction failure)
            if captured and all(v is None for v in captured.values()):
                logger.error("❌ No data was extracted - all fields were null")
                return SkillExecutionResult(
                    result="FAILED: No data could be extracted from the input.",
                    captured_outputs=None
                )

            if captured:
                extracted = sum(1 for v in captured.values() if v is not None)
                logger.info(f"📤 Captured {extracted}/{len(captured)} outputs from submit_result")
            else:
                logger.warning(f"⚠️ No captured outputs")

            return SkillExecutionResult(result=result_json, captured_outputs=captured)
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

    def _execute_operation(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
        runtime_inputs: Dict[str, Any],
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> str:
        """Execute skill via direct inference API (no LLM orchestration)."""
        task_config = skill_config.task_model_config
        if not task_config:
            raise ValueError(f"Operation skill '{skill_config.name}' missing task_model_config")

        model_id = task_config.model_id
        task_type = task_config.task_type
        parameters = dict(task_config.parameters) if task_config.parameters else {}

        logger.info(f"🚀 Direct skill execution: {skill_config.name}")
        logger.info(f"   Model: {model_id}, Task: {task_type}")

        client = self._get_inference_client()

        if not client.supports_task_type(task_type):
            raise ValueError(
                f"Task type '{task_type}' not supported. "
                f"Supported: {client.supported_task_types}"
            )

        # Execute synchronously (wrap async)
        result: TaskResult = run_async_in_thread(
            client.execute_task(
                model_id=model_id,
                task_type=task_type,
                inputs=runtime_inputs,
                parameters=parameters
            )
        )

        # Apply output mappings if configured
        if api_key and organization_id and self._has_output_mappings(skill_config):
            run_async_in_thread(
                self._apply_operation_output_mappings(
                    skill_config, result, api_key, organization_id
                )
            )

        # Return result as string
        if result.is_text:
            return str(result.data)
        elif result.is_structured:
            return json.dumps(result.data)
        else:
            return f"Binary result: {len(result.data)} bytes"

    def _execute_tool(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
        runtime_inputs: Dict[str, Any],
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> str:
        """Execute skill via direct Pipedream tool call (no LLM orchestration).

        Args:
            skill_config: Skill configuration with tool_execution_config
            runtime_inputs: Runtime inputs from caller
            api_key: API key for Pipedream tools
            organization_id: Organization ID for context

        Returns:
            Tool execution result as string
        """
        tool_config = skill_config.tool_execution_config
        if not tool_config or not tool_config.tool_id:
            raise ValueError(f"Tool skill '{skill_config.name}' missing tool_execution_config.tool_id")

        tool_id = tool_config.tool_id
        logger.info(f"🔧 Direct tool execution: {skill_config.name} -> {tool_id}")

        # Build tool inputs from mappings
        tool_inputs = {}
        for mapping in tool_config.input_mappings:
            if mapping.skill_input_name:
                # Map from skill input
                value = runtime_inputs.get(mapping.skill_input_name)
                if value is not None:
                    tool_inputs[mapping.tool_param] = value
            elif mapping.static_value:
                # Use static value
                tool_inputs[mapping.tool_param] = mapping.static_value

        logger.info(f"   Tool inputs: {list(tool_inputs.keys())}")

        # Load the specific Pipedream tool
        from ..grpc.generated.agent_worker_pb2 import ToolConfig as ProtoToolConfig
        proto_tool_config = ProtoToolConfig(
            name=tool_id,
            tool_type="pipedream",
            config={}
        )

        tools = self.tool_loader.load_tools_from_configs(
            tool_configs=[proto_tool_config],
            api_key=api_key,
            api_key_mode="user"
        )

        if not tools:
            raise ValueError(f"Failed to load Pipedream tool: {tool_id}")

        tool = tools[0]
        logger.info(f"   Loaded tool: {tool.name}")

        # Execute the tool directly
        try:
            result = tool.forward(**tool_inputs)
            logger.info(f"✅ Tool execution complete: {skill_config.name}")

            # Convert result to string
            if isinstance(result, dict):
                return json.dumps(result)
            elif isinstance(result, str):
                return result
            else:
                return str(result)
        except Exception as e:
            logger.error(f"❌ Tool execution failed: {e}")
            raise

    def _execute_write(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
        runtime_inputs: Dict[str, Any],
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> str:
        """Execute skill via direct table write (no LLM orchestration).

        Args:
            skill_config: Skill configuration with write_config
            runtime_inputs: Runtime inputs from caller
            api_key: API key for authentication
            organization_id: Organization ID for RLS context

        Returns:
            Write operation result as string
        """
        import os
        import httpx

        write_config = skill_config.write_config
        if not write_config or not write_config.target_table_id:
            raise ValueError(f"Write skill '{skill_config.name}' missing write_config.target_table_id")

        table_id = write_config.target_table_id
        row_action = write_config.row_action or 'create'

        logger.info(f"📝 Direct table write: {skill_config.name} -> table {table_id} ({row_action})")

        # Build field values from mappings
        # Field mappings map skill inputs to table field IDs (as strings for the API)
        field_values = {}
        for mapping in write_config.field_mappings:
            skill_input = mapping.skill_input_name
            field_id = str(mapping.target_field_id)

            if skill_input in runtime_inputs:
                field_values[field_id] = runtime_inputs[skill_input]

        logger.info(f"   Field mappings: {len(field_values)} fields")

        # Build API request
        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        base_url = f"{nextjs_base}/api"

        headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        if organization_id:
            headers["X-Organization-ID"] = str(organization_id)

        try:
            with httpx.Client(timeout=30.0) as client:
                if row_action == 'create':
                    # Create new row
                    response = client.post(
                        f"{base_url}/rows",
                        headers=headers,
                        json={"tableId": table_id, "data": field_values}
                    )
                elif row_action == 'update':
                    # Update existing row - need to find it first using update_match
                    if not write_config.update_match:
                        raise ValueError("Write skill update mode requires update_match configuration")

                    match_input = write_config.update_match.skill_input_name
                    match_field_id = str(write_config.update_match.target_field_id)

                    if match_input not in runtime_inputs:
                        raise ValueError(f"Update match input '{match_input}' not in runtime inputs")

                    match_value = runtime_inputs[match_input]

                    # For now, we pass the match info and let the API handle the lookup
                    # The API route will need to support this pattern
                    response = client.put(
                        f"{base_url}/rows",
                        headers=headers,
                        json={
                            "tableId": table_id,
                            "matchField": match_field_id,
                            "matchValue": match_value,
                            "data": field_values
                        }
                    )
                else:
                    raise ValueError(f"Unknown row_action: {row_action}")

                if response.status_code >= 400:
                    error_detail = response.text[:500]
                    logger.error(f"❌ Table write failed: {response.status_code} - {error_detail}")
                    raise ValueError(f"Table write failed: {error_detail}")

                result = response.json()
                logger.info(f"✅ Table write complete: {skill_config.name}")
                return json.dumps(result)

        except httpx.RequestError as e:
            logger.error(f"❌ Table write request failed: {e}")
            raise ValueError(f"Table write request failed: {e}")

    def _execute_read(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
        runtime_inputs: Dict[str, Any],
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> SkillExecutionResult:
        """Execute skill via direct table read (no LLM orchestration).

        Args:
            skill_config: Skill configuration with read_config
            runtime_inputs: Runtime inputs from caller
            api_key: API key for authentication
            organization_id: Organization ID for RLS context

        Returns:
            SkillExecutionResult with read data mapped to output variables
        """
        import os
        import httpx

        read_config = skill_config.read_config
        if not read_config or not read_config.source_table_id:
            raise ValueError(f"Read skill '{skill_config.name}' missing read_config.source_table_id")

        table_id = read_config.source_table_id
        mode = read_config.mode or 'single_row'

        logger.info(f"📖 Direct table read: {skill_config.name} -> table {table_id} ({mode})")

        # Build API request
        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        base_url = f"{nextjs_base}/api"

        headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        if organization_id:
            headers["X-Organization-ID"] = str(organization_id)

        try:
            with httpx.Client(timeout=30.0) as client:
                if mode == 'single_row':
                    # Single row read - resolve row ID from source
                    row_id = self._resolve_row_id_source(read_config.row_id_source, runtime_inputs)
                    if not row_id:
                        raise ValueError("Could not resolve row ID for single_row read")

                    response = client.get(
                        f"{base_url}/rows/{table_id}/{row_id}",
                        headers=headers
                    )
                    if response.status_code >= 400:
                        error_detail = response.text[:500]
                        logger.error(f"❌ Table read failed: {response.status_code} - {error_detail}")
                        raise ValueError(f"Table read failed: {error_detail}")

                    row = response.json()
                    rows = [row] if row else []

                else:  # query mode
                    # Build query filters
                    filters = self._build_query_filters(read_config.query_filters, runtime_inputs)
                    limit = read_config.query_limit or 100

                    # Build filter params for API
                    params = {"limit": limit}
                    for i, f in enumerate(filters):
                        params[f"filter[field_{f['field_id']}]"] = f"{f['operator']}:{f['value']}"

                    response = client.get(
                        f"{base_url}/rows/{table_id}",
                        headers=headers,
                        params=params
                    )
                    if response.status_code >= 400:
                        error_detail = response.text[:500]
                        logger.error(f"❌ Table query failed: {response.status_code} - {error_detail}")
                        raise ValueError(f"Table query failed: {error_detail}")

                    result = response.json()
                    rows = result.get("rows", []) if isinstance(result, dict) else result

                # Map fields to output variables
                outputs = {}
                for mapping in read_config.field_mappings:
                    field_key = f"field_{mapping.source_field_id}"
                    target_var = mapping.target_variable

                    if mode == 'single_row' and rows:
                        outputs[target_var] = rows[0].get(field_key)
                    else:
                        outputs[target_var] = [r.get(field_key) for r in rows]

                logger.info(f"✅ Table read complete: {skill_config.name}, {len(outputs)} outputs")
                return SkillExecutionResult(
                    result=json.dumps({"rows": rows, "count": len(rows)}),
                    captured_outputs=outputs
                )

        except httpx.RequestError as e:
            logger.error(f"❌ Table read request failed: {e}")
            raise ValueError(f"Table read request failed: {e}")

    def _resolve_row_id_source(
        self,
        row_id_source: 'agent_worker_pb2.RowIdSource',
        runtime_inputs: Dict[str, Any]
    ) -> Optional[str]:
        """Resolve row ID from source configuration."""
        if not row_id_source:
            return None

        source_type = row_id_source.type
        if source_type == 'static':
            return row_id_source.static_id
        elif source_type == 'skill_input':
            input_name = row_id_source.skill_input
            return str(runtime_inputs.get(input_name, ''))
        elif source_type == 'skill_output':
            # For skill_output, we'd need step context - not available at skill level
            return row_id_source.skill_output
        else:
            logger.warning(f"Unknown row_id_source type: {source_type}")
            return None

    def _build_query_filters(
        self,
        query_filters: List['agent_worker_pb2.QueryFilter'],
        runtime_inputs: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Build query filters from proto config."""
        filters = []
        for qf in query_filters:
            field_id = qf.field_id
            operator = qf.operator

            # Resolve value from source
            value_source = qf.value_source
            if value_source.type == 'static':
                value = value_source.static_id
            elif value_source.type == 'skill_input':
                value = runtime_inputs.get(value_source.skill_input, '')
            else:
                value = ''

            filters.append({
                "field_id": field_id,
                "operator": operator,
                "value": value
            })

        return filters

    def _execute_steps(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
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

        # Build available skills map for delegation (skill_id -> config)
        # For now, we don't have access to other skills in this context
        # This would need to be passed in from the parent executor
        available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'] = {}

        # Execute steps synchronously
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
        skill_config: 'agent_worker_pb2.SkillConfig'
    ) -> Tuple[List[Image.Image], List[str]]:
        """Process attachments from skill_config.content."""
        images = []
        text_parts = []

        if not skill_config.content:
            return images, text_parts

        logger.info(f"📎 Processing {len(skill_config.content)} attachments from skill config")

        try:
            from ..grpc.mappers.message_mapper import proto_parts_to_smolagents_content
            content_list = run_async_in_thread(
                proto_parts_to_smolagents_content(skill_config.content)
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

    async def _apply_operation_output_mappings(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
        result: TaskResult,
        api_key: str,
        organization_id: int
    ) -> None:
        """Apply output mappings for operation mode results."""
        from ..entities.output_mapping import OutputMappingConfig

        outputs_with_mappings = [
            output for output in skill_config.outputs
            if output.HasField('output_mapping') and len(output.output_mapping.table_mappings) > 0
        ]

        if not outputs_with_mappings:
            return

        logger.info(f"📊 Applying {len(outputs_with_mappings)} output mappings")

        ctx = MappingContext(api_key=api_key, organization_id=str(organization_id))

        # Convert TaskResult to SkillOutputValue list using centralized method
        skill_outputs = result.to_skill_outputs()

        # Use first output's mapping config (UI stores all table mappings on outputs[0])
        first_output = outputs_with_mappings[0]

        try:
            config = OutputMappingConfig.from_proto(first_output.output_mapping)
            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx,
                config=config,
                skill_outputs=skill_outputs
            )
            logger.info(f"✅ Operation output mapping complete: {len(results)} tables updated")
        except Exception as e:
            logger.error(f"❌ Failed to apply operation output mapping: {e}")

    def create_executor_callback(
        self,
        org_model: Optional[str] = None,
        return_message_parts: bool = False,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> Callable:
        """
        Create callback for SkillTool delegation.

        Args:
            org_model: Organization default model
            return_message_parts: If True, return MessageParts JSON (chat mode)
            api_key: API key for output mappings
            organization_id: Organization ID for output mappings

        Returns:
            Callable that takes (skill_config, inputs, capture_outputs) and returns result
        """
        def callback(
            skill_config: 'agent_worker_pb2.SkillConfig',
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
