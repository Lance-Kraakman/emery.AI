"""
Demo script for MPC Skill Schema Builder.

This script demonstrates the complete skill generation pipeline
without requiring actual LLM API calls (uses mock responses).
"""

import json
from typing import Dict, Any


class MockLLMClient:
    """Mock LLM client for demonstration purposes."""
    
    def generate_structured_output(self, prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generate mock structured output."""
        
        # Mock responses based on prompt content
        if "states" in prompt.lower():
            return {
                "states": [
                    {
                        "name": "team_workload",
                        "type": "continuous",
                        "description": "Current workload of each team",
                        "bounds": {"min": 0.0, "max": 1.0}
                    },
                    {
                        "name": "queue_sizes",
                        "type": "discrete", 
                        "description": "Number of tasks waiting in queues",
                        "bounds": {"min": 0, "max": 100}
                    },
                    {
                        "name": "completion_rate",
                        "type": "continuous",
                        "description": "Rate at which tasks are completed",
                        "bounds": {"min": 0.0, "max": 10.0}
                    }
                ]
            }
        
        elif "inputs" in prompt.lower():
            return {
                "inputs": [
                    {
                        "name": "task_allocation",
                        "type": "discrete",
                        "description": "Number of tasks assigned to each team",
                        "bounds": {"min": 0, "max": 50}
                    },
                    {
                        "name": "priority_adjustment",
                        "type": "continuous",
                        "description": "Priority level adjustment for tasks",
                        "bounds": {"min": 0.1, "max": 5.0}
                    }
                ]
            }
        
        elif "outputs" in prompt.lower():
            return {
                "outputs": [
                    {
                        "name": "throughput",
                        "type": "continuous",
                        "description": "Number of tasks completed per time unit",
                        "unit": "tasks/hour"
                    },
                    {
                        "name": "average_delay",
                        "type": "continuous",
                        "description": "Average time delay for task completion",
                        "unit": "hours"
                    }
                ]
            }
        
        elif "disturbances" in prompt.lower():
            return {
                "disturbances": [
                    {
                        "name": "new_task_arrivals",
                        "type": "continuous",
                        "description": "Rate of new task arrivals",
                        "characteristics": {"nature": "random", "measurable": True}
                    }
                ]
            }
        
        elif "dynamics" in prompt.lower():
            return {
                "representation": "pseudo_python",
                "equations": [
                    "def system_dynamics(states, inputs, disturbances):",
                    "    \"\"\"System dynamics for multi-team task management.\"\"\"",
                    "    ",
                    "    # Extract variables",
                    "    workload = states['team_workload']",
                    "    queue_size = states['queue_sizes']",
                    "    completion_rate = states['completion_rate']",
                    "    task_allocation = inputs['task_allocation']",
                    "    priority_adjustment = inputs['priority_adjustment']",
                    "    new_tasks = disturbances['new_task_arrivals']",
                    "    ",
                    "    # Team workload dynamics",
                    "    d_workload = task_allocation - completion_rate",
                    "    ",
                    "    # Queue dynamics",
                    "    d_queue = new_tasks - task_allocation",
                    "    ",
                    "    # Completion rate dynamics (depends on workload and priority)",
                    "    d_completion = 0.5 * workload * priority_adjustment",
                    "    ",
                    "    return [d_workload, d_queue, d_completion]"
                ],
                "assumptions": [
                    "Linear relationship between workload and completion rate",
                    "Tasks can be freely allocated between teams",
                    "Priority adjustment affects completion efficiency"
                ],
                "parameters": {
                    "completion_efficiency": 0.5,
                    "max_team_capacity": 1.0
                }
            }
        
        elif "objectives" in prompt.lower():
            return {
                "objectives": [
                    {
                        "type": "minimize",
                        "target_variable": "average_delay",
                        "weight": 2.0,
                        "description": "Minimize average task completion delay"
                    },
                    {
                        "type": "balance",
                        "target_variable": "team_workload",
                        "weight": 1.5,
                        "description": "Balance workload across teams"
                    },
                    {
                        "type": "maximize",
                        "target_variable": "throughput",
                        "weight": 1.0,
                        "description": "Maximize overall task throughput"
                    }
                ]
            }
        
        elif "constraints" in prompt.lower():
            return {
                "constraints": [
                    {
                        "variable": "team_workload",
                        "constraint_type": "bounds",
                        "value": {"min": 0.0, "max": 0.9},
                        "description": "Team workload cannot exceed 90% capacity"
                    },
                    {
                        "variable": "task_allocation",
                        "constraint_type": "bounds",
                        "value": {"min": 0, "max": 50},
                        "description": "Cannot allocate more than 50 tasks at once"
                    }
                ]
            }
        
        elif "horizon" in prompt.lower():
            return {
                "horizon": "medium",
                "sample_time": 0.1,
                "prediction_steps": 30,
                "control_interval": 1
            }
        
        elif "priorities" in prompt.lower():
            return {
                "variable_priorities": {
                    "team_workload": 2.0,
                    "queue_sizes": 1.5,
                    "average_delay": 2.5,
                    "task_allocation": 1.0,
                    "priority_adjustment": 1.2
                }
            }
        
        # Default fallback
        return {}


def demo_skill_generation():
    """Demonstrate skill generation with mock LLM."""
    
    print("🚀 MPC Skill Schema Builder Demo")
    print("=" * 50)
    
    # Import the builder
    import sys
    import os
    sys.path.append(os.path.dirname(__file__))
    
    from builder.skill_builder import generate_skill_from_user_input
    
    # User description
    user_description = """
    Manage multiple tasks across three teams. Minimize delays and balance workload 
    while respecting task dependencies. Each team has different capacity and skills.
    Tasks have priorities and can be reallocated between teams.
    """
    
    template = "workflow"
    
    print(f"📝 Input: {user_description.strip()}")
    print(f"📋 Template: {template}")
    print()
    
    # Create mock LLM client
    mock_client = MockLLMClient()
    
    # Mock the LLM functions to use our mock client
    import llm.extractors
    import llm.generators
    import llm.mappers
    
    original_extract_states = llm.extractors.LLM_extract_states
    original_extract_inputs = llm.extractors.LLM_extract_inputs
    original_extract_outputs = llm.extractors.LLM_extract_outputs
    original_extract_disturbances = llm.extractors.LLM_extract_disturbances
    original_generate_dynamics = llm.generators.LLM_generate_dynamics
    original_map_objectives = llm.mappers.LLM_map_text_to_objectives
    original_suggest_constraints = llm.generators.LLM_suggest_constraints
    original_suggest_horizons = llm.generators.LLM_suggest_horizons
    original_suggest_priorities = llm.mappers.LLM_suggest_variable_priorities
    
    def mock_extract_states(user_text, template=None, llm_client=None):
        return mock_client.generate_structured_output("", {})["states"]
    
    def mock_extract_inputs(user_text, template=None, llm_client=None):
        return mock_client.generate_structured_output("", {})["inputs"]
    
    def mock_extract_outputs(user_text, template=None, llm_client=None):
        return mock_client.generate_structured_output("", {})["outputs"]
    
    def mock_extract_disturbances(user_text, template=None, llm_client=None):
        return mock_client.generate_structured_output("", {})["disturbances"]
    
    def mock_generate_dynamics(states, inputs, disturbances, archetype_mapping, user_text, llm_client=None):
        from core.schema import SystemDynamics
        result = mock_client.generate_structured_output("", {})
        return SystemDynamics(
            representation=result["representation"],
            equations=result["equations"],
            assumptions=result["assumptions"],
            parameters=result["parameters"]
        )
    
    def mock_map_objectives(user_text, template=None, states=None, inputs=None, outputs=None, llm_client=None):
        from core.schema import Objective
        from ..core.mpc_types import ObjectiveType
        result = mock_client.generate_structured_output("", {})
        objectives = []
        for obj_data in result["objectives"]:
            type_map = {
                "minimize": ObjectiveType.MINIMIZE,
                "maximize": ObjectiveType.MAXIMIZE,
                "track": ObjectiveType.TRACK,
                "balance": ObjectiveType.BALANCE,
                "stabilize": ObjectiveType.STABILIZE
            }
            objective = Objective(
                type=type_map.get(obj_data["type"], ObjectiveType.MINIMIZE),
                target_variable=obj_data["target_variable"],
                target_value=obj_data.get("target_value"),
                weight=obj_data["weight"],
                description=obj_data["description"]
            )
            objectives.append(objective)
        return objectives
    
    def mock_suggest_constraints(states, inputs, template=None, llm_client=None):
        from core.schema import Constraint
        result = mock_client.generate_structured_output("", {})
        constraints = []
        for constraint_data in result["constraints"]:
            constraint = Constraint(
                variable=constraint_data["variable"],
                constraint_type=constraint_data["constraint_type"],
                value=constraint_data["value"],
                description=constraint_data["description"]
            )
            constraints.append(constraint)
        return constraints
    
    def mock_suggest_horizons(user_text, template=None, llm_client=None):
        from ..core.mpc_types import PlanningConfig, PlanningHorizon
        result = mock_client.generate_structured_output("", {})
        horizon_map = {
            "short": PlanningHorizon.SHORT,
            "medium": PlanningHorizon.MEDIUM,
            "long": PlanningHorizon.LONG
        }
        return PlanningConfig(
            horizon=horizon_map.get(result["horizon"], PlanningHorizon.MEDIUM),
            sample_time=result["sample_time"],
            prediction_steps=result["prediction_steps"],
            control_interval=result["control_interval"]
        )
    
    def mock_suggest_priorities(states, inputs, objectives, user_text, llm_client=None):
        return mock_client.generate_structured_output("", {})["variable_priorities"]
    
    # Replace functions with mocks
    llm.extractors.LLM_extract_states = mock_extract_states
    llm.extractors.LLM_extract_inputs = mock_extract_inputs
    llm.extractors.LLM_extract_outputs = mock_extract_outputs
    llm.extractors.LLM_extract_disturbances = mock_extract_disturbances
    llm.generators.LLM_generate_dynamics = mock_generate_dynamics
    llm.mappers.LLM_map_text_to_objectives = mock_map_objectives
    llm.generators.LLM_suggest_constraints = mock_suggest_constraints
    llm.generators.LLM_suggest_horizons = mock_suggest_horizons
    llm.mappers.LLM_suggest_variable_priorities = mock_suggest_priorities
    
    try:
        # Generate skill schema
        schema = generate_skill_from_user_input(
            user_text=user_description,
            template=template,
            interactive=False
        )
        
        # Display results
        print("\n" + "="*60)
        print("GENERATED MPC SKILL SCHEMA")
        print("="*60)
        
        print(f"\n📋 System: {schema['system_description']}")
        
        print(f"\n📊 States ({len(schema['states'])}):")
        for state in schema['states']:
            print(f"  • {state['name']} ({state['type']}): {state['description']}")
            if state.get('bounds'):
                print(f"    Bounds: {state['bounds']}")
        
        print(f"\n🎛️  Inputs ({len(schema['inputs'])}):")
        for inp in schema['inputs']:
            print(f"  • {inp['name']} ({inp['type']}): {inp['description']}")
            if inp.get('bounds'):
                print(f"    Bounds: {inp['bounds']}")
        
        print(f"\n📈 Outputs ({len(schema['outputs'])}):")
        for output in schema['outputs']:
            print(f"  • {output['name']} ({output['type']}): {output['description']}")
            if output.get('unit'):
                print(f"    Unit: {output['unit']}")
        
        print(f"\n🎯 Objectives ({len(schema['objectives'])}):")
        for obj in schema['objectives']:
            print(f"  • {obj['type']} {obj['target_variable']} (weight: {obj['weight']})")
            if obj.get('target_value'):
                print(f"    Target: {obj['target_value']}")
            print(f"    Description: {obj['description']}")
        
        print(f"\n🔧 Constraints ({len(schema['constraints'])}):")
        for constraint in schema['constraints']:
            print(f"  • {constraint['variable']} ({constraint['constraint_type']}): {constraint['value']}")
            print(f"    Description: {constraint['description']}")
        
        print(f"\n⚙️  Planning:")
        planning = schema['planning']
        print(f"  • Horizon: {planning['horizon']}")
        print(f"  • Sample time: {planning['sample_time']}")
        print(f"  • Prediction steps: {planning['prediction_steps']}")
        
        print(f"\n🧮 System Dynamics:")
        dynamics = schema['dynamics']
        print(f"  • Representation: {dynamics['representation']}")
        print("  • Equations:")
        for i, eq in enumerate(dynamics['equations'][:3], 1):  # Show first 3
            print(f"    {i}. {eq}")
        if len(dynamics['equations']) > 3:
            print(f"    ... and {len(dynamics['equations']) - 3} more")
        
        if schema.get('external_factors'):
            print(f"\n🌪️  External Factors ({len(schema['external_factors'])}):")
            for factor in schema['external_factors']:
                print(f"  • {factor['name']} ({factor['type']}): {factor['description']}")
        
        print(f"\n⚖️  Variable Priorities:")
        for var, priority in schema['variable_priorities'].items():
            print(f"  • {var}: {priority}")
        
        print(f"\n📊 Metadata:")
        print(f"  • Template: {schema.get('template', 'None')}")
        print(f"  • Confidence: {schema.get('confidence_score', 0.0)}")
        print(f"  • Extraction method: {schema.get('extraction_method', 'unknown')}")
        
        # Save to file
        with open('/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/mpc_skill_schema/demo_output.json', 'w') as f:
            json.dump(schema, f, indent=2)
        
        print(f"\n💾 Schema saved to: demo_output.json")
        
    finally:
        # Restore original functions
        llm.extractors.LLM_extract_states = original_extract_states
        llm.extractors.LLM_extract_inputs = original_extract_inputs
        llm.extractors.LLM_extract_outputs = original_extract_outputs
        llm.extractors.LLM_extract_disturbances = original_extract_disturbances
        llm.generators.LLM_generate_dynamics = original_generate_dynamics
        llm.mappers.LLM_map_text_to_objectives = original_map_objectives
        llm.generators.LLM_suggest_constraints = original_suggest_constraints
        llm.generators.LLM_suggest_horizons = original_suggest_horizons
        llm.mappers.LLM_suggest_variable_priorities = original_suggest_priorities


if __name__ == "__main__":
    demo_skill_generation()
