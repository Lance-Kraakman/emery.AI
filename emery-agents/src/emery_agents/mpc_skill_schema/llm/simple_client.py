"""
Simple LLM client for MPC skill generation using HuggingFace API.
"""

import json
import os
import time
import requests
from typing import Dict, Any, Optional


class SimpleLLMClient:
    """Simple LLM client using HuggingFace Inference API."""
    
    def __init__(self, model_id: str = "google/flan-t5-base", api_token: Optional[str] = None):
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
        self.base_url = "https://router.huggingface.co/hf-inference/models"
        self.headers = {"Authorization": f"Bearer {self.api_token}"}
    
    def generate_structured_output(
        self, 
        prompt: str, 
        output_schema: Dict[str, Any],
        temperature: float = 0.7,
        max_tokens: int = 512,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Generate structured JSON output from LLM.
        
        Args:
            prompt: Input prompt for the LLM
            output_schema: JSON schema describing expected output format
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            max_retries: Maximum number of retry attempts
            
        Returns:
            Structured output as dictionary
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                # Create structured prompt
                schema_str = json.dumps(output_schema, indent=2)
                
                full_prompt = f"""Generate a JSON response for the following request:

{prompt}

The response must be valid JSON that matches this schema:
{schema_str}

Important: Return ONLY the JSON object, no additional text, explanations, or markdown formatting.

JSON Response:"""
                
                # Make API call
                payload = {
                    "inputs": full_prompt,
                    "parameters": {
                        "temperature": temperature,
                        "max_new_tokens": max_tokens,
                        "return_full_text": False
                    }
                }
                
                response = requests.post(
                    f"{self.base_url}/{self.model_id}",
                    headers=self.headers,
                    json=payload,
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if isinstance(result, list) and result:
                        text_response = result[0].get("generated_text", "")
                    else:
                        text_response = str(result)
                    
                    print(f"Raw LLM response (attempt {attempt + 1}): {repr(text_response)}")
                    
                    # Parse JSON
                    json_output = self._extract_json_from_response(text_response)
                    
                    # Validate
                    validated = self._validate_output(json_output, output_schema)
                    
                    if validated and any(validated.values()):
                        return validated
                
                last_error = f"HTTP {response.status_code}: {response.text}"
                
            except Exception as e:
                last_error = str(e)
                print(f"Attempt {attempt + 1} failed: {e}")
                
                if attempt < max_retries:
                    time.sleep(2 ** attempt)  # Exponential backoff
                continue
        
        print(f"All {max_retries + 1} attempts failed. Last error: {last_error}")
        return self._get_fallback_output(output_schema)
    
    def generate_text(self, prompt: str, max_tokens: int = 100) -> str:
        """Generate simple text response."""
        try:
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": max_tokens,
                    "return_full_text": False
                }
            }
            
            response = requests.post(
                f"{self.base_url}/{self.model_id}",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and result:
                    return result[0].get("generated_text", "").strip()
            
            return ""
            
        except Exception as e:
            print(f"Text generation error: {e}")
            return ""
    
    def _extract_json_from_response(self, response: str) -> Dict[str, Any]:
        """Extract JSON from LLM response."""
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
            return {}
    
    def _validate_output(self, output: Dict[str, Any], schema: Dict[str, Any]) -> Dict[str, Any]:
        """Basic validation of output against schema."""
        validated = {}
        
        if "properties" in schema:
            for field, field_schema in schema["properties"].items():
                if field in output:
                    validated[field] = output[field]
                elif field in schema.get("required", []):
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