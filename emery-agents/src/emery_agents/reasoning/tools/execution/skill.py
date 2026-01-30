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
import threading
from typing import Any, Callable, TYPE_CHECKING

from ....entities.skill_config import SkillConfigDTO
from ....services.data.output_mapping import MappingContext, OutputMappingService
from ....types import SkillExecutionResult
from ....utils import run_async_in_thread

if TYPE_CHECKING:
    from ....entities.task import SkillOutputValue

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
        skill_config: SkillConfigDTO,
        skill_executor: Callable,
        api_key: str | None = None,
        organization_id: int | None = None,
    ):
        self.skill_config = skill_config
        self.skill_executor = skill_executor
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

        logger.info(
            f"Created SkillTool: {self.name} with {len(self.inputs)} inputs"
        )

    def __call__(self, **kwargs: Any) -> str:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def _has_output_mappings(self) -> bool:
        """Check if skill has any outputs with output mappings configured."""
        if not self.skill_config.outputs:
            return False
        for output in self.skill_config.outputs:
            if output.output_mapping is not None:
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
        """Convert skill config inputs to tool input schema."""
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

        logger.info(
            f"Executing skill: {self.name} (depth: {current_depth + 1}) "
            f"with inputs: {list(kwargs.keys())}"
        )

        call_stack.add(skill_name)

        try:
            enriched_kwargs = run_async_in_thread(self._resolve_input_mappings(kwargs))

            from ....services.agents.executor import AgentExecutor

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
            if output.output_mapping is not None
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
            config = first_output.output_mapping

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
            if input_def.input_mapping is None:
                continue

            if input_def.name in resolved and resolved[input_def.name] is not None:
                continue

            mapping = input_def.input_mapping
            source = mapping["source"]

            row_source = source.get("row_source", {})
            row_id = self._resolve_row_id(row_source, resolved)
            if row_id is None:
                logger.debug(f"Could not resolve row_id for input '{input_def.name}'")
                continue

            value = await self._read_table_field(
                table_id=source["table_id"], field_id=source["field_id"], row_id=row_id
            )

            if value is not None:
                logger.info(f"Resolved input '{input_def.name}' from table field")
                resolved[input_def.name] = value

        return resolved

    def _resolve_row_id(self, row_source: dict[str, Any], context: dict[str, Any]) -> str | None:
        """Resolve row ID from row source configuration."""
        from ....services.agents.executor import AgentExecutor

        if row_source.get("use_source_row", False):
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
        elif row_source.get("static_id"):
            return row_source["static_id"]
        elif row_source.get("skill_input"):
            value = context.get(row_source["skill_input"])
            return str(value) if value is not None else None
        elif row_source.get("skill_output"):
            value = context.get(row_source["skill_output"])
            return str(value) if value is not None else None
        elif row_source.get("table_ref"):
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
