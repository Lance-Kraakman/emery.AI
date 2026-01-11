"""
Enhanced Smolagents Model Provider with Model Registry Support

AIDEV-NOTE: Centralized model provider supporting both dedicated endpoints and HF Inference API.
Integrates with model registry for pricing, capabilities, and access control.
Supports model selection hierarchy: skill > agent > organization > default.
"""

import asyncio
import os
import logging
import base64
from io import BytesIO
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass

from PIL import Image
from smolagents.models import Model, ChatMessage, MessageRole
from smolagents import OpenAIModel
from huggingface_hub import InferenceClient
from huggingface_hub.errors import HfHubHTTPError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, retry_if_not_exception_type

from .model_registry import (
    get_model_metadata,
    get_default_model_for_tier,
    get_default_vision_model,
    calculate_token_cost,
    ModelTier,
)
from ..grpc.mappers.message_types import MessageContentList

logger = logging.getLogger(__name__)


@dataclass
class TokenUsage:
    """Token usage information with cost tracking."""
    input_tokens: int = 0   # smolagents expects 'input_tokens', not 'prompt_tokens'
    output_tokens: int = 0  # smolagents expects 'output_tokens', not 'completion_tokens'
    total_tokens: int = 0
    cost_usd: float = 0.0   # Calculated cost in USD
    model_name: str = ""    # Model used for generation


class SmolagentsCompatibleMessage:
    """Message wrapper that provides all attributes expected by smolagents."""

    def __init__(
        self,
        content: str,
        role: str = "assistant",
        token_usage: Optional[TokenUsage] = None,
        tool_calls: Optional[List] = None
    ):
        self.content = content
        self.role = role
        self.token_usage = token_usage or TokenUsage()
        # Add attributes expected by smolagents
        self.name = None
        self.tool_calls = tool_calls  # Pass through tool_calls from API response
        self.raw = content  # smolagents uses raw as fallback when content is None


class CustomInferenceModel(Model):
    """Custom model class for dedicated HuggingFace inference endpoints."""

    def __init__(self, endpoint_url: str, model_name: str, token: str):
        self.endpoint_url = endpoint_url
        self.model_name = model_name
        self.client = InferenceClient(model=endpoint_url, token=token)

        # Tool calling configuration required by smolagents
        self.tool_name_key = "name"
        self.tool_description_key = "description"
        self.tool_parameters_key = "parameters"
        self.tool_arguments_key = "arguments"

        logger.info(f"🔧 CustomInferenceModel initialized with endpoint: {endpoint_url}")
        logger.info(f"🔧 Model name: {model_name}")

    def _convert_pil_to_base64_url(self, pil_image: Image.Image) -> str:
        """
        Convert PIL Image to base64 data URL for HuggingFace API.

        HuggingFace Inference API requires images as base64-encoded data URLs.
        Format: "data:image/jpeg;base64,{base64_string}"

        Args:
            pil_image: PIL Image object

        Returns:
            Base64 data URL string
        """
        buffered = BytesIO()
        image_format = getattr(pil_image, 'format', None) or "JPEG"
        pil_image.save(buffered, format=image_format)
        base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")
        mime_type = f"image/{image_format.lower()}"
        return f"data:{mime_type};base64,{base64_image}"

    def _process_message_content(self, content: MessageContentList) -> list[dict]:
        """
        Convert smolagents content format to HuggingFace API format.

        Transforms PIL Images to base64 data URLs for API serialization.

        Args:
            content: MessageContentList (list of content parts)

        Returns:
            List of dicts in HuggingFace API format
        """
        processed: list[dict] = []

        for part in content:
            part_type = part.get("type")

            if part_type == "text":
                processed.append({
                    "type": "text",
                    "text": part["text"]
                })
            elif part_type == "image":
                # Convert PIL Image to base64 data URL
                pil_image: Image.Image = part["image"]
                base64_url = self._convert_pil_to_base64_url(pil_image)
                processed.append({
                    "type": "image_url",
                    "image_url": {"url": base64_url}
                })
                logger.info(f"✅ Converted PIL Image to base64 data URL")
            elif part_type == "image_url":
                # Already in HuggingFace format
                processed.append(part)

        return processed

    def _format_tools_for_hf(self, tools_to_call_from: List) -> List[Dict]:
        """
        Convert smolagents Tool objects to HuggingFace tools format.

        Args:
            tools_to_call_from: List of smolagents Tool objects

        Returns:
            List of tools in HuggingFace/OpenAI function calling format
        """
        hf_tools = []
        for tool in tools_to_call_from:
            # Build properties from tool.inputs
            properties = {}
            required = []
            for name, spec in tool.inputs.items():
                # Normalize smolagents types to valid JSON Schema types
                # "any", "image", "audio" are not valid JSON Schema - convert to "string"
                raw_type = spec.get("type", "string")
                json_type = "string" if raw_type in ("any", "image", "audio") else raw_type
                properties[name] = {
                    "type": json_type,
                    "description": spec.get("description", "")
                }
                # smolagents uses 'nullable' or checks if required
                if not spec.get("nullable", False):
                    required.append(name)

            hf_tools.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or f"Execute {tool.name}",
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required
                    }
                }
            })
            logger.info(f"🔧 Formatted tool for HF API: {tool.name}")

        return hf_tools

    @retry(
        stop=stop_after_attempt(10),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=(
            retry_if_exception_type(HfHubHTTPError)
            & retry_if_not_exception_type((asyncio.CancelledError, GeneratorExit, KeyboardInterrupt))
        ),
        before_sleep=lambda retry_state: logger.warning(
            f"🔄 Retrying API call (attempt {retry_state.attempt_number}) after error"
        )
    )
    def _call_chat_completion(self, **kwargs):
        """Make chat completion call with retry logic for transient errors."""
        return self.client.chat_completion(**kwargs)

    def generate(
        self,
        messages: List[Union[ChatMessage, Dict[str, Any]]],
        stop_sequences: Optional[List[str]] = None,
        tools_to_call_from: Optional[List] = None,
        **kwargs
    ) -> Any:
        """
        Generate response using dedicated endpoint or HF Inference API.

        Accepts messages in two formats:
        1. ChatMessage objects (smolagents native format with PIL Images)
        2. Dict format (legacy HuggingFace format)

        Args:
            messages: Conversation messages
            stop_sequences: Optional stop sequences
            tools_to_call_from: Optional list of smolagents Tool objects for native tool calling
            **kwargs: Additional arguments (max_tokens, etc.)
        """
        try:
            # Convert messages to HuggingFace API format
            chat_messages: list[dict] = []

            for msg in messages:
                if isinstance(msg, ChatMessage):
                    role_str = msg.role.value
                    content: MessageContentList = msg.content

                    # Process content: convert PIL Images to base64
                    processed_content = self._process_message_content(content)

                    chat_messages.append({
                        "role": role_str,
                        "content": processed_content
                    })
                elif isinstance(msg, dict):
                    # Legacy dict format (if needed)
                    chat_messages.append(msg)
                else:
                    logger.warning(f"Unknown message format: {type(msg)}")

            logger.info(f"🚀 Generating with {len(chat_messages)} messages using model: {self.model_name}")

            # Convert smolagents tools to HuggingFace format if provided
            hf_tools = None
            if tools_to_call_from:
                hf_tools = self._format_tools_for_hf(tools_to_call_from)
                logger.info(f"🔧 Passing {len(hf_tools)} tools to chat_completion: {[t['function']['name'] for t in hf_tools]}")

            # Make request to your dedicated endpoint with correct model name
            # Build kwargs for chat_completion
            completion_kwargs = {
                "messages": chat_messages,
                "model": self.model_name,
                "stop": stop_sequences,
                "max_tokens": kwargs.get('max_tokens', 1024),
                "stream": False,
            }

            # Add tools and tool_choice if tools are provided
            if hf_tools:
                completion_kwargs["tools"] = hf_tools
                completion_kwargs["tool_choice"] = "auto"  # Explicitly enable tool calling

            response = self._call_chat_completion(**completion_kwargs)

            # Extract the content and usage information
            message = response.choices[0].message
            content = message.content

            # Extract tool_calls from response if present (native tool calling)
            tool_calls = None
            if hasattr(message, 'tool_calls') and message.tool_calls:
                tool_calls = message.tool_calls
                logger.info(f"🔧 Model returned {len(tool_calls)} tool calls: {[tc.function.name for tc in tool_calls]}")

            # Log response (content may be None when tool_calls are returned)
            content_len = len(content) if content else 0
            logger.info(f"✅ Generated response: {content_len} chars, {len(tool_calls) if tool_calls else 0} tool calls")

            # Extract token usage if available and calculate cost
            token_usage = None
            if hasattr(response, 'usage') and response.usage:
                usage = response.usage
                input_tokens = getattr(usage, 'prompt_tokens', 0)
                output_tokens = getattr(usage, 'completion_tokens', 0)
                total_tokens = getattr(usage, 'total_tokens', 0)

                # Calculate cost using model registry
                cost = calculate_token_cost(self.model_name, input_tokens, output_tokens)

                token_usage = TokenUsage(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    cost_usd=cost,
                    model_name=self.model_name,
                )
                logger.info(f"✅ Token usage: input={input_tokens}, output={output_tokens}, total={total_tokens}, cost=${cost:.6f}")
            else:
                logger.info("⚠️ No usage info in response")

            # Return smolagents-compatible message
            # Note: content may be None when model returns tool_calls
            return SmolagentsCompatibleMessage(
                content=content or "",
                role=getattr(message, 'role', 'assistant'),
                token_usage=token_usage,
                tool_calls=tool_calls
            )

        except Exception as e:
            logger.error(f"❌ Custom model generation failed: {e}")
            logger.error(f"❌ Message types: {[type(msg) for msg in messages]}")
            raise


class SmolagentsModelProvider:
    """
    Enhanced model provider with registry support.

    Supports:
    - Model selection hierarchy: skill override > agent default > org default > system default
    - Both dedicated endpoints and HF Inference API
    - Automatic cost tracking via model registry
    """

    def __init__(self):
        """Initialize provider with HuggingFace token."""
        self.hf_token = self._get_hf_token()
        logger.info("✅ SmolagentsModelProvider initialized with model registry support")

    def get_model_for_message(
        self,
        has_images: bool,
        model_id: Optional[str] = None,
    ) -> Model:
        """
        Get appropriate model for message based on content type.

        Args:
            has_images: Whether the message contains image content
            model_id: Optional specific model ID to use (overrides smart selection)

        Returns:
            Configured model instance (vision model if images present, text model otherwise)
        """
        # Use explicit model if provided
        if model_id:
            logger.info(f"🔧 Using explicit model: {model_id}")
            return self.get_model(model_id=model_id)

        # Smart model selection based on content
        if has_images:
            vision_model_id = get_default_vision_model()
            logger.info(f"🖼️ Images detected, using vision model: {vision_model_id}")
            return self.get_model(model_id=vision_model_id)
        else:
            # Use default text model
            default_model_id = get_default_model_for_tier(ModelTier.FREE)
            logger.info(f"📝 Text only, using default model: {default_model_id}")
            return self.get_model(model_id=default_model_id)

    def get_model(
        self,
        model_id: Optional[str] = None,
        model_type: str = 'default',
        api_key: Optional[str] = None,
    ) -> Model:
        """
        Get model instance by ID or type.

        Args:
            model_id: Specific model ID to use (e.g., 'ibm-granite/granite-3.3-8b-instruct')
            model_type: Fallback type if no model_id provided ('chat', 'tool_calling', 'default')
            api_key: Optional API key for providers that need it (e.g., Gemini)

        Returns:
            Configured model instance ready for generation
        """
        # Determine which model to use
        if not model_id:
            # Use default model for free tier
            model_id = get_default_model_for_tier(ModelTier.FREE)
            logger.info(f"🔧 No model specified, using default: {model_id}")

        # Get model metadata from registry
        metadata = get_model_metadata(model_id)
        if not metadata:
            logger.warning(f"⚠️ Model {model_id} not in registry, falling back to default")
            model_id = get_default_model_for_tier(ModelTier.FREE)
            metadata = get_model_metadata(model_id)

        logger.info(f"🔧 Creating model: {metadata.name} ({metadata.category.value})")

        # Handle Google Gemini models via OpenAI-compatible API
        if model_id.startswith("google/"):
            gemini_model_id = model_id.replace("google/", "")  # e.g., "gemini-2.0-flash"
            gemini_api_key = api_key or os.environ.get("GEMINI_API_KEY")
            if not gemini_api_key:
                raise EnvironmentError(
                    "GEMINI_API_KEY is required for Google Gemini models. "
                    "Get your API key from https://aistudio.google.com/apikey"
                )
            logger.info(f"🔧 Using Google Gemini via OpenAI-compatible API: {gemini_model_id}")
            return OpenAIModel(
                model_id=gemini_model_id,
                api_base="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=gemini_api_key,
                client_kwargs={"max_retries": 2},  # Don't retry quota errors aggressively
            )

        # Create model based on endpoint type
        if metadata.endpoint.type == "dedicated" and metadata.endpoint.url:
            # Dedicated endpoint - use full endpoint URL
            endpoint_url = metadata.endpoint.url
            logger.info(f"🔧 Using dedicated endpoint: {endpoint_url}")
        else:
            # HF Inference API - pass model ID directly (InferenceClient handles routing to router.huggingface.co)
            # AIDEV-NOTE: As of Nov 2025, old api-inference.huggingface.co is deprecated (404)
            # InferenceClient automatically routes to router.huggingface.co/hf-inference/ when given model ID
            endpoint_url = model_id
            logger.info(f"🔧 Using HF Inference API for model: {model_id}")

        model = CustomInferenceModel(
            endpoint_url=endpoint_url,
            model_name=model_id,
            token=self.hf_token
        )

        return model

    def get_model_by_type(self, model_type: str) -> Model:
        """
        Get model by type (legacy method for compatibility).

        Args:
            model_type: 'chat', 'tool_calling', or 'default'

        Returns:
            Configured model instance
        """
        # Map model types to actual models
        type_mapping = {
            'chat': 'ibm-granite/granite-3.3-8b-instruct',
            'tool_calling': 'ibm-granite/granite-3.3-8b-instruct',
            'default': 'ibm-granite/granite-3.3-8b-instruct',
        }

        model_id = type_mapping.get(model_type, type_mapping['default'])
        return self.get_model(model_id=model_id)

    def get_default_model_for_capability(self, skill_name: Optional[str] = None) -> Model:
        """
        Get default model for skill execution (legacy method for compatibility).

        Args:
            skill_name: Optional skill name (currently unused)

        Returns:
            Configured model instance
        """
        return self.get_model()  # Uses system default

    def resolve_model_selection(
        self,
        skill_model: Optional[str] = None,
        agent_model: Optional[str] = None,
        org_model: Optional[str] = None,
        has_images: bool = False,
    ) -> str:
        """
        Resolve model selection using hierarchy with vision model support.

        Priority:
        1. skill_model (if provided)
        2. agent_model (if provided)
        3. org_model (if provided)
        4. vision_model (if has_images=True and no explicit model)
        5. default model

        Args:
            skill_model: Model override from skill configuration
            agent_model: Default model from agent configuration
            org_model: Default model from organization configuration
            has_images: Whether the input contains images (triggers vision model)

        Returns:
            Model ID to use for execution
        """
        # DEBUG: Log all parameters at entry
        logger.info(f"🔍 [MODEL-PROVIDER] resolve_model_selection called with:")
        logger.info(f"🔍 [MODEL-PROVIDER] - skill_model: {repr(skill_model)}")
        logger.info(f"🔍 [MODEL-PROVIDER] - agent_model: {repr(agent_model)}")
        logger.info(f"🔍 [MODEL-PROVIDER] - org_model: {repr(org_model)}")
        logger.info(f"🔍 [MODEL-PROVIDER] - has_images: {has_images}")

        if skill_model:
            logger.info(f"📌 Using skill model override: {skill_model}")
            return skill_model

        if agent_model:
            logger.info(f"📌 Using agent default model: {agent_model}")
            return agent_model

        if org_model:
            logger.info(f"📌 Using organization default model: {org_model}")
            return org_model

        # Smart selection: vision model if images present, otherwise default
        if has_images:
            vision_model = get_default_vision_model()
            logger.info(f"🖼️ Images detected, using vision model: {vision_model}")
            return vision_model

        # Fall back to system default
        default_model = get_default_model_for_tier(ModelTier.FREE)
        logger.info(f"📌 Using system default model: {default_model}")
        return default_model

    def _get_hf_token(self) -> str:
        """Get HuggingFace token from environment."""
        token = os.getenv('HF_TOKEN')
        if not token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is required for HuggingFace API access. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        return token