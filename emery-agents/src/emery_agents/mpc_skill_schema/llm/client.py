"""
HuggingFace InferenceClient wrapper for structured LLM output.
"""

import json
import os
from typing import Dict, Any, Optional
from huggingface_hub import InferenceClient
from jinja2 import Template


class HuggingFaceLLMClient:
    """Wrapper for HuggingFace InferenceClient with structured output support."""
    
    def __init__(self, model_id: str = "microsoft/DialoGPT-medium", api_token: Optional[str] = None):
        """
        Initialize LLM client.
        
        Args:
            model_id: HuggingFace model identifier
            api_token: HuggingFace API token (defaults to HF_TOKEN env var)
        """
        self.model_id = model_id
        self.api_token = api_token or os.getenv("HF_TOKEN")
        self.client = InferenceClient(model_id, token=self.api_token)
    
    def generate_structured_output(
        self, 
        prompt: str, 
        output_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 1024
    ) -> Dict[str, Any]:
        """
        Generate structured JSON output from LLM.
        
        Args:
            prompt: Input prompt for the LLM
            output_schema: JSON schema describing expected output format
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Returns:
            Structured output as dictionary
        """
        # Add JSON formatting instructions to prompt
        formatted_prompt = self._format_prompt_for_json(prompt, output_schema)
        
        try:
            response = self.client.text_generation(
                formatted_prompt,
                temperature=temperature,
                max_new_tokens=max_tokens,
                do_sample=True
            )
            
            # Extract JSON from response
            json_output = self._extract_json_from_response(response)
            
            # Validate against schema
            return self._validate_output(json_output, output_schema)
            
        except Exception as e:
            print(f"Error generating structured output: {e}")
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
        max_tokens: int = 512
    ) -> str:
        """Generate free-form text response."""
        try:
            response = self.client.text_generation(
                prompt,
                temperature=temperature,
                max_new_tokens=max_tokens,
                do_sample=True
            )
            return response.strip()
        except Exception as e:
            print(f"Error generating text: {e}")
            return ""
