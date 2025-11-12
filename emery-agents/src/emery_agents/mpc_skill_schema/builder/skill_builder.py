"""
Main MPC Skill Schema Builder implementation.

This module implements the main generate_skill_from_user_input function
that orchestrates the entire skill generation pipeline.
"""

from typing import Optional, Dict, Any, List
from ..core.schema import (
    SkillSchema, StateVariable, ControlVariable, OutputVariable, 
    ExternalFactor, Objective, Constraint
)
from ..core.mpc_types import VariableType, PlanningConfig
from ..llm import (
    HuggingFaceLLMClient,
    LLM_extract_states,
    LLM_extract_inputs,
    LLM_extract_outputs,
    LLM_extract_disturbances,
    LLM_generate_dynamics,
    LLM_map_text_to_objectives,
    LLM_suggest_constraints,
    LLM_suggest_horizons,
    LLM_suggest_variable_priorities
)
from ..embeddings import embeddings_suggest_archetypes
from ..builder.user_interface import UserConfirmationInterface


def generate_skill_from_user_input(
    user_text: str, 
    interactive: bool = True,
    llm_client: Optional[HuggingFaceLLMClient] = None
) -> Dict[str, Any]:
    """
    Generate a SkillSchema from a user description.
    
    Args:
        user_text: Natural language system description.
        interactive: Whether to prompt for user confirmation.
        llm_client: Optional LLM client instance.
        
    Returns:
        skill_schema: Fully populated SkillSchema JSON.
    """
    
    # Initialize LLM client if not provided
    if llm_client is None:
        llm_client = HuggingFaceLLMClient()
    
    # Initialize user interface
    ui = UserConfirmationInterface(interactive=interactive)
    
    print("🔧 Starting MPC Skill Schema Generation...")
    print(f"📝 Input: {user_text}")
    
    # =======================================================
    # 1) Initial Parsing & Variable Suggestion
    # =======================================================
    print("\n🧠 Extracting system components...")
    
    # Extract components using LLM
    candidate_states = LLM_extract_states(user_text, llm_client=llm_client)
    candidate_inputs = LLM_extract_inputs(user_text, llm_client=llm_client)
    candidate_outputs = LLM_extract_outputs(user_text, llm_client=llm_client)
    candidate_disturbances = LLM_extract_disturbances(user_text, llm_client=llm_client)
    
    print(f"✅ Found {len(candidate_states)} states, {len(candidate_inputs)} inputs, "
          f"{len(candidate_outputs)} outputs, {len(candidate_disturbances)} disturbances")
    
    # Embeddings used to map terms to known archetypes
    print("\n🎯 Mapping terms to archetypes...")
    all_terms = []
    for var_list in [candidate_states, candidate_inputs]:
        all_terms.extend([var['name'] for var in var_list])
    
    archetype_mapping = embeddings_suggest_archetypes(all_terms)
    print(f"✅ Mapped {len(archetype_mapping)} terms to archetypes")
    
    # LLM generates suggested dynamics function (pseudo or Python)
    print("\n⚙️ Generating system dynamics...")
    dynamics_func = LLM_generate_dynamics(
        candidate_states, candidate_inputs, candidate_disturbances, 
        archetype_mapping, user_text, llm_client
    )
    print(f"✅ Generated {len(dynamics_func.equations)} dynamics equations")
    
    # =======================================================
    # 2) Goal / Objective Mapping
    # =======================================================
    print("\n🎯 Mapping objectives...")
    objectives = LLM_map_text_to_objectives(
        user_text, states=candidate_states, inputs=candidate_inputs, outputs=candidate_outputs, llm_client=llm_client
    )
    print(f"✅ Extracted {len(objectives)} objectives")
    
    # =======================================================
    # 3) Default Constraints & Planning
    # =======================================================
    print("\n🔧 Suggesting constraints and planning...")
    constraints = LLM_suggest_constraints(candidate_states, candidate_inputs, llm_client=llm_client)
    planning = LLM_suggest_horizons(user_text, llm_client=llm_client)
    print(f"✅ Suggested {len(constraints)} constraints")
    print(f"✅ Suggested {planning.horizon.value} planning horizon")
    
    # =======================================================
    # 4) Variable Priorities
    # =======================================================
    print("\n⚖️ Suggesting variable priorities...")
    variable_priorities = LLM_suggest_variable_priorities(
        candidate_states, candidate_inputs, objectives, user_text, llm_client
    )
    print(f"✅ Set priorities for {len(variable_priorities)} variables")
    
    # =======================================================
    # 5) User Confirmation / Manual Editing
    # =======================================================
    if interactive:
        print("\n👤 User confirmation phase...")
        
        confirmed_states = ui.confirm_variables(candidate_states, "states")
        confirmed_inputs = ui.confirm_variables(candidate_inputs, "inputs")
        confirmed_outputs = ui.confirm_variables(candidate_outputs, "outputs")
        confirmed_disturbances = ui.confirm_variables(candidate_disturbances, "disturbances")
        confirmed_constraints = ui.confirm_constraints(constraints)
        confirmed_objectives = ui.confirm_objectives(objectives)
        confirmed_dynamics = ui.edit_dynamics(dynamics_func)
        
        print("✅ User confirmation completed")
    else:
        # Auto-accept all suggestions
        confirmed_states = candidate_states
        confirmed_inputs = candidate_inputs
        confirmed_outputs = candidate_outputs
        confirmed_disturbances = candidate_disturbances
        confirmed_constraints = constraints
        confirmed_objectives = objectives
        confirmed_dynamics = dynamics_func
        print("✅ Auto-accepted all suggestions")
    
    # =======================================================
    # 6) Assemble SkillSchema
    # =======================================================
    print("\n🏗️ Assembling final SkillSchema...")
    
    # Convert to proper schema objects
    state_vars = [
        StateVariable(
            name=s['name'],
            var_type=VariableType(s['type']),
            bounds=s.get('bounds'),
            unit=s.get('unit'),
            description=s['description']
        ) for s in confirmed_states
    ]
    
    control_vars = [
        ControlVariable(
            name=i['name'],
            var_type=VariableType(i['type']),
            bounds=i.get('bounds'),
            unit=i.get('unit'),
            description=i['description']
        ) for i in confirmed_inputs
    ]
    
    output_vars = [
        OutputVariable(
            name=o['name'],
            var_type=VariableType(o['type']),
            unit=o.get('unit'),
            description=o['description']
        ) for o in confirmed_outputs
    ]
    
    external_factors = [
        ExternalFactor(
            name=d['name'],
            var_type=VariableType(d['type']),
            description=d['description'],
            characteristics=d.get('characteristics')
        ) for d in confirmed_disturbances
    ]
    
    # Create final schema
    skill_schema = SkillSchema(
        system_description=user_text,
        states=state_vars,
        inputs=control_vars,
        outputs=output_vars,
        dynamics=confirmed_dynamics,
        objectives=confirmed_objectives,
        constraints=confirmed_constraints,
        planning=planning,
        external_factors=external_factors,
        variable_priorities=variable_priorities,

        confidence_score=0.8,  # Could be calculated based on LLM confidence
        extraction_method="llm",
        user_edits=[]  # Could track user edits
    )
    
    print("✅ SkillSchema assembly completed!")
    
    # Return as dictionary
    return skill_schema.to_dict()


def generate_skill_from_user_input_simple(
    user_text: str
) -> Dict[str, Any]:
    """
    Simplified wrapper for non-interactive skill generation.
    
    Args:
        user_text: Natural language system description.
        
    Returns:
        skill_schema: Fully populated SkillSchema JSON.
    """
    return generate_skill_from_user_input(
        user_text=user_text,
        interactive=False
    )
