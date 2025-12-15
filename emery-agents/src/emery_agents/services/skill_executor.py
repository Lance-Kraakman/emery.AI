"""
SkillExecutorService - Shared skill execution logic

Consolidates skill execution from:
- ChatProcessingService._create_skill_executor_callback()
- AgentExecutor._create_skill_executor()

Supports both agent mode (LLM orchestration) and operation mode (direct inference).
"""

import asyncio
import concurrent.futures
import json
import logging
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from PIL import Image

from ..clients import HuggingFaceInferenceClient, TaskResult
from ..grpc.generated import agent_worker_pb2
from ..prompts import render_output_instructions
from ..tools.output_tool import OutputTool
from .agent_factory import AgentFactory, AgentConfig
from .output_mapping_service import MappingContext, OutputMappingService
from .tool_loader import UnifiedToolLoader

logger = logging.getLogger(__name__)

# Shared thread pool for async operations
_async_thread_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=10, thread_name_prefix="skill-executor"
)


def _run_async_in_thread(coro) -> Any:
    """Run async coroutine in thread pool."""
    try:
        future = _async_thread_pool.submit(asyncio.run, coro)
        return future.result(timeout=30.0)
    except concurrent.futures.TimeoutError:
        logger.error("Async operation timed out after 30 seconds")
        raise TimeoutError("Operation exceeded 30 second timeout")
    except Exception as e:
        logger.error(f"Async operation failed: {e}")
        raise


class SkillExecutorService:
    """
    Shared skill execution service for chat and task modes.

    Handles both:
    - Agent mode: LLM orchestrates tool calls
    - Operation mode: Direct inference API calls
    """

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

    def _has_output_mappings(self, skill_config: 'agent_worker_pb2.SkillConfig') -> bool:
        """Check if skill has output mappings configured."""
        if not skill_config.outputs:
            return False
        for output in skill_config.outputs:
            if output.HasField('output_mapping') and len(output.output_mapping.mappings) > 0:
                return True
        return False

    def execute_skill(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str] = None,
        capture_outputs: bool = False,
        attachments: Optional[List[Any]] = None,
        return_message_parts: bool = False,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> Union[str, Tuple[str, Optional[Dict]]]:
        """
        Execute a skill via agent or direct operation.

        Args:
            skill_config: Full skill definition
            runtime_inputs: Runtime inputs from caller
            org_model: Organization default model (fallback)
            capture_outputs: If True, add OutputTool and return captured outputs
            attachments: Optional file attachments for skill context
            return_message_parts: If True, return MessageParts JSON (chat mode)
            api_key: API key for output mappings
            organization_id: Organization ID for output mappings

        Returns:
            str if capture_outputs=False
            tuple(str, dict|None) if capture_outputs=True
        """
        logger.info(f"🎯 Executing skill: {skill_config.name} (capture_outputs={capture_outputs})")

        try:
            if self._is_operation_skill(skill_config):
                return self._execute_operation(
                    skill_config, runtime_inputs,
                    api_key=api_key, organization_id=organization_id
                )
            else:
                return self._execute_agent(
                    skill_config, runtime_inputs, org_model,
                    capture_outputs, attachments, return_message_parts
                )
        except Exception as e:
            error_msg = f"Skill execution error: {str(e)}"
            logger.error(f"❌ Skill {skill_config.name} failed: {e}", exc_info=True)
            if capture_outputs:
                return error_msg, None
            return error_msg

    def _execute_agent(
        self,
        skill_config: 'agent_worker_pb2.SkillConfig',
        runtime_inputs: Dict[str, Any],
        org_model: Optional[str],
        capture_outputs: bool,
        attachments: Optional[List[Any]],
        return_message_parts: bool
    ) -> Union[str, Tuple[str, Optional[Dict]]]:
        """Execute skill via LLM agent orchestration."""

        # 1. Load skill's tools
        skill_tools = []
        if skill_config.tools:
            skill_tools = self.tool_loader.load_tools_from_configs(
                tool_configs=list(skill_config.tools),
                api_key=None,
                api_key_mode="user"
            )
            logger.info(f"🔧 Loaded {len(skill_tools)} tools for skill {skill_config.name}")

        # 2. Add OutputTool if capturing outputs
        output_tool = None
        if capture_outputs and skill_config.outputs:
            output_tool = OutputTool(skill_outputs=list(skill_config.outputs))
            skill_tools.append(output_tool)
            logger.info(f"📤 Added OutputTool for {len(list(skill_config.outputs))} outputs")

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
            output_instructions = render_output_instructions(list(skill_config.outputs))
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
            context_type="autonomous",
            skill_agent_type=skill_agent_type
        )
        sub_agent = self.agent_factory.create_agent(agent_config)
        logger.info(f"✨ Created sub-agent for skill {skill_config.name} (has_images={has_images})")

        # 6. Execute
        from smolagents.agent_types import AgentText, AgentImage, AgentAudio
        result = sub_agent.run(task=task, images=images if images else None, stream=False, reset=True)
        logger.info(f"🔍 Skill output type: {type(result).__name__}")

        # 7. Build result
        if return_message_parts:
            result_json = self._build_message_parts_json(result)
        else:
            result_json = str(result)

        logger.info(f"✅ Skill {skill_config.name} completed")

        # 8. Return with captured outputs if requested
        if capture_outputs:
            was_called = output_tool.was_called() if output_tool else False
            captured = output_tool.get_captured_values() if output_tool and was_called else None
            if captured:
                logger.info(f"📤 Captured outputs from submit_result: {list(captured.keys())}")
            else:
                logger.warning(f"⚠️ OutputTool was {'NOT ' if not was_called else ''}called, captured={captured}")
            return result_json, captured
        else:
            return result_json

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
        result: TaskResult = _run_async_in_thread(
            client.execute_task(
                model_id=model_id,
                task_type=task_type,
                inputs=runtime_inputs,
                parameters=parameters
            )
        )

        # Apply output mappings if configured
        if api_key and organization_id and self._has_output_mappings(skill_config):
            _run_async_in_thread(
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
            content_list = _run_async_in_thread(
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
        """Build MessageParts JSON from agent result (for chat mode)."""
        from smolagents.agent_types import AgentText, AgentImage, AgentAudio

        message_parts = []

        if isinstance(result, AgentImage):
            temp_path = result.to_string()
            logger.info(f"📸 Skill generated image: {temp_path}")
            message_parts.append({'type': 'image', 'url': temp_path})

        elif isinstance(result, AgentAudio):
            temp_path = result.to_string()
            logger.info(f"🔊 Skill generated audio: {temp_path}")
            message_parts.append({
                'type': 'file',
                'url': temp_path,
                'mime_type': 'audio/wav',
                'filename': 'audio.wav'
            })

        elif isinstance(result, (AgentText, str)):
            text_content = str(result)
            logger.info(f"📝 Skill generated text: {text_content[:100]}...")
            message_parts.append({'type': 'text', 'text': text_content})

        else:
            text_content = str(result)
            logger.info(f"❓ Skill generated unknown type, converting to text")
            message_parts.append({'type': 'text', 'text': text_content})

        return json.dumps({'parts': message_parts})

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
            if output.HasField('output_mapping') and len(output.output_mapping.mappings) > 0
        ]

        if not outputs_with_mappings:
            return

        logger.info(f"📊 Applying {len(outputs_with_mappings)} output mappings")

        ctx = MappingContext(api_key=api_key, organization_id=str(organization_id))

        for output in outputs_with_mappings:
            try:
                config = OutputMappingConfig.from_proto(output.output_mapping)

                # Prepare data for mapping
                if result.is_structured and isinstance(result.data, list) and result.data:
                    data = result.data[0] if config.is_single_row else result.data
                elif result.is_structured:
                    data = result.data
                elif result.is_text:
                    data = {'text': str(result.data)}
                else:
                    continue

                await OutputMappingService.apply_mapping(ctx=ctx, config=config, data=data)
                logger.info(f"✅ Applied output mapping for '{output.name}'")

            except Exception as e:
                logger.error(f"❌ Failed to apply output mapping for {output.name}: {e}")

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
        ) -> Union[str, Tuple[str, Optional[Dict]]]:
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
