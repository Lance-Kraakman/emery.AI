"""
LLM-based extraction functions for MPC components.
"""

import json
from typing import List, Dict, Optional
from jinja2 import Template
from .client import HuggingFaceLLMClient


def LLM_extract_states(user_text: str, template: Optional[str] = None, llm_client: Optional[HuggingFaceLLMClient] = None) -> List[Dict]:
    """Extract state variables from user description."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/extract_states.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        user_description=user_text,
        template=template
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "states": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "type": {"type": "string"},
                        "description": {"type": "string"},
                        "bounds": {"type": "object"}
                    },
                    "required": ["name", "type", "description"]
                }
            }
        },
        "required": ["states"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    return result.get("states", [])


def LLM_extract_inputs(user_text: str, template: Optional[str] = None, llm_client: Optional[HuggingFaceLLMClient] = None) -> List[Dict]:
    """Extract control inputs from user description."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/extract_inputs.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        user_description=user_text,
        template=template
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "inputs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "type": {"type": "string"},
                        "description": {"type": "string"},
                        "bounds": {"type": "object"}
                    },
                    "required": ["name", "type", "description"]
                }
            }
        },
        "required": ["inputs"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    return result.get("inputs", [])


def LLM_extract_outputs(user_text: str, template: Optional[str] = None, llm_client: Optional[HuggingFaceLLMClient] = None) -> List[Dict]:
    """Extract output variables from user description."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/extract_outputs.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        user_description=user_text,
        template=template
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "outputs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "type": {"type": "string"},
                        "description": {"type": "string"},
                        "unit": {"type": "string"}
                    },
                    "required": ["name", "type", "description"]
                }
            }
        },
        "required": ["outputs"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    return result.get("outputs", [])


def LLM_extract_disturbances(user_text: str, template: Optional[str] = None, llm_client: Optional[HuggingFaceLLMClient] = None) -> List[Dict]:
    """Extract external disturbances from user description."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/extract_disturbances.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        user_description=user_text,
        template=template
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "disturbances": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "type": {"type": "string"},
                        "description": {"type": "string"},
                        "characteristics": {"type": "object"}
                    },
                    "required": ["name", "type", "description"]
                }
            }
        },
        "required": ["disturbances"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    return result.get("disturbances", [])
