"""
LLM-based mapping functions for MPC components.
"""

import json
from typing import List, Dict, Optional
from jinja2 import Template
from .client import HuggingFaceLLMClient
from ..core.schema import Objective
from ..core.types import ObjectiveType


def LLM_map_text_to_objectives(
    user_text: str, 
    template: Optional[str] = None,
    states: Optional[List[Dict]] = None,
    inputs: Optional[List[Dict]] = None,
    outputs: Optional[List[Dict]] = None,
    llm_client: Optional[HuggingFaceLLMClient] = None
) -> List[Objective]:
    """Map text to structured objectives."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/map_objectives.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        user_description=user_text,
        template=template,
        states=states or [],
        inputs=inputs or [],
        outputs=outputs or []
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "objectives": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "target_variable": {"type": "string"},
                        "target_value": {"type": "number"},
                        "weight": {"type": "number"},
                        "description": {"type": "string"}
                    },
                    "required": ["type", "target_variable", "weight", "description"]
                }
            }
        },
        "required": ["objectives"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    
    # Convert to Objective objects
    objectives = []
    for obj_data in result.get("objectives", []):
        # Map string type to enum
        type_map = {
            "minimize": ObjectiveType.MINIMIZE,
            "maximize": ObjectiveType.MAXIMIZE,
            "track": ObjectiveType.TRACK,
            "balance": ObjectiveType.BALANCE,
            "stabilize": ObjectiveType.STABILIZE
        }
        
        objective = Objective(
            type=type_map.get(obj_data.get("type"), ObjectiveType.MINIMIZE),
            target_variable=obj_data.get("target_variable", ""),
            target_value=obj_data.get("target_value"),
            weight=obj_data.get("weight", 1.0),
            description=obj_data.get("description", "")
        )
        objectives.append(objective)
    
    return objectives


def LLM_suggest_variable_priorities(
    states: List[Dict], 
    inputs: List[Dict], 
    objectives: List[Objective],
    user_text: str,
    llm_client: Optional[HuggingFaceLLMClient] = None
) -> Dict[str, float]:
    """Suggest priority weights for variables."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/suggest_priorities.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        user_description=user_text,
        objectives=[{
            "type": obj.type.value,
            "target_variable": obj.target_variable,
            "weight": obj.weight
        } for obj in objectives],
        states=states,
        inputs=inputs
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "variable_priorities": {
                "type": "object",
                "patternProperties": {
                    ".*": {"type": "number"}
                }
            }
        },
        "required": ["variable_priorities"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    return result.get("variable_priorities", {})
