"""Wraps skills as smolagents tools with recursion protection."""

import hashlib
import json
import logging
import os
import re
import threading
from io import BytesIO
from typing import Any, Callable, Dict, Optional, Set, Union, TYPE_CHECKING

from jinja2 import Template
from smolagents import Tool

from ..entities.output_mapping import OutputMappingConfig
from ..entities.skill_io import SkillInputValue, SkillOutputValue, RowMappingContext
from ..grpc.generated.agent_worker_pb2 import SkillConfig
from ..services.file_processor import download_file
from ..services.image_processor import ImageProcessor
from ..services.output_mapping_service import OutputMappingService, MappingContext
from ..types import SkillExecutionResult
from ..utils import run_async_in_thread

if TYPE_CHECKING:
    from ..clients import HuggingFaceInferenceClient
    from ..services.agent_executor import AgentExecutor

logger = logging.getLogger(__name__)


class SkillTool(Tool):
    """Executes a skill via callback. Thread-local call stack prevents circular calls."""

    MAX_DEPTH = 10
    _thread_local = threading.local()
    skip_forward_signature_validation = True  # Dynamic inputs per smolagents pattern

    def __init__(
        self,
        skill_config: SkillConfig,
        skill_executor: Callable[[SkillConfig, Dict[str, Any]], str],
        inference_client: Optional["HuggingFaceInferenceClient"] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ):
        super().__init__()

        self.skill_config = skill_config
        self.skill_executor = skill_executor
        self.inference_client = inference_client
        self.api_key = api_key
        self.organization_id = organization_id

        # Base URL for API calls (output mapping)
        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        self.api_base_url = f"{nextjs_base}/api"

        # Tool metadata for the LLM
        self.name = f"skill_{skill_config.name.replace('-', '_').replace(' ', '_')}"
        self.description = skill_config.description or f"Execute the {skill_config.name} skill"
        self.output_type = "string"

        # Convert skill inputs to tool input schema
        self.inputs = self._build_inputs_schema()

        # Detect execution type
        self._is_operation = self._check_is_operation()
        execution_mode = "operation" if self._is_operation else "agent"
        logger.info(f"✨ Created SkillTool: {self.name} ({execution_mode}) with {len(self.inputs)} inputs")

    def _check_is_operation(self) -> bool:
        """Check if this skill uses operation execution (direct model invocation)."""
        # SkillConfig is a protobuf - execution_type field is always present (empty string if not set)
        return self.skill_config.execution_type == 'operation'

    def _has_output_mappings(self) -> bool:
        """Check if skill has any outputs with output mappings configured."""
        if not self.skill_config.outputs:
            return False
        for output in self.skill_config.outputs:
            if output.HasField('output_mapping') and len(output.output_mapping.table_mappings) > 0:
                return True
        return False

    @classmethod
    def _get_call_stack(cls) -> Set[str]:
        """Get the thread-local call stack, initializing if needed."""
        if not hasattr(cls._thread_local, 'call_stack'):
            cls._thread_local.call_stack = set()
        return cls._thread_local.call_stack

    @classmethod
    def _get_call_depth(cls) -> int:
        """Get the current call depth (size of call stack)."""
        return len(cls._get_call_stack())

    @classmethod
    def reset_call_stack(cls) -> None:
        """Reset the call stack. Called at the start of a new request."""
        cls._thread_local.call_stack = set()

    @classmethod
    def _get_result_cache(cls) -> Dict[str, str]:
        """Get thread-local cache of (call_key → result) for memoization.

        Prevents duplicate skill calls with identical inputs within a single
        request. The parent agent (chat planner) sometimes calls the same
        skill twice by mistake - memoization returns the cached result.
        """
        if not hasattr(cls._thread_local, 'result_cache'):
            cls._thread_local.result_cache = {}
        return cls._thread_local.result_cache

    @classmethod
    def reset_result_cache(cls) -> None:
        """Reset the result cache. Called at the start of a new request."""
        cls._thread_local.result_cache = {}

    def _make_call_key(self, kwargs: Dict[str, Any]) -> str:
        """Create a unique key for this skill call (for memoization).

        Combines skill name with a hash of sorted inputs to create a
        deterministic key that identifies this specific call.
        """
        inputs_str = json.dumps(kwargs, sort_keys=True, default=str)
        inputs_hash = hashlib.md5(inputs_str.encode()).hexdigest()[:16]
        return f"{self.skill_config.name}:{inputs_hash}"

    def _build_inputs_schema(self) -> Dict[str, Dict[str, str]]:
        """
        Convert SkillConfig.inputs to smolagents tool input schema.

        File inputs (image, audio, file, document) can specify a filename to use
        a specific file from the session, or leave empty to use the current message's file.

        Returns:
            Dict mapping input name to {type, description}
        """
        inputs_schema = {}

        # File input types that support filename-based lookup
        file_input_types = {'image', 'audio', 'file', 'document', 'video', 'pdf'}

        for skill_input in self.skill_config.inputs:
            # Map skill input types to smolagents types
            type_mapping = {
                "text": "string",
                "image": "string",  # Filename or empty for current message
                "file": "string",   # Filename or empty for current message
                "audio": "string",  # Filename or empty for current message
                "video": "string",  # Filename or empty for current message
                "document": "string",  # Filename or empty for current message
                "pdf": "string"  # Filename or empty for current message
            }

            input_type = type_mapping.get(skill_input.type, "string")
            required_prefix = '(Required) ' if skill_input.required else '(Optional) '

            # Build description based on input type
            if skill_input.type in file_input_types:
                # File inputs: hint that filename can be specified
                description = (
                    f"{required_prefix}Filename to use (e.g., 'audio.mp3'), "
                    f"or leave empty to use the {skill_input.type} from the current message"
                )
            else:
                # Text and other inputs: simple description
                description = f"{required_prefix}{skill_input.name}"

            inputs_schema[skill_input.name] = {
                "type": input_type,
                "description": description
            }

        # If skill has no inputs, provide a generic task input
        if not inputs_schema:
            inputs_schema["task"] = {
                "type": "string",
                "description": "The task or query to execute with this skill"
            }

        return inputs_schema

    def forward(self, **kwargs) -> str:
        """
        Execute the skill when called by the LLM.

        This is called at runtime when the LLM decides to use this tool.

        For 'agent' skills (default):
        - Creates a new sub-agent and executes the skill's instructions via smolagents

        For 'operation' skills:
        - Calls the inference client directly (no LLM orchestration)
        - Used for single-task models (image gen, speech, embeddings, etc.)

        Includes recursion protection:
        - Checks for circular calls (same skill already in call stack)
        - Checks maximum depth (MAX_DEPTH=10)

        Args:
            **kwargs: Runtime inputs from the LLM (matching self.inputs schema)

        Returns:
            Skill execution result as a string
        """
        skill_name = self.skill_config.name
        call_stack = self._get_call_stack()

        # Check for circular call (A → B → A)
        if skill_name in call_stack:
            error_msg = f"Circular skill call detected: '{skill_name}' is already being executed in this call chain. Call stack: {list(call_stack)}"
            logger.error(f"🔄 {error_msg}")
            return f"Error: {error_msg}"

        # Check maximum depth
        current_depth = self._get_call_depth()
        if current_depth >= self.MAX_DEPTH:
            error_msg = f"Maximum skill nesting depth ({self.MAX_DEPTH}) exceeded. Reduce skill delegation complexity."
            logger.error(f"📊 {error_msg}")
            return f"Error: {error_msg}"

        # Check memoization cache - return cached result for duplicate calls
        call_key = self._make_call_key(kwargs)
        cache = self._get_result_cache()
        if call_key in cache:
            logger.info(f"♻️ Returning cached result for {self.name} (same inputs, preventing duplicate)")
            return cache[call_key]

        execution_mode = "operation" if self._is_operation else "agent"
        logger.info(f"🎯 Executing skill: {self.name} ({execution_mode}, depth: {current_depth + 1}/{self.MAX_DEPTH}) with inputs: {list(kwargs.keys())}")

        # Add to call stack
        call_stack.add(skill_name)

        try:
            # Route based on execution type
            if self._is_operation:
                # Inject images/audio from parent context if available
                enriched_kwargs = self._inject_context_inputs(kwargs)
                # Resolve input mappings (read table field values)
                enriched_kwargs = run_async_in_thread(self._resolve_input_mappings(enriched_kwargs))
                result = self._execute_operation(enriched_kwargs)
            else:
                # Agent mode execution via callback
                # Resolve input mappings (read table field values)
                enriched_kwargs = run_async_in_thread(self._resolve_input_mappings(kwargs))

                # Check if we need to capture outputs for mapping
                if self._has_output_mappings():
                    # Request output capture from skill executor
                    # Executor returns SkillExecutionResult when capture_outputs=True
                    executor_result = self.skill_executor(self.skill_config, enriched_kwargs, capture_outputs=True)

                    # Type check using isinstance with dataclass
                    if isinstance(executor_result, SkillExecutionResult):
                        result = executor_result.result
                        captured_outputs = executor_result.captured_outputs
                        # Apply output mappings with captured values
                        if captured_outputs:
                            run_async_in_thread(
                                self._apply_agent_output_mappings(captured_outputs)
                            )
                            # Include captured outputs in result for parent agent visibility
                            result = self._build_result_with_outputs(result, captured_outputs)
                    else:
                        result = executor_result
                else:
                    # Standard agent execution without output capture
                    result = self.skill_executor(self.skill_config, enriched_kwargs)

            logger.info(f"✅ Skill {self.name} completed successfully")
            # Cache the result for memoization (prevents duplicate calls)
            cache[call_key] = result
            return result

        except Exception as e:
            error_msg = f"Skill execution failed: {str(e)}"
            logger.error(f"❌ Skill {self.name} failed: {e}", exc_info=True)
            # Don't cache errors - allow retry
            return error_msg

        finally:
            # Always remove from call stack, even on error
            call_stack.discard(skill_name)

    def _apply_template_substitution(self, runtime_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply Jinja2 template substitution for operation execution.

        Uses the skill's instructions field as a template with {{ input_name }} syntax.
        Same syntax as system prompts in prompts/__init__.py.

        Logic:
        - If instructions has {{ var }} placeholders → render with Jinja2
        - If instructions is plain text → use as default for primary input
        - If no instructions → pass runtime inputs directly

        Args:
            runtime_inputs: Original inputs from the LLM call

        Returns:
            Dict with substituted inputs ready for model execution
        """
        template_str = self.skill_config.instructions
        inputs_list = list(self.skill_config.inputs)

        # If no template, pass inputs through unchanged
        if not template_str or not template_str.strip():
            return runtime_inputs

        # Check if template has Jinja2 {{ var }} placeholders
        if '{{' in template_str and '}}' in template_str:
            # Jinja2 template mode
            try:
                template = Template(template_str)
                rendered = template.render(**runtime_inputs)

                # Find the primary text input to replace with rendered template
                for skill_input in inputs_list:
                    if skill_input.type == 'text':
                        result = dict(runtime_inputs)
                        result[skill_input.name] = rendered
                        logger.info(f"📝 Jinja2 template: {skill_input.name} = '{rendered[:100]}...'")
                        return result

                # No text input found, return original
                logger.warning("Template has placeholders but no text input found")
                return runtime_inputs

            except Exception as e:
                logger.error(f"❌ Jinja2 template error: {e}")
                return runtime_inputs

        else:
            # Static template: use as default for primary text input if not provided
            for skill_input in inputs_list:
                if skill_input.type == 'text':
                    primary_name = skill_input.name
                    if primary_name not in runtime_inputs or not runtime_inputs[primary_name]:
                        result = dict(runtime_inputs)
                        result[primary_name] = template_str
                        logger.info(f"📝 Using static template as default for {primary_name}")
                        return result
                    break

            return runtime_inputs

    def _inject_context_inputs(self, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inject images/audio from parent execution context into skill inputs.

        For operation skills, the LLM only passes text kwargs (e.g., prompt).
        Images/audio from chat attachments are in the parent's ExecutionContext.
        This method retrieves them and injects into kwargs based on skill input types.

        File selection logic:
        1. If LLM provided a filename string → search session_attachments by name
        2. If no filename provided → use current message attachments (default)

        REUSES existing utilities:
        - ImageProcessor.download_images_from_attachments() for images
        - file_processor.download_file() for audio
        - _find_file_by_name() for explicit filename lookup

        Args:
            kwargs: Original inputs from LLM call

        Returns:
            Dict with images/audio injected from context
        """
        # Import here to avoid circular dependency
        from ..services.agent_executor import AgentExecutor

        parent_context = AgentExecutor.get_current_context()
        if not parent_context:
            return kwargs

        result = dict(kwargs)
        inputs_list = list(self.skill_config.inputs)

        # Check each skill input to see if we need to inject from context
        for skill_input in inputs_list:
            input_name = skill_input.name
            input_type = skill_input.type

            # Skip only if already provided as bytes (not string filename from LLM)
            # LLM may pass filename string like 'file.mp3' which we should replace with actual bytes
            if input_name in result and isinstance(result[input_name], bytes):
                continue

            # Get any filename provided by LLM for this input
            provided_value = result.get(input_name)
            has_explicit_filename = (
                provided_value and
                isinstance(provided_value, str) and
                provided_value.strip()
            )

            # Inject image from context
            if input_type == 'image':
                image_bytes = None

                if has_explicit_filename and parent_context.session_attachments:
                    # LLM specified a filename - search session files
                    image_bytes = self._find_file_by_name(
                        provided_value,
                        parent_context.session_attachments,
                        mime_prefix='image/'
                    )
                    if image_bytes:
                        logger.info(f"📷 Injected image by name '{provided_value}' into '{input_name}'")

                if not image_bytes and parent_context.images:
                    # No filename or not found - use current message image (default)
                    image_bytes = self._download_and_convert_image(parent_context.images)
                    if image_bytes:
                        logger.info(f"📷 Injected image from current message into '{input_name}' ({len(image_bytes)} bytes)")

                if image_bytes:
                    result[input_name] = image_bytes

            # Inject audio from context
            elif input_type == 'audio':
                audio_bytes = None

                if has_explicit_filename and parent_context.session_attachments:
                    # LLM specified a filename - search session files
                    audio_bytes = self._find_file_by_name(
                        provided_value,
                        parent_context.session_attachments,
                        mime_prefix='audio/'
                    )
                    if audio_bytes:
                        logger.info(f"🎵 Injected audio by name '{provided_value}' into '{input_name}'")

                if not audio_bytes and parent_context.attachments:
                    # No filename or not found - use current message audio (default)
                    audio_bytes = self._download_audio(parent_context.attachments)
                    if audio_bytes:
                        logger.info(f"🎵 Injected audio from current message into '{input_name}' ({len(audio_bytes)} bytes)")

                if audio_bytes:
                    result[input_name] = audio_bytes

            # Inject generic file from context (document, file, etc.)
            elif input_type in ('file', 'document', 'pdf'):
                file_bytes = None

                if has_explicit_filename and parent_context.session_attachments:
                    # LLM specified a filename - search session files
                    file_bytes = self._find_file_by_name(
                        provided_value,
                        parent_context.session_attachments,
                        mime_prefix=None  # Accept any MIME type for generic files
                    )
                    if file_bytes:
                        logger.info(f"📄 Injected file by name '{provided_value}' into '{input_name}'")

                if not file_bytes and parent_context.attachments:
                    # No filename or not found - try current message attachments
                    for att in parent_context.attachments:
                        try:
                            file_bytes = run_async_in_thread(download_file(att.url))
                            if file_bytes:
                                logger.info(f"📄 Injected file from current message into '{input_name}'")
                                break
                        except Exception as e:
                            logger.error(f"Failed to download file: {e}")

                if file_bytes:
                    result[input_name] = file_bytes

        return result

    def _download_and_convert_image(self, image_attachments) -> Optional[bytes]:
        """
        Download images from context and convert to bytes for HF API.

        REUSES: ImageProcessor.download_images_from_attachments()
        Uses run_async_in_thread() to avoid event loop conflicts in gRPC context.
        """
        try:
            # Use _run_async_in_thread to avoid "event loop already running" error
            pil_images = run_async_in_thread(
                ImageProcessor.download_images_from_attachments(image_attachments)
            )

            if pil_images:
                # Convert first image to PNG bytes for HF API
                buffer = BytesIO()
                pil_images[0].save(buffer, format="PNG")
                return buffer.getvalue()

        except Exception as e:
            logger.error(f"Failed to download/convert image: {e}")

        return None

    def _download_audio(self, attachments) -> Optional[bytes]:
        """
        Download audio from context attachments.

        REUSES: file_processor.download_file()
        Uses run_async_in_thread() to avoid event loop conflicts in gRPC context.
        """
        for attachment in attachments:
            mime_type = getattr(attachment, 'mime_type', '') or ''
            if mime_type.startswith('audio/'):
                try:
                    # Use _run_async_in_thread to avoid "event loop already running" error
                    audio_bytes = run_async_in_thread(
                        download_file(attachment.url)
                    )
                    return audio_bytes
                except Exception as e:
                    logger.error(f"Failed to download audio: {e}")

        return None

    def _find_file_by_name(
        self,
        filename: str,
        attachments: list,
        mime_prefix: Optional[str] = None
    ) -> Optional[bytes]:
        """
        Find and download a file by filename from attachments.

        Supports index suffix for duplicates: "audio.mp3 (2)" → second file named "audio.mp3"

        Args:
            filename: Filename to search for (may include index suffix like "(2)")
            attachments: List of FileAttachment objects to search
            mime_prefix: Optional MIME type prefix to validate (e.g., "audio/")

        Returns:
            File bytes if found and downloaded, None otherwise
        """
        if not attachments or not filename:
            return None

        # Parse index suffix: "audio.mp3 (2)" → ("audio.mp3", 2)
        index_match = re.match(r'^(.+?)\s*\((\d+)\)$', filename.strip())
        if index_match:
            base_filename = index_match.group(1).strip()
            target_index = int(index_match.group(2))
        else:
            base_filename = filename.strip()
            target_index = 1  # First occurrence

        # Count occurrences and find the target
        occurrence = 0
        for attachment in attachments:
            att_filename = getattr(attachment, 'filename', '') or ''
            att_mime = getattr(attachment, 'mime_type', '') or ''

            # Check filename match
            if att_filename.strip() == base_filename:
                occurrence += 1

                # Check if this is the target occurrence
                if occurrence == target_index:
                    # Validate MIME type if specified
                    if mime_prefix and not att_mime.startswith(mime_prefix):
                        logger.warning(
                            f"⚠️ File '{filename}' found but MIME type '{att_mime}' "
                            f"doesn't match expected '{mime_prefix}*'"
                        )
                        continue

                    # Download and return the file
                    try:
                        logger.info(f"📎 Found file by name: '{filename}' (occurrence {occurrence})")
                        file_bytes = run_async_in_thread(
                            download_file(attachment.url)
                        )
                        return file_bytes
                    except Exception as e:
                        logger.error(f"❌ Failed to download file '{filename}': {e}")
                        return None

        # File not found
        if occurrence > 0:
            logger.warning(
                f"⚠️ File '{base_filename}' found {occurrence} time(s), "
                f"but requested index {target_index}"
            )
        else:
            logger.warning(f"⚠️ File '{filename}' not found in {len(attachments)} attachments")

        return None

    def _execute_operation(self, runtime_inputs: Dict[str, Any]) -> str:
        """
        Execute skill directly without LLM orchestration (operation mode).

        Uses HuggingFace Inference API for single-task model execution.

        Args:
            runtime_inputs: Inputs from the LLM call (possibly enriched with context)

        Returns:
            Task result as string (for text) or description of binary output
        """
        if not self.inference_client:
            raise ValueError(
                f"Operation skill '{self.skill_config.name}' requires inference_client. "
                "Ensure inference_client is passed when creating SkillTool."
            )

        task_config = self.skill_config.task_model_config
        if not task_config:
            raise ValueError(
                f"Operation skill '{self.skill_config.name}' missing task_model_config"
            )

        model_id = task_config.model_id
        task_type = task_config.task_type
        parameters = dict(task_config.parameters) if task_config.parameters else {}

        logger.info(f"🚀 Direct operation execution: {model_id} ({task_type})")

        # Verify task type is supported
        if not self.inference_client.supports_task_type(task_type):
            raise ValueError(
                f"Task type '{task_type}' not supported. "
                f"Supported: {self.inference_client.supported_task_types}"
            )

        # Template substitution for text inputs
        # Uses the skill's instructions field as a template with {input_name} syntax
        final_inputs = self._apply_template_substitution(runtime_inputs)

        # Run async execution in sync context (smolagents tools are sync)
        # Use thread executor to avoid "event loop already running" error when
        # called from within gRPC's async context
        result = run_async_in_thread(
            self.inference_client.execute_task(
                model_id=model_id,
                task_type=task_type,
                inputs=final_inputs,
                parameters=parameters
            )
        )

        # Apply output mappings if configured
        run_async_in_thread(self._apply_output_mappings(result))

        # Return result based on type
        if result.is_text:
            return str(result.data)
        elif result.is_structured:
            return json.dumps(result.data)
        elif result.is_binary:
            # For binary results, return description with any mapped output info
            return f"Generated {result.type.value}: {len(result.data)} bytes ({result.metadata})"
        else:
            return str(result.data)

    async def _apply_output_mappings(self, result: "TaskResult") -> None:
        """
        Apply output mappings to save operation mode skill results to tables.

        Uses shared OutputMappingService for consistent behavior.
        For operation mode, the model result is wrapped as a pseudo "skill output"
        named "result" for multi-table mapping.

        Args:
            result: The TaskResult from inference execution
        """
        # Check if we have auth for API calls
        if not self.api_key or not self.organization_id:
            logger.debug("No API auth available, skipping output mappings")
            return

        # Get outputs with table_mappings configured
        outputs_with_mappings = [
            output for output in self.skill_config.outputs
            if output.HasField('output_mapping') and output.output_mapping.table_mappings
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured")
            return

        logger.info(f"📊 Applying output mappings for operation mode skill")

        # Create mapping context with auth
        ctx = MappingContext(
            api_key=self.api_key,
            organization_id=str(self.organization_id)
        )

        # Prepare result data for mapping
        # TEXT results are plain strings, STRUCTURED are dicts, BINARY get uploaded
        if result.is_text:
            result_value = str(result.data)
        elif result.is_binary:
            file_url = await OutputMappingService.upload_binary_to_s3(
                ctx=ctx,
                binary_data=result.data,
                mime_type=result.metadata.get('mime_type', 'application/octet-stream'),
                filename_prefix="output"
            )
            result_value = file_url if file_url else None
        elif result.is_structured:
            # For structured results (like classification), use as-is
            result_value = result.data
        else:
            result_value = result.data

        if result_value is None:
            logger.warning("No result value to map")
            return

        # Convert result to typed skill outputs for multi-table mapping
        # For structured results, flatten to allow { type: 'skill_output', name: 'label' }
        skill_outputs: list[SkillOutputValue] = []
        if isinstance(result_value, dict):
            for name, value in result_value.items():
                skill_outputs.append(SkillOutputValue(name=name, value=value))
        else:
            skill_outputs.append(SkillOutputValue(name="result", value=result_value))

        # Use first output's mapping config (contains all table mappings)
        first_output = outputs_with_mappings[0]

        try:
            config = OutputMappingConfig.from_proto(first_output.output_mapping)

            # Execute multi-table mapping
            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx,
                config=config,
                skill_outputs=skill_outputs
            )

            logger.info(f"✅ Operation mode output mapping complete: {len(results)} tables updated")

        except Exception as e:
            logger.error(f"❌ Failed to apply operation output mappings: {e}")

    def _build_result_with_outputs(self, original_result: str, captured: Dict[str, Any]) -> str:
        """
        Build a result string showing both extracted AND not-found fields.

        This explicit format prevents the parent agent from hallucinating about
        what was extracted - it receives a clear list of what WAS and WASN'T found.

        Args:
            original_result: The skill's final answer
            captured: Dict of captured output values from OutputTool

        Returns:
            Formatted result showing extracted values and fields not found
        """
        if not captured:
            return original_result

        extracted_lines = []
        not_found_lines = []

        for name, value in captured.items():
            if value is None:
                not_found_lines.append(f"- {name}: (not found in input)")
            else:
                str_value = str(value)
                if len(str_value) > 200:
                    str_value = str_value[:200] + "..."
                extracted_lines.append(f"- {name}: {str_value}")

        result_parts = ["Skill completed."]

        if extracted_lines:
            result_parts.append(f"\n**Extracted ({len(extracted_lines)} fields):**")
            result_parts.append("\n".join(extracted_lines))

        if not_found_lines:
            result_parts.append(f"\n**Not found in input ({len(not_found_lines)} fields):**")
            result_parts.append("\n".join(not_found_lines))

        if extracted_lines:
            result_parts.append("\nExtracted data has been saved.")

        return "\n".join(result_parts)

    async def _apply_agent_output_mappings(self, captured_values: Dict[str, Any]) -> None:
        """
        Apply output mappings for agent mode skills using captured OutputTool values.

        Called when a delegated skill has output mappings configured and the
        sub-agent's OutputTool has captured values.

        AIDEV-NOTE: Multi-table output mapping with typed references (2025-01)
        - UI stores all table mappings on outputs[0].outputMapping
        - Table mappings are executed in order, with cross-table references
        - Typed FieldSource (skill_output or table_ref) instead of string parsing

        Args:
            captured_values: Values captured from OutputTool (keyed by output name)
        """
        # Check if we have auth for API calls
        if not self.api_key or not self.organization_id:
            logger.debug("No API auth available, skipping agent output mappings")
            return

        if not captured_values:
            logger.debug("No captured values for agent output mappings")
            return

        # Create mapping context with auth
        ctx = MappingContext(
            api_key=self.api_key,
            organization_id=str(self.organization_id)
        )

        # Get first output with mappings (all table mappings stored on outputs[0])
        outputs_with_mappings = [
            output for output in self.skill_config.outputs
            if output.HasField('output_mapping') and output.output_mapping.table_mappings
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured for agent mode")
            return

        # Use the first output's mapping config (contains all table mappings)
        first_output = outputs_with_mappings[0]
        logger.info(f"📊 Applying multi-table output mappings")

        # Filter out null values - only save actual extracted data
        valid_outputs: list[SkillOutputValue] = [
            SkillOutputValue(name=name, value=value)
            for name, value in captured_values.items()
            if value is not None
        ]

        if not valid_outputs:
            logger.warning("⚠️ No valid outputs to map after filtering nulls")
            return

        extracted = len(valid_outputs)
        total = len(captured_values)
        logger.info(f"📤 Mapping {extracted}/{total} skill outputs (filtered {total - extracted} nulls)")

        try:
            config = OutputMappingConfig.from_proto(first_output.output_mapping)

            # Execute multi-table mapping with typed sources
            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx,
                config=config,
                skill_outputs=valid_outputs
            )

            logger.info(f"✅ Multi-table mapping complete: {len(results)} tables updated")

        except Exception as e:
            logger.error(f"❌ Failed to apply multi-table output mappings: {e}")

    async def _resolve_input_mappings(self, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolve InputMappingConfig by reading table field values.

        For each skill input with input_mapping configured, read the field value
        from the specified table/row and inject into kwargs.
        """
        if not self.skill_config or not self.api_key or not self.organization_id:
            return kwargs

        resolved = dict(kwargs)

        for input_def in self.skill_config.inputs:
            # Skip if no input_mapping configured
            if not input_def.HasField('input_mapping'):
                continue

            # Skip if already provided by LLM
            if input_def.name in resolved and resolved[input_def.name] is not None:
                continue

            mapping = input_def.input_mapping
            source = mapping.source

            # Resolve row_id from row_source
            row_id = self._resolve_row_id(source.row_source, resolved)
            if row_id is None:
                logger.debug(f"Could not resolve row_id for input '{input_def.name}'")
                continue

            # Read field value from table
            value = await self._read_table_field(
                table_id=source.table_id,
                field_id=source.field_id,
                row_id=row_id
            )

            if value is not None:
                logger.info(f"📥 Resolved input '{input_def.name}' from table field")
                resolved[input_def.name] = value

        return resolved

    def _resolve_row_id(self, row_source, context: Dict[str, Any]) -> Optional[str]:
        """Resolve row ID from RowIdSource configuration.

        Row ID resolution priority:
        1. Explicit __row_id__ in context (from chat row picker)
        2. source_row_id from parent execution context (from automation triggers)
        3. Static/skill_input/skill_output sources as configured
        """
        from ..services.agent_executor import AgentExecutor

        # Check which field is set in the oneof
        if row_source.use_source_row:
            # First check for explicit row ID from chat context
            # This allows chat row picker to provide the row ID
            if '__row_id__' in context:
                return str(context['__row_id__'])

            # Fall back to triggering row from parent execution context (automation triggers)
            parent_ctx = AgentExecutor.get_current_context()
            if parent_ctx and hasattr(parent_ctx, 'source_row_id') and parent_ctx.source_row_id:
                return str(parent_ctx.source_row_id)

            logger.warning("use_source_row specified but no row ID available in context")
            return None
        elif row_source.static_id:
            return row_source.static_id
        elif row_source.skill_input:
            # Get row ID from another skill input value
            value = context.get(row_source.skill_input)
            return str(value) if value is not None else None
        elif row_source.skill_output:
            # Get row ID from skill output (from previous step)
            value = context.get(row_source.skill_output)
            return str(value) if value is not None else None
        elif row_source.HasField('table_ref'):
            # TableReference - would need to resolve from previous table mapping
            # For now, skip this case (complex cross-table reference)
            logger.debug("table_ref row source not yet implemented for input mappings")
            return None

        return None

    async def _read_table_field(
        self,
        table_id: int,
        field_id: int,
        row_id: str
    ) -> Any:
        """
        Read a single field value from a table row.

        Uses same HTTP pattern as OutputMappingService._fetch_row().
        """
        import httpx

        ctx = MappingContext(
            api_key=self.api_key,
            organization_id=str(self.organization_id)
        )

        url = f"{ctx.api_base_url}/rows"
        params = {"tableId": str(table_id), "rowId": row_id}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=ctx.headers, params=params)

                if response.status_code >= 400:
                    logger.warning(f"Failed to fetch row {row_id}: {response.status_code}")
                    return None

                data = response.json()
                rows = data.get('data', {}).get('rows', [])

                if not rows:
                    return None

                row = rows[0]
                # Row data is keyed by field_id (as string)
                return row.get(str(field_id))

        except Exception as e:
            logger.error(f"Error reading table field: {e}")
            return None
