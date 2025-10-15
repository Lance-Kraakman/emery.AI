"""
Simplified Smolagents Model Provider

AIDEV-NOTE: Custom model provider for IBM Granite model integration.
Successfully routes to dedicated HuggingFace endpoint with proper token mapping.
Endpoint: https://tpn5ewnxy4r17v9c.us-east-1.aws.endpoints.huggingface.cloud
Model: ibm-granite/granite-3.3-8b-instruct
"""

import os
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from smolagents.models import Model
from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)


@dataclass
class TokenUsage:
    """Token usage information compatible with smolagents expectations."""
    input_tokens: int = 0   # smolagents expects 'input_tokens', not 'prompt_tokens'
    output_tokens: int = 0  # smolagents expects 'output_tokens', not 'completion_tokens'
    total_tokens: int = 0


class SmolagentsCompatibleMessage:
    """Message wrapper that provides all attributes expected by smolagents."""

    def __init__(self, content: str, role: str = "assistant", token_usage: Optional[TokenUsage] = None):
        self.content = content
        self.role = role
        self.token_usage = token_usage or TokenUsage()
        # Add other attributes that might be expected
        self.name = None
        self.tool_calls = None


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

    def generate(self, messages: List[Any], stop_sequences: Optional[List[str]] = None, **kwargs) -> Any:
        """Generate response using dedicated endpoint with correct model name."""
        try:
            # Convert messages to the format expected by your endpoint
            chat_messages = []
            for msg in messages:
                # Handle both dict and ChatMessage object formats
                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                    # ChatMessage object
                    chat_messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
                elif isinstance(msg, dict):
                    # Dictionary format
                    chat_messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })
                else:
                    # Unknown format, log and skip
                    logger.warning(f"Unknown message format: {type(msg)}")
                    continue

            logger.info(f"🚀 Generating with {len(chat_messages)} messages using model: {self.model_name}")

            # Make request to your dedicated endpoint with correct model name
            response = self.client.chat_completion(
                messages=chat_messages,
                model=self.model_name,  # Send correct model name
                stop=stop_sequences,
                max_tokens=kwargs.get('max_tokens', 1024),
                stream=False
            )

            # Extract the content and usage information
            message = response.choices[0].message
            content = message.content
            logger.info(f"✅ Generated response: {len(content)} chars")

            # Extract token usage if available
            token_usage = None
            if hasattr(response, 'usage') and response.usage:
                usage = response.usage
                token_usage = TokenUsage(
                    input_tokens=getattr(usage, 'prompt_tokens', 0),      # Map prompt_tokens to input_tokens
                    output_tokens=getattr(usage, 'completion_tokens', 0), # Map completion_tokens to output_tokens
                    total_tokens=getattr(usage, 'total_tokens', 0)
                )
                logger.info(f"✅ Token usage: input={token_usage.input_tokens}, output={token_usage.output_tokens}, total={token_usage.total_tokens}")
            else:
                logger.info("⚠️ No usage info in response")

            # Return smolagents-compatible message
            return SmolagentsCompatibleMessage(
                content=content,
                role=getattr(message, 'role', 'assistant'),
                token_usage=token_usage
            )

        except Exception as e:
            logger.error(f"❌ Custom model generation failed: {e}")
            logger.error(f"❌ Message types: {[type(msg) for msg in messages]}")
            raise


class SmolagentsModelProvider:
    """Simple model provider using custom endpoint."""

    def __init__(self):
        """Initialize with custom endpoint and token."""
        self.hf_token = self._get_hf_token()
        self.endpoint_url = 'https://dxv8q9ubsizxcp4v.us-east-1.aws.endpoints.huggingface.cloud/v1'

        # Simple model config - all point to custom endpoint for now
        self.models = {
            'chat': self.endpoint_url,
            'tool_calling': self.endpoint_url,
            'default': self.endpoint_url
        }

        logger.info(f"✅ SmolagentsModelProvider initialized with custom endpoint")

    def get_model(self, model_type: str = 'default') -> CustomInferenceModel:
        """Get model for specified type. Types: 'chat', 'tool_calling', 'default'"""
        # Use custom model class to properly handle dedicated endpoint
        logger.info(f"🔧 Creating CustomInferenceModel with dedicated endpoint")

        model = CustomInferenceModel(
            endpoint_url=self.endpoint_url.replace('/v1', ''),  # Remove /v1 for InferenceClient
            model_name="ibm-granite/granite-3.3-8b-instruct",  # Exact model name your endpoint expects
            token=self.hf_token
        )
        logger.info(f"🔧 Created custom model: {model}")
        return model

    def _get_hf_token(self) -> str:
        """Get HuggingFace token from environment."""
        token = os.getenv('HF_TOKEN')
        if not token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is required for HuggingFace API access. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        return token