"""
HuggingFace InferenceClient wrapper for structured LLM output with retry logic.
"""

import json
import os
import time
from typing import Dict, Any, Optional
import requests
from jinja2 import Template


class HuggingFaceLLMClient:
    """Wrapper for HuggingFace InferenceClient with structured output support and retry logic."""
    
    def __init__(self, model_id: str = "microsoft/DialoGPT-medium", api_token: Optional[str] = None):
        """
        Initialize LLM client.
        
        Args:
            model_id: HuggingFace model identifier
            api_token: HuggingFace API token (defaults to HF_TOKEN env var)
        """
        self.model_id = model_id
        self.api_token = api_token or os.getenv("HF_TOKEN")
        if not self.api_token:
            raise ValueError("HF_TOKEN environment variable is required")
        self.base_url = "https://api-inference.huggingface.co/models"
        self.headers = {"Authorization": f"Bearer {self.api_token}"}
    
    def generate_structured_output(
        self, 
        prompt: str, 
        output_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 1024,
        max_retries: int = 3,
        retry_delay: float = 1.0
    ) -> Dict[str, Any]:
        """
        Generate structured JSON output from LLM using prompt engineering.
        
        Args:
            prompt: Input prompt for the LLM
            output_schema: JSON schema describing expected output format
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            
        Returns:
            Structured output as dictionary
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                # Create a detailed prompt for structured output
                schema_str = json.dumps(output_schema, indent=2)
                
                full_prompt = f"""Generate a JSON response for the following request:

{prompt}

The response must be valid JSON that matches this schema:
{schema_str}

Important: Return ONLY the JSON object, no additional text, explanations, or markdown formatting.

JSON Response:"""
                
                response = self.client.text_generation(
                    full_prompt,
                    temperature=temperature,
                    max_new_tokens=max_tokens,
                    do_sample=True,
                    return_full_text=False
                )
                
                print(f"Raw LLM response (attempt {attempt + 1}): {repr(response)}")
                
                # Parse the JSON response
                json_output = self._extract_json_from_response(response)
                
                # Validate and return
                validated = self._validate_output(json_output, output_schema)
                
                # Check if we got meaningful content
                if validated and any(validated.values()):
                    return validated
                
                # If empty but valid, continue to retry
                last_error = "Empty or invalid response"
                
            except Exception as e:
                last_error = str(e)
                print(f"Attempt {attempt + 1} failed: {e}")
                
                if attempt < max_retries:
                    time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
                continue
        
        # All retries failed, return fallback
        print(f"All {max_retries + 1} attempts failed. Last error: {last_error}")
        return self._get_fallback_output(output_schema)
    
    def _format_prompt_for_json(self, prompt: str, schema: Dict[str, Any]) -> str:
        """Format prompt to request JSON output."""
        schema_str = json.dumps(schema, indent=2)
        
        return f"""{prompt}

Please respond with a valid JSON object that follows this schema:
{schema_str}

Your response should be ONLY the JSON object, no additional text.

Example response format:
{{
  "field1": "value1",
  "field2": ["item1", "item2"],
  "field3": {{"nested": "value"}}
}}

JSON Response:"""
    
    def _extract_json_from_response(self, response: str) -> Dict[str, Any]:
        """Extract JSON from LLM response."""
        # Try to find JSON object in response
        response = response.strip()
        
        # Look for JSON object boundaries
        start_idx = response.find('{')
        end_idx = response.rfind('}') + 1
        
        if start_idx != -1 and end_idx != -1:
            json_str = response[start_idx:end_idx]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass
        
        # Fallback: try to parse entire response
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # If all else fails, return empty dict
            return {}
    
    def _validate_output(self, output: Dict[str, Any], schema: Dict[str, Any]) -> Dict[str, Any]:
        """Basic validation of output against schema."""
        # Simple validation - check required fields exist
        validated = {}
        
        if "properties" in schema:
            for field, field_schema in schema["properties"].items():
                if field in output:
                    validated[field] = output[field]
                elif field in schema.get("required", []):
                    # Add default value for required fields
                    field_type = field_schema.get("type", "string")
                    if field_type == "array":
                        validated[field] = []
                    elif field_type == "object":
                        validated[field] = {}
                    else:
                        validated[field] = ""
        
        return validated
    
    def _get_fallback_output(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Get fallback output when LLM fails."""
        fallback = {}
        
        if "properties" in schema:
            for field, field_schema in schema["properties"].items():
                field_type = field_schema.get("type", "string")
                if field_type == "array":
                    fallback[field] = []
                elif field_type == "object":
                    fallback[field] = {}
                else:
                    fallback[field] = ""
        
        return fallback
    
    def generate_text(
        self, 
        prompt: str, 
        temperature: float = 0.7,
        max_tokens: int = 512,
        max_retries: int = 3
    ) -> str:
        """Generate free-form text response with retry logic."""
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                response = self.client.text_generation(
                    prompt,
                    temperature=temperature,
                    max_new_tokens=max_tokens,
                    do_sample=True
                )
                return response.strip()
            except Exception as e:
                last_error = str(e)
                print(f"Text generation attempt {attempt + 1} failed: {e}")
                
                if attempt < max_retries:
                    time.sleep(1.0 * (2 ** attempt))
                continue
        
        print(f"All text generation attempts failed. Last error: {last_error}")
        return ""