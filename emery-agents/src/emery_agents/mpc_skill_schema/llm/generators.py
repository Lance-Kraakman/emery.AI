"""
LLM-based generation functions for MPC components.
"""

import json
from typing import List, Dict, Optional
from jinja2 import Template
from .client import HuggingFaceLLMClient
from ..core.schema import SystemDynamics
from ..core.mpc_types import PlanningConfig, PlanningHorizon


def LLM_generate_dynamics(
    states: List[Dict],
    inputs: List[Dict], 
    disturbances: List[Dict],
    archetype_mapping: Dict,
    user_text: str,
    llm_client: Optional[HuggingFaceLLMClient] = None
) -> SystemDynamics:
    """Generate system dynamics from components."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/generate_dynamics.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        user_description=user_text,
        states=states,
        inputs=inputs,
        disturbances=disturbances,
        archetype_mappings=archetype_mapping,
        system_name="MPC System"
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "representation": {"type": "string"},
            "equations": {
                "type": "array",
                "items": {"type": "string"}
            },
            "assumptions": {
                "type": "array",
                "items": {"type": "string"}
            },
            "parameters": {
                "type": "object"
            }
        },
        "required": ["representation", "equations"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    
    return SystemDynamics(
        representation=result.get("representation", "pseudo_python"),
        equations=result.get("equations", []),
        assumptions=result.get("assumptions", []),
        parameters=result.get("parameters", {})
    )


def LLM_suggest_constraints(
    states: List[Dict], 
    inputs: List[Dict], 
    template: Optional[str] = None,
    llm_client: Optional[HuggingFaceLLMClient] = None
) -> List[Dict]:
    """Suggest constraints based on system variables."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/suggest_constraints.j2', 'r') as f:
        template_str = f.read()
    
    prompt_template = Template(template_str)
    prompt = prompt_template.render(
        states=states,
        inputs=inputs,
        template=template
    )
    
    # Define output schema
    output_schema = {
        "type": "object",
        "properties": {
            "constraints": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "variable": {"type": "string"},
                        "constraint_type": {"type": "string"},
                        "value": {},
                        "description": {"type": "string"}
                    },
                    "required": ["variable", "constraint_type", "value", "description"]
                }
            }
        },
        "required": ["constraints"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    return result.get("constraints", [])


def LLM_suggest_horizons(
    user_text: str, 
    template: Optional[str] = None,
    llm_client: Optional[HuggingFaceLLMClient] = None
) -> PlanningConfig:
    """Suggest appropriate planning horizon based on system description."""
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Load prompt template
    with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/prompts/suggest_horizons.j2', 'r') as f:
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
            "horizon": {"type": "string"},
            "sample_time": {"type": "number"},
            "prediction_steps": {"type": "integer"},
            "control_interval": {"type": "integer"}
        },
        "required": ["horizon", "sample_time"]
    }
    
    # Generate structured output
    result = llm_client.generate_structured_output(prompt, output_schema)
    
    # Convert to PlanningConfig
    horizon_map = {
        "short": PlanningHorizon.SHORT,
        "medium": PlanningHorizon.MEDIUM,
        "long": PlanningHorizon.LONG
    }
    
    return PlanningConfig(
        horizon=horizon_map.get(result.get("horizon", "medium"), PlanningHorizon.MEDIUM),
        sample_time=result.get("sample_time", 0.1),
        prediction_steps=result.get("prediction_steps"),
        control_interval=result.get("control_interval", 1)
    )
