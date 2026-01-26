"""
SkillTool - Wraps skills as callable tools with recursion protection.

Ported from tools/skill_tool.py - removes smolagents.Tool dependency.
Uses same class structure but doesn't inherit from Tool.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
from io import BytesIO
from typing import TYPE_CHECKING, Any, Callable

from jinja2 import Template

from ....entities.output_mapping import OutputMappingConfig
from ....entities.task import SkillOutputValue
from ....grpc.generated.agent_worker_pb2 import SkillConfig
from ....services.file_processor import download_file
from ....services.image_processor import ImageProcessor
from ....services.output_mapping_service import MappingContext, OutputMappingService
from ....types import SkillExecutionResult
from ....utils import run_async_in_thread

if TYPE_CHECKING:
    from ....clients import HuggingFaceInferenceClient

logger = logging.getLogger(__name__)


class SkillTool:
    """Executes a skill via callback. Thread-local call stack prevents circular calls.

    This class can be used as a callable for DSPy ReAct:
        tool = SkillTool(...)
        result = tool(**kwargs)  # Calls forward()

    Attributes:
        name: Tool name for LLM (e.g., "skill_my_skill")
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type ("string")
    """

    MAX_DEPTH = 10
    _thread_local = threading.local()

    def __init__(
        self,
        skill_config: SkillConfig,
        skill_executor: Callable[[SkillConfig, dict[str, Any]], str],
        inference_client: HuggingFaceInferenceClient | None = None,
        api_key: str | None = None,
        organization_id: int | None = None,
    ):
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
        logger.info(
            f"Created SkillTool: {self.name} ({execution_mode}) with {len(self.inputs)} inputs"
        )

    def __call__(self, **kwargs: Any) -> str:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def _check_is_operation(self) -> bool:
        """Check if this skill uses operation execution (direct model invocation)."""
        return self.skill_config.execution_type == "operation"

    def _has_output_mappings(self) -> bool:
        """Check if skill has any outputs with output mappings configured."""
        if not self.skill_config.outputs:
            return False
        for output in self.skill_config.outputs:
            if (
                output.HasField("output_mapping")
                and len(output.output_mapping.table_mappings) > 0
            ):
                return True
        return False

    @classmethod
    def _get_call_stack(cls) -> set[str]:
        """Get the thread-local call stack, initializing if needed."""
        if not hasattr(cls._thread_local, "call_stack"):
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
    def _get_result_cache(cls) -> dict[str, str]:
        """Get thread-local cache of (call_key -> result) for memoization."""
        if not hasattr(cls._thread_local, "result_cache"):
            cls._thread_local.result_cache = {}
        return cls._thread_local.result_cache

    @classmethod
    def reset_result_cache(cls) -> None:
        """Reset the result cache. Called at the start of a new request."""
        cls._thread_local.result_cache = {}

    def _make_call_key(self, kwargs: dict[str, Any]) -> str:
        """Create a unique key for this skill call (for memoization)."""
        inputs_str = json.dumps(kwargs, sort_keys=True, default=str)
        inputs_hash = hashlib.md5(inputs_str.encode()).hexdigest()[:16]
        return f"{self.skill_config.name}:{inputs_hash}"

    def _build_inputs_schema(self) -> dict[str, dict[str, str]]:
        """Convert SkillConfig.inputs to tool input schema."""
        inputs_schema: dict[str, dict[str, str]] = {}
        file_input_types = {"image", "audio", "file", "document", "video", "pdf"}

        for skill_input in self.skill_config.inputs:
            type_mapping = {
                "text": "string",
                "image": "string",
                "file": "string",
                "audio": "string",
                "video": "string",
                "document": "string",
                "pdf": "string",
            }

            input_type = type_mapping.get(skill_input.type, "string")
            required_prefix = "(Required) " if skill_input.required else "(Optional) "

            if skill_input.type in file_input_types:
                description = (
                    f"{required_prefix}Filename to use (e.g., 'audio.mp3'), "
                    f"or leave empty to use the {skill_input.type} from the current message"
                )
            else:
                description = f"{required_prefix}{skill_input.name}"

            inputs_schema[skill_input.name] = {"type": input_type, "description": description}

        if not inputs_schema:
            inputs_schema["task"] = {
                "type": "string",
                "description": "The task or query to execute with this skill",
            }

        return inputs_schema

    def forward(self, **kwargs: Any) -> str:
        """Execute the skill when called by the LLM."""
        skill_name = self.skill_config.name
        call_stack = self._get_call_stack()

        # Check for circular call
        if skill_name in call_stack:
            error_msg = (
                f"Circular skill call detected: '{skill_name}' is already being executed. "
                f"Call stack: {list(call_stack)}"
            )
            logger.error(error_msg)
            return f"Error: {error_msg}"

        # Check maximum depth
        current_depth = self._get_call_depth()
        if current_depth >= self.MAX_DEPTH:
            error_msg = f"Maximum skill nesting depth ({self.MAX_DEPTH}) exceeded."
            logger.error(error_msg)
            return f"Error: {error_msg}"

        # Check memoization cache
        call_key = self._make_call_key(kwargs)
        cache = self._get_result_cache()
        if call_key in cache:
            logger.info(f"Returning cached result for {self.name}")
            return cache[call_key]

        execution_mode = "operation" if self._is_operation else "agent"
        logger.info(
            f"Executing skill: {self.name} ({execution_mode}, depth: {current_depth + 1}) "
            f"with inputs: {list(kwargs.keys())}"
        )

        call_stack.add(skill_name)

        try:
            if self._is_operation:
                enriched_kwargs = self._inject_context_inputs(kwargs)
                enriched_kwargs = run_async_in_thread(
                    self._resolve_input_mappings(enriched_kwargs)
                )
                result = self._execute_operation(enriched_kwargs)
            else:
                enriched_kwargs = run_async_in_thread(self._resolve_input_mappings(kwargs))

                from ....services.agent_executor import AgentExecutor

                parent_ctx = AgentExecutor.get_current_context()
                progress_callback = parent_ctx.progress_callback if parent_ctx else None

                if self._has_output_mappings():
                    executor_result = self.skill_executor(
                        self.skill_config,
                        enriched_kwargs,
                        capture_outputs=True,
                        progress_callback=progress_callback,
                    )

                    if isinstance(executor_result, SkillExecutionResult):
                        result = executor_result.result
                        captured_outputs = executor_result.captured_outputs
                        if captured_outputs:
                            run_async_in_thread(
                                self._apply_agent_output_mappings(captured_outputs)
                            )
                            result = self._build_result_with_outputs(result, captured_outputs)
                    else:
                        result = executor_result
                else:
                    result = self.skill_executor(
                        self.skill_config, enriched_kwargs, progress_callback=progress_callback
                    )

            logger.info(f"Skill {self.name} completed successfully")
            cache[call_key] = result
            return result

        except Exception as e:
            error_msg = f"Skill execution failed: {str(e)}"
            logger.error(f"Skill {self.name} failed: {e}", exc_info=True)
            return error_msg

        finally:
            call_stack.discard(skill_name)

    def _apply_template_substitution(self, runtime_inputs: dict[str, Any]) -> dict[str, Any]:
        """Apply Jinja2 template substitution for operation execution."""
        template_str = self.skill_config.instructions
        inputs_list = list(self.skill_config.inputs)

        if not template_str or not template_str.strip():
            return runtime_inputs

        if "{{" in template_str and "}}" in template_str:
            try:
                template = Template(template_str)
                rendered = template.render(**runtime_inputs)

                for skill_input in inputs_list:
                    if skill_input.type == "text":
                        result = dict(runtime_inputs)
                        result[skill_input.name] = rendered
                        logger.info(f"Jinja2 template: {skill_input.name} = '{rendered[:100]}...'")
                        return result

                logger.warning("Template has placeholders but no text input found")
                return runtime_inputs

            except Exception as e:
                logger.error(f"Jinja2 template error: {e}")
                return runtime_inputs

        else:
            for skill_input in inputs_list:
                if skill_input.type == "text":
                    primary_name = skill_input.name
                    if primary_name not in runtime_inputs or not runtime_inputs[primary_name]:
                        result = dict(runtime_inputs)
                        result[primary_name] = template_str
                        logger.info(f"Using static template as default for {primary_name}")
                        return result
                    break

            return runtime_inputs

    def _inject_context_inputs(self, kwargs: dict[str, Any]) -> dict[str, Any]:
        """Inject images/audio from parent execution context into skill inputs."""
        from ....services.agent_executor import AgentExecutor

        parent_context = AgentExecutor.get_current_context()
        if not parent_context:
            return kwargs

        result = dict(kwargs)
        inputs_list = list(self.skill_config.inputs)

        for skill_input in inputs_list:
            input_name = skill_input.name
            input_type = skill_input.type

            if input_name in result and isinstance(result[input_name], bytes):
                continue

            provided_value = result.get(input_name)
            has_explicit_filename = (
                provided_value and isinstance(provided_value, str) and provided_value.strip()
            )

            if input_type == "image":
                image_bytes = None

                if has_explicit_filename and parent_context.session_attachments:
                    image_bytes = self._find_file_by_name(
                        provided_value, parent_context.session_attachments, mime_prefix="image/"
                    )
                    if image_bytes:
                        logger.info(f"Injected image by name '{provided_value}' into '{input_name}'")

                if not image_bytes and parent_context.images:
                    image_bytes = self._download_and_convert_image(parent_context.images)
                    if image_bytes:
                        logger.info(
                            f"Injected image from current message into '{input_name}' "
                            f"({len(image_bytes)} bytes)"
                        )

                if image_bytes:
                    result[input_name] = image_bytes

            elif input_type == "audio":
                audio_bytes = None

                if has_explicit_filename and parent_context.session_attachments:
                    audio_bytes = self._find_file_by_name(
                        provided_value, parent_context.session_attachments, mime_prefix="audio/"
                    )
                    if audio_bytes:
                        logger.info(f"Injected audio by name '{provided_value}' into '{input_name}'")

                if not audio_bytes and parent_context.attachments:
                    audio_bytes = self._download_audio(parent_context.attachments)
                    if audio_bytes:
                        logger.info(
                            f"Injected audio from current message into '{input_name}' "
                            f"({len(audio_bytes)} bytes)"
                        )

                if audio_bytes:
                    result[input_name] = audio_bytes

            elif input_type in ("file", "document", "pdf"):
                file_bytes = None

                if has_explicit_filename and parent_context.session_attachments:
                    file_bytes = self._find_file_by_name(
                        provided_value, parent_context.session_attachments, mime_prefix=None
                    )
                    if file_bytes:
                        logger.info(f"Injected file by name '{provided_value}' into '{input_name}'")

                if not file_bytes and parent_context.attachments:
                    for att in parent_context.attachments:
                        try:
                            file_bytes = run_async_in_thread(download_file(att.url))
                            if file_bytes:
                                logger.info(f"Injected file from current message into '{input_name}'")
                                break
                        except Exception as e:
                            logger.error(f"Failed to download file: {e}")

                if file_bytes:
                    result[input_name] = file_bytes

        return result

    def _download_and_convert_image(self, image_attachments: Any) -> bytes | None:
        """Download images from context and convert to bytes for HF API."""
        try:
            pil_images = run_async_in_thread(
                ImageProcessor.download_images_from_attachments(image_attachments)
            )

            if pil_images:
                buffer = BytesIO()
                pil_images[0].save(buffer, format="PNG")
                return buffer.getvalue()

        except Exception as e:
            logger.error(f"Failed to download/convert image: {e}")

        return None

    def _download_audio(self, attachments: Any) -> bytes | None:
        """Download audio from context attachments."""
        for attachment in attachments:
            mime_type = getattr(attachment, "mime_type", "") or ""
            if mime_type.startswith("audio/"):
                try:
                    audio_bytes = run_async_in_thread(download_file(attachment.url))
                    return audio_bytes
                except Exception as e:
                    logger.error(f"Failed to download audio: {e}")

        return None

    def _find_file_by_name(
        self, filename: str, attachments: list[Any], mime_prefix: str | None = None
    ) -> bytes | None:
        """Find and download a file by filename from attachments."""
        if not attachments or not filename:
            return None

        index_match = re.match(r"^(.+?)\s*\((\d+)\)$", filename.strip())
        if index_match:
            base_filename = index_match.group(1).strip()
            target_index = int(index_match.group(2))
        else:
            base_filename = filename.strip()
            target_index = 1

        occurrence = 0
        for attachment in attachments:
            att_filename = getattr(attachment, "filename", "") or ""
            att_mime = getattr(attachment, "mime_type", "") or ""

            if att_filename.strip() == base_filename:
                occurrence += 1

                if occurrence == target_index:
                    if mime_prefix and not att_mime.startswith(mime_prefix):
                        logger.warning(
                            f"File '{filename}' found but MIME type '{att_mime}' "
                            f"doesn't match expected '{mime_prefix}*'"
                        )
                        continue

                    try:
                        logger.info(f"Found file by name: '{filename}' (occurrence {occurrence})")
                        file_bytes = run_async_in_thread(download_file(attachment.url))
                        return file_bytes
                    except Exception as e:
                        logger.error(f"Failed to download file '{filename}': {e}")
                        return None

        if occurrence > 0:
            logger.warning(
                f"File '{base_filename}' found {occurrence} time(s), "
                f"but requested index {target_index}"
            )
        else:
            logger.warning(f"File '{filename}' not found in {len(attachments)} attachments")

        return None

    def _execute_operation(self, runtime_inputs: dict[str, Any]) -> str:
        """Execute skill directly without LLM orchestration (operation mode)."""
        if not self.inference_client:
            raise ValueError(
                f"Operation skill '{self.skill_config.name}' requires inference_client."
            )

        task_config = self.skill_config.task_model_config
        if not task_config:
            raise ValueError(
                f"Operation skill '{self.skill_config.name}' missing task_model_config"
            )

        model_id = task_config.model_id
        task_type = task_config.task_type
        parameters = dict(task_config.parameters) if task_config.parameters else {}

        logger.info(f"Direct operation execution: {model_id} ({task_type})")

        if not self.inference_client.supports_task_type(task_type):
            raise ValueError(
                f"Task type '{task_type}' not supported. "
                f"Supported: {self.inference_client.supported_task_types}"
            )

        final_inputs = self._apply_template_substitution(runtime_inputs)

        result = run_async_in_thread(
            self.inference_client.execute_task(
                model_id=model_id,
                task_type=task_type,
                inputs=final_inputs,
                parameters=parameters,
            )
        )

        run_async_in_thread(self._apply_output_mappings(result))

        if result.is_text:
            return str(result.data)
        elif result.is_structured:
            return json.dumps(result.data)
        elif result.is_binary:
            return f"Generated {result.type.value}: {len(result.data)} bytes ({result.metadata})"
        else:
            return str(result.data)

    async def _apply_output_mappings(self, result: Any) -> None:
        """Apply output mappings to save operation mode skill results to tables."""
        if not self.api_key or not self.organization_id:
            logger.debug("No API auth available, skipping output mappings")
            return

        outputs_with_mappings = [
            output
            for output in self.skill_config.outputs
            if output.HasField("output_mapping") and output.output_mapping.table_mappings
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured")
            return

        logger.info("Applying output mappings for operation mode skill")

        ctx = MappingContext(api_key=self.api_key, organization_id=str(self.organization_id))

        if result.is_text:
            result_value = str(result.data)
        elif result.is_binary:
            file_url = await OutputMappingService.upload_binary_to_s3(
                ctx=ctx,
                binary_data=result.data,
                mime_type=result.metadata.get("mime_type", "application/octet-stream"),
                filename_prefix="output",
            )
            result_value = file_url if file_url else None
        elif result.is_structured:
            result_value = result.data
        else:
            result_value = result.data

        if result_value is None:
            logger.warning("No result value to map")
            return

        skill_outputs: list[SkillOutputValue] = []
        if isinstance(result_value, dict):
            for name, value in result_value.items():
                skill_outputs.append(SkillOutputValue(name=name, value=value))
        else:
            skill_outputs.append(SkillOutputValue(name="result", value=result_value))

        first_output = outputs_with_mappings[0]

        try:
            config = OutputMappingConfig.from_proto(first_output.output_mapping)

            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx, config=config, skill_outputs=skill_outputs
            )

            logger.info(f"Operation mode output mapping complete: {len(results)} tables updated")

        except Exception as e:
            logger.error(f"Failed to apply operation output mappings: {e}")

    def _build_result_with_outputs(
        self, original_result: str, captured: dict[str, Any]
    ) -> str:
        """Build a result string showing both extracted AND not-found fields."""
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

    async def _apply_agent_output_mappings(self, captured_values: dict[str, Any]) -> None:
        """Apply output mappings for agent mode skills using captured OutputTool values."""
        if not self.api_key or not self.organization_id:
            logger.debug("No API auth available, skipping agent output mappings")
            return

        if not captured_values:
            logger.debug("No captured values for agent output mappings")
            return

        ctx = MappingContext(api_key=self.api_key, organization_id=str(self.organization_id))

        outputs_with_mappings = [
            output
            for output in self.skill_config.outputs
            if output.HasField("output_mapping") and output.output_mapping.table_mappings
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured for agent mode")
            return

        first_output = outputs_with_mappings[0]
        logger.info("Applying multi-table output mappings")

        valid_outputs: list[SkillOutputValue] = [
            SkillOutputValue(name=name, value=value)
            for name, value in captured_values.items()
            if value is not None
        ]

        if not valid_outputs:
            logger.warning("No valid outputs to map after filtering nulls")
            return

        extracted = len(valid_outputs)
        total = len(captured_values)
        logger.info(
            f"Mapping {extracted}/{total} skill outputs (filtered {total - extracted} nulls)"
        )

        try:
            config = OutputMappingConfig.from_proto(first_output.output_mapping)

            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx, config=config, skill_outputs=valid_outputs
            )

            logger.info(f"Multi-table mapping complete: {len(results)} tables updated")

        except Exception as e:
            logger.error(f"Failed to apply multi-table output mappings: {e}")

    async def _resolve_input_mappings(self, kwargs: dict[str, Any]) -> dict[str, Any]:
        """Resolve InputMappingConfig by reading table field values."""
        if not self.skill_config or not self.api_key or not self.organization_id:
            return kwargs

        resolved = dict(kwargs)

        for input_def in self.skill_config.inputs:
            if not input_def.HasField("input_mapping"):
                continue

            if input_def.name in resolved and resolved[input_def.name] is not None:
                continue

            mapping = input_def.input_mapping
            source = mapping.source

            row_id = self._resolve_row_id(source.row_source, resolved)
            if row_id is None:
                logger.debug(f"Could not resolve row_id for input '{input_def.name}'")
                continue

            value = await self._read_table_field(
                table_id=source.table_id, field_id=source.field_id, row_id=row_id
            )

            if value is not None:
                logger.info(f"Resolved input '{input_def.name}' from table field")
                resolved[input_def.name] = value

        return resolved

    def _resolve_row_id(self, row_source: Any, context: dict[str, Any]) -> str | None:
        """Resolve row ID from RowIdSource configuration."""
        from ....services.agent_executor import AgentExecutor

        if row_source.use_source_row:
            if "__row_id__" in context:
                return str(context["__row_id__"])

            parent_ctx = AgentExecutor.get_current_context()
            if (
                parent_ctx
                and hasattr(parent_ctx, "source_row_id")
                and parent_ctx.source_row_id
            ):
                return str(parent_ctx.source_row_id)

            logger.warning("use_source_row specified but no row ID available in context")
            return None
        elif row_source.static_id:
            return row_source.static_id
        elif row_source.skill_input:
            value = context.get(row_source.skill_input)
            return str(value) if value is not None else None
        elif row_source.skill_output:
            value = context.get(row_source.skill_output)
            return str(value) if value is not None else None
        elif row_source.HasField("table_ref"):
            logger.debug("table_ref row source not yet implemented for input mappings")
            return None

        return None

    async def _read_table_field(
        self, table_id: int, field_id: int, row_id: str
    ) -> Any:
        """Read a single field value from a table row."""
        import httpx

        ctx = MappingContext(api_key=self.api_key, organization_id=str(self.organization_id))

        url = f"{ctx.api_base_url}/rows"
        params = {"tableId": str(table_id), "rowId": row_id}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=ctx.headers, params=params)

                if response.status_code >= 400:
                    logger.warning(f"Failed to fetch row {row_id}: {response.status_code}")
                    return None

                data = response.json()
                rows = data.get("data", {}).get("rows", [])

                if not rows:
                    return None

                row = rows[0]
                return row.get(str(field_id))

        except Exception as e:
            logger.error(f"Error reading table field: {e}")
            return None
