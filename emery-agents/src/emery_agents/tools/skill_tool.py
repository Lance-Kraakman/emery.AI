"""
SkillTool - Executes skills as tools within the agent framework

This tool wraps a SkillConfig and executes it when called by the LLM.
Uses lazy initialization to avoid circular dependencies.

Includes recursion protection:
- Prevents circular skill calls (A → B → A)
- Enforces maximum nesting depth (MAX_DEPTH=10)

AIDEV-NOTE: Supports two execution modes:
- 'agent' (default): Creates sub-agent with LLM orchestration via smolagents
- 'task-model': Direct model invocation for single-task models (image gen, speech, etc.)

AIDEV-NOTE: Output Mapping (Phase 2e)
When skill outputs have mapping configuration, results are automatically saved to tables:
- mode='create': Creates a new row with the output value
- mode='update': Updates an existing row (specified by rowId)
Binary outputs (images, audio) are uploaded to S3 first.
"""

import asyncio
import logging
import os
import threading
import uuid
from typing import Any, Callable, Dict, Optional, Set, TYPE_CHECKING

import httpx
from smolagents import Tool
from ..grpc.generated.agent_worker_pb2 import SkillConfig

if TYPE_CHECKING:
    from ..clients import HuggingFaceInferenceClient

logger = logging.getLogger(__name__)


class SkillTool(Tool):
    """
    Tool that executes a skill when called by the LLM.

    Uses lazy initialization: skill_config is stored at creation,
    but the sub-agent is only created when forward() is called.
    This avoids circular dependencies during tool loading.

    Includes recursion protection:
    - Class-level call stack tracks active skills to prevent circular calls
    - MAX_DEPTH limits nesting to prevent runaway recursion

    When the LLM calls this tool, it:
    1. Takes the runtime inputs from the LLM
    2. Calls the execution callback with skill_config + inputs
    3. The callback creates a sub-agent and executes the skill
    4. Returns the result as a string
    """

    # Maximum nesting depth for skill-calling-skill chains
    MAX_DEPTH = 10

    # Thread-local storage for call stack (prevents cross-request contamination)
    _thread_local = threading.local()

    # Skip smolagents' forward signature validation since skills have dynamic inputs
    # This is the official pattern for tools with variable input schemas (see SpaceToolWrapper, LangChainToolWrapper)
    skip_forward_signature_validation = True

    def __init__(
        self,
        skill_config: SkillConfig,
        skill_executor: Callable[[SkillConfig, Dict[str, Any]], str],
        inference_client: Optional["HuggingFaceInferenceClient"] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ):
        """
        Initialize SkillTool with lazy execution.

        Args:
            skill_config: The full skill definition from proto
            skill_executor: Callback function that executes the skill
                          Takes (skill_config, runtime_inputs) -> result string
            inference_client: Optional client for direct task-model execution
                             Required for skills with execution_type='task-model'
            api_key: Optional API key for output mapping (calls emery-api)
            organization_id: Optional org ID for output mapping (RLS context)
        """
        # Call parent's __init__ to set is_initialized flag
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
        self._is_task_model = self._check_is_task_model()
        execution_mode = "task-model" if self._is_task_model else "agent"
        logger.info(f"✨ Created SkillTool: {self.name} ({execution_mode}) with {len(self.inputs)} inputs")

    def _check_is_task_model(self) -> bool:
        """Check if this skill uses task-model execution."""
        # SkillConfig is a protobuf - execution_type field is always present (empty string if not set)
        return self.skill_config.execution_type == 'task-model'

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

    def _build_inputs_schema(self) -> Dict[str, Dict[str, str]]:
        """
        Convert SkillConfig.inputs to smolagents tool input schema.

        Returns:
            Dict mapping input name to {type, description}
        """
        inputs_schema = {}

        for skill_input in self.skill_config.inputs:
            # Map skill input types to smolagents types
            type_mapping = {
                "text": "string",
                "image": "string",  # URL to image
                "file": "string",   # URL to file
                "audio": "string",  # URL to audio
                "video": "string",  # URL to video
                "document": "string"  # URL to document
            }

            input_type = type_mapping.get(skill_input.type, "string")

            inputs_schema[skill_input.name] = {
                "type": input_type,
                "description": f"{'(Required) ' if skill_input.required else '(Optional) '}{skill_input.name}"
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

        For 'task-model' skills:
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

        execution_mode = "task-model" if self._is_task_model else "agent"
        logger.info(f"🎯 Executing skill: {self.name} ({execution_mode}, depth: {current_depth + 1}/{self.MAX_DEPTH}) with inputs: {list(kwargs.keys())}")

        # Add to call stack
        call_stack.add(skill_name)

        try:
            # Route based on execution type
            if self._is_task_model:
                # Inject images/audio from parent context if available
                enriched_kwargs = self._inject_context_inputs(kwargs)
                result = self._execute_task_model(enriched_kwargs)
            else:
                # Standard agent execution via callback
                result = self.skill_executor(self.skill_config, kwargs)

            logger.info(f"✅ Skill {self.name} completed successfully")
            return result

        except Exception as e:
            error_msg = f"Skill execution failed: {str(e)}"
            logger.error(f"❌ Skill {self.name} failed: {e}", exc_info=True)
            return error_msg

        finally:
            # Always remove from call stack, even on error
            call_stack.discard(skill_name)

    def _apply_template_substitution(self, runtime_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply Jinja2 template substitution for task-model execution.

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
        from jinja2 import Template

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

        For task-model skills, the LLM only passes text kwargs (e.g., prompt).
        Images/audio from chat attachments are in the parent's ExecutionContext.
        This method retrieves them and injects into kwargs based on skill input types.

        REUSES existing utilities:
        - ImageProcessor.download_images_from_attachments() for images
        - file_processor.download_file() for audio

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

            # Skip if already provided by LLM
            if input_name in result and result[input_name]:
                continue

            # Inject image from context
            if input_type == 'image' and parent_context.images:
                image_bytes = self._download_and_convert_image(parent_context.images)
                if image_bytes:
                    result[input_name] = image_bytes
                    logger.info(f"📷 Injected image from context into '{input_name}' ({len(image_bytes)} bytes)")

            # Inject audio from context
            elif input_type == 'audio' and parent_context.attachments:
                audio_bytes = self._download_audio(parent_context.attachments)
                if audio_bytes:
                    result[input_name] = audio_bytes
                    logger.info(f"🎵 Injected audio from context into '{input_name}' ({len(audio_bytes)} bytes)")

        return result

    def _download_and_convert_image(self, image_attachments) -> Optional[bytes]:
        """
        Download images from context and convert to bytes for HF API.

        REUSES: ImageProcessor.download_images_from_attachments()
        """
        import asyncio
        from io import BytesIO
        from ..services.image_processor import ImageProcessor

        try:
            # Run async download in sync context
            loop = asyncio.get_event_loop()
            pil_images = loop.run_until_complete(
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
        """
        import asyncio
        from ..services.file_processor import download_file

        for attachment in attachments:
            mime_type = getattr(attachment, 'mime_type', '') or ''
            if mime_type.startswith('audio/'):
                try:
                    loop = asyncio.get_event_loop()
                    audio_bytes = loop.run_until_complete(
                        download_file(attachment.url)
                    )
                    return audio_bytes
                except Exception as e:
                    logger.error(f"Failed to download audio: {e}")

        return None

    def _execute_task_model(self, runtime_inputs: Dict[str, Any]) -> str:
        """
        Execute skill directly without LLM orchestration.

        Uses HuggingFace Inference API for single-task model execution.

        Args:
            runtime_inputs: Inputs from the LLM call (possibly enriched with context)

        Returns:
            Task result as string (for text) or description of binary output
        """
        if not self.inference_client:
            raise ValueError(
                f"Task-model skill '{self.skill_config.name}' requires inference_client. "
                "Ensure inference_client is passed when creating SkillTool."
            )

        task_config = self.skill_config.task_model_config
        if not task_config:
            raise ValueError(
                f"Task-model skill '{self.skill_config.name}' missing task_model_config"
            )

        model_id = task_config.model_id
        task_type = task_config.task_type
        parameters = dict(task_config.parameters) if task_config.parameters else {}

        logger.info(f"🚀 Direct task-model execution: {model_id} ({task_type})")

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
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        result = loop.run_until_complete(
            self.inference_client.execute_task(
                model_id=model_id,
                task_type=task_type,
                inputs=final_inputs,
                parameters=parameters
            )
        )

        # Apply output mappings if configured (async, use same loop)
        loop.run_until_complete(self._apply_output_mappings(result))

        # Return result based on type
        if result.is_text:
            return str(result.data)
        elif result.is_structured:
            import json
            return json.dumps(result.data)
        elif result.is_binary:
            # For binary results, return description with any mapped output info
            return f"Generated {result.type.value}: {len(result.data)} bytes ({result.metadata})"
        else:
            return str(result.data)

    async def _apply_output_mappings(self, result: "TaskResult") -> None:
        """
        Apply output mappings to save skill results to tables.

        For each output with a mapping:
        - mode='create': Creates a new row with the output value
        - mode='update': Updates an existing row (by rowId)

        Binary outputs (images, audio) are uploaded to S3 first via the files API.

        Args:
            result: The TaskResult from inference execution
        """
        from ..clients import TaskResult

        # Check if we have auth for API calls
        if not self.api_key or not self.organization_id:
            logger.debug("No API auth available, skipping output mappings")
            return

        # Get outputs with mappings
        outputs_with_mappings = [
            output for output in self.skill_config.outputs
            if output.HasField('mapping') and output.mapping.table_id > 0
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured")
            return

        logger.info(f"📊 Applying {len(outputs_with_mappings)} output mappings")

        async with httpx.AsyncClient(timeout=30.0) as client:
            for output in outputs_with_mappings:
                try:
                    await self._apply_single_output_mapping(client, output, result)
                except Exception as e:
                    logger.error(f"❌ Failed to apply output mapping for {output.name}: {e}")

    async def _apply_single_output_mapping(
        self,
        client: httpx.AsyncClient,
        output,
        result: "TaskResult"
    ) -> None:
        """
        Apply a single output mapping.

        Args:
            client: HTTP client for API calls
            output: SkillOutput with mapping configuration
            result: The TaskResult from inference execution
        """
        import json
        import base64

        mapping = output.mapping
        table_id = mapping.table_id
        field_id = mapping.field_id
        mode = mapping.mode or 'create'
        row_id = mapping.row_id if mapping.row_id else None

        # Determine the value to save based on result type
        if result.is_text:
            field_value = str(result.data)
        elif result.is_structured:
            # Store structured data as JSON in document field
            field_value = result.data
        elif result.is_binary:
            # Upload binary to S3 via files API, get file metadata
            field_value = await self._upload_binary_to_s3(client, result, output.name)
        else:
            field_value = str(result.data)

        # Build request headers
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Organization-ID": str(self.organization_id),
            "Content-Type": "application/json"
        }

        # Make API request based on mode
        if mode == 'create':
            # Create new row
            url = f"{self.api_base_url}/rows"
            data = {
                "tableId": table_id,
                "data": {str(field_id): field_value}
            }
            logger.info(f"📝 Creating row in table {table_id}, field {field_id}")

            response = await client.post(url, headers=headers, json=data)
            if response.status_code >= 400:
                logger.error(f"Failed to create row: {response.status_code} - {response.text[:200]}")
            else:
                logger.info(f"✅ Created row in table {table_id}")

        elif mode == 'update' and row_id:
            # Update existing row
            url = f"{self.api_base_url}/rows"
            data = {
                "tableId": table_id,
                "rowId": row_id,
                "data": {str(field_id): field_value}
            }
            logger.info(f"📝 Updating row {row_id} in table {table_id}, field {field_id}")

            response = await client.put(url, headers=headers, json=data)
            if response.status_code >= 400:
                logger.error(f"Failed to update row: {response.status_code} - {response.text[:200]}")
            else:
                logger.info(f"✅ Updated row {row_id} in table {table_id}")
        else:
            logger.warning(f"Invalid mapping mode or missing rowId: mode={mode}, rowId={row_id}")

    async def _upload_binary_to_s3(
        self,
        client: httpx.AsyncClient,
        result: "TaskResult",
        output_name: str
    ) -> Dict[str, Any]:
        """
        Upload binary result to S3 via the files upload API.

        Returns file metadata suitable for storing in a file column.

        Args:
            client: HTTP client for API calls
            result: TaskResult with binary data
            output_name: Name of the output (used for filename)

        Returns:
            File metadata dict for file column
        """
        import base64

        # Determine file extension from result metadata
        mime_type = result.metadata.get('mime_type', 'application/octet-stream')
        extension = self._mime_to_extension(mime_type)
        filename = f"{output_name}_{uuid.uuid4().hex[:8]}.{extension}"

        # Prepare multipart upload
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Organization-ID": str(self.organization_id)
        }

        # Upload via files API
        url = f"{self.api_base_url}/files/upload"

        # Use multipart form data for file upload
        files = {
            'file': (filename, result.data, mime_type)
        }

        logger.info(f"📤 Uploading {len(result.data)} bytes to S3 as {filename}")

        response = await client.post(url, headers=headers, files=files)
        if response.status_code >= 400:
            logger.error(f"Failed to upload file: {response.status_code} - {response.text[:200]}")
            # Return placeholder if upload fails
            return {
                "error": f"Upload failed: {response.status_code}",
                "filename": filename,
                "size": len(result.data)
            }

        # Return file metadata from API response
        try:
            file_data = response.json()
            logger.info(f"✅ Uploaded file: {file_data.get('id', 'unknown')}")
            return file_data
        except Exception as e:
            logger.error(f"Failed to parse upload response: {e}")
            return {"error": str(e), "filename": filename}

    def _mime_to_extension(self, mime_type: str) -> str:
        """Convert MIME type to file extension."""
        extensions = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/ogg': 'ogg',
            'audio/flac': 'flac',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'application/pdf': 'pdf',
            'application/json': 'json',
            'text/plain': 'txt',
        }
        return extensions.get(mime_type, 'bin')
