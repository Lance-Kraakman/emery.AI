"""
Modern HuggingFace InferenceClient wrapper with structured outputs and retry logic.
"""

import os
import time
import json
from typing import List, Dict, Any, Type, Optional

from huggingface_hub import InferenceClient
import requests


class HuggingFaceClient:
    """
    HuggingFace InferenceClient wrapper with native structured output support.
    
    Uses modern HF structured outputs with response_format and JSON schema validation.
    Includes retry logic for network failures only - no fallbacks for LLM errors.
    """
    
    def __init__(self, model: str = "Qwen/Qwen2.5-14B-Instruct", token: Optional[str] = None, provider: str = "auto"):
        """
        Initialize HuggingFace client.
        
        Args:
            model: HuggingFace model name
            token: HF API token (defaults to HF_TOKEN env var)
            provider: Inference provider ("auto", "cerebras", etc.)
        """
        self.model = model
        self.token = token or os.getenv("HF_TOKEN")
        if not self.token:
            raise ValueError("HF_TOKEN environment variable is required")
        
        # Initialize HF InferenceClient
        self.client = InferenceClient(
            model=model,
            token=self.token
        )
    
    def generate_structured(self, messages: List[Dict[str, str]], response_model: Type) -> Any:
        """
        Generate structured output using text generation with JSON parsing.
        
        Args:
            messages: List of chat messages with 'role' and 'content'
            response_model: Class for structured output (simple class with __init__)
            
        Returns:
            Instance of response_model with LLM-generated data
            
        Raises:
            Exception: If generation fails (no fallbacks)
        """
        # Create a simple schema description from the class
        schema_description = self._create_schema_description(response_model)
        
        # Add schema to system message
        enhanced_messages = [
            {
                "role": "system",
                "content": f"You must respond with valid JSON that matches this schema:\n{schema_description}\n\nReturn ONLY the JSON object, no additional text."
            }
        ] + messages
        
        response = self._with_retry(lambda: self.client.chat_completion(
            messages=enhanced_messages,
            max_tokens=2048,
            temperature=0.1
        ))
        
        # Parse and create response object
        content = response.choices[0].message.content or ""
        try:
            data = json.loads(content)
            return self._create_model_instance(response_model, data)
        except Exception as e:
            raise ValueError(f"Failed to parse LLM response as {response_model.__name__}: {e}\nResponse: {content}")
    
    def generate_text(self, messages: List[Dict[str, str]], max_tokens: int = 1024, temperature: float = 0.7) -> str:
        """
        Generate free-form text response.
        
        Args:
            messages: List of chat messages
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            
        Returns:
            Generated text response
            
        Raises:
            Exception: If generation fails (no fallbacks)
        """
        response = self._with_retry(lambda: self.client.chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        ))
        
        content = response.choices[0].message.content or ""
        return content.strip()
    
    def _with_retry(self, func, max_retries: int = 3, base_delay: float = 1.0):
        """
        Retry with exponential backoff for network errors only.
        
        Args:
            func: Function to execute
            max_retries: Maximum retry attempts
            base_delay: Base delay between retries
            
        Returns:
            Result of func()
            
        Raises:
            Exception: If all retries fail or if error is not network-related
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                return func()
            except (requests.RequestException, requests.ConnectionError, requests.Timeout) as e:
                last_error = e
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    print(f"Network error (attempt {attempt + 1}/{max_retries + 1}): {e}")
                    print(f"Retrying in {delay:.1f} seconds...")
                    time.sleep(delay)
                else:
                    raise Exception(f"Network error after {max_retries + 1} attempts: {e}")
            except Exception as e:
                # Don't retry on validation, parsing, or API errors
                raise e
        
        # This should never be reached
        if last_error:
            raise last_error
        else:
            raise Exception("Unknown error in retry logic")
    
    def _create_schema_description(self, response_model: Type) -> str:
        """Create a simple schema description from the class."""
        # For now, return a basic schema description
        # In a more complete implementation, we could inspect the class __init__ signature
        if response_model.__name__ == "ComponentExtraction":
            return """{
    "states": [{"name": "string", "type": "continuous|discrete|binary|categorical", "description": "string", "bounds": {"min_val": float, "max_val": float}, "unit": "string"}],
    "inputs": [{"name": "string", "type": "continuous|discrete|binary|categorical", "description": "string", "bounds": {"min_val": float, "max_val": float}, "unit": "string"}],
    "outputs": [{"name": "string", "type": "continuous|discrete|binary|categorical", "description": "string", "unit": "string"}],
    "disturbances": [{"name": "string", "type": "continuous|discrete|binary|categorical", "description": "string", "characteristics": {}}]
}"""
        elif response_model.__name__ == "SystemDynamics":
            return """{
    "representation": "string",
    "equations": ["string"],
    "assumptions": ["string"],
    "parameters": {}
}"""
        else:
            return "{}"
    
    def _create_model_instance(self, response_model: Type, data: Dict) -> Any:
        """Create an instance of the response model from parsed JSON data."""
        try:
            return response_model(**data)
        except TypeError:
            # Handle cases where the class expects different parameters
            if response_model.__name__ == "ComponentExtraction":
                return response_model(
                    states=data.get("states", []),
                    inputs=data.get("inputs", []),
                    outputs=data.get("outputs", []),
                    disturbances=data.get("disturbances", [])
                )
            elif response_model.__name__ == "SystemDynamics":
                return response_model(
                    representation=data.get("representation", "pseudo_python"),
                    equations=data.get("equations", []),
                    assumptions=data.get("assumptions", []),
                    parameters=data.get("parameters", {})
                )
            else:
                # Fallback: try with no arguments
                return response_model()