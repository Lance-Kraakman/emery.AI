"""
Simple demo of MPC Skill Schema Builder output.
"""

import json


def demo_skill_schema_output():
    """Demonstrate the expected output format."""
    
    # Example generated skill schema
    skill_schema = {
        "system_description": "Manage multiple tasks across three teams. Minimize delays and balance workload while respecting task dependencies.",
        
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
        ],
        
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
        ],
        
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
        ],
        
        "dynamics": {
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
        },
        
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
        ],
        
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
        ],
        
        "planning": {
            "horizon": "medium",
            "sample_time": 0.1,
            "prediction_steps": 30,
            "control_interval": 1
        },
        
        "external_factors": [
            {
                "name": "new_task_arrivals",
                "type": "continuous",
                "description": "Rate of new task arrivals",
                "characteristics": {"nature": "random", "measurable": True}
            }
        ],
        
        "variable_priorities": {
            "team_workload": 2.0,
            "queue_sizes": 1.5,
            "average_delay": 2.5,
            "task_allocation": 1.0,
            "priority_adjustment": 1.2
        },
        
        "template": "workflow",
        "confidence_score": 0.8,
        "extraction_method": "llm",
        "user_edits": []
    }
    
    print("🚀 MPC Skill Schema Builder - Example Output")
    print("=" * 60)
    
    print(f"\n📋 System: {skill_schema['system_description']}")
    
    print(f"\n📊 States ({len(skill_schema['states'])}):")
    for state in skill_schema['states']:
        print(f"  • {state['name']} ({state['type']}): {state['description']}")
        if state.get('bounds'):
            print(f"    Bounds: {state['bounds']}")
    
    print(f"\n🎛️  Inputs ({len(skill_schema['inputs'])}):")
    for inp in skill_schema['inputs']:
        print(f"  • {inp['name']} ({inp['type']}): {inp['description']}")
        if inp.get('bounds'):
            print(f"    Bounds: {inp['bounds']}")
    
    print(f"\n📈 Outputs ({len(skill_schema['outputs'])}):")
    for output in skill_schema['outputs']:
        print(f"  • {output['name']} ({output['type']}): {output['description']}")
        if output.get('unit'):
            print(f"    Unit: {output['unit']}")
    
    print(f"\n🎯 Objectives ({len(skill_schema['objectives'])}):")
    for obj in skill_schema['objectives']:
        print(f"  • {obj['type']} {obj['target_variable']} (weight: {obj['weight']})")
        if obj.get('target_value'):
            print(f"    Target: {obj['target_value']}")
        print(f"    Description: {obj['description']}")
    
    print(f"\n🔧 Constraints ({len(skill_schema['constraints'])}):")
    for constraint in skill_schema['constraints']:
        print(f"  • {constraint['variable']} ({constraint['constraint_type']}): {constraint['value']}")
        print(f"    Description: {constraint['description']}")
    
    print(f"\n⚙️  Planning:")
    planning = skill_schema['planning']
    print(f"  • Horizon: {planning['horizon']}")
    print(f"  • Sample time: {planning['sample_time']}")
    print(f"  • Prediction steps: {planning['prediction_steps']}")
    
    print(f"\n🧮 System Dynamics:")
    dynamics = skill_schema['dynamics']
    print(f"  • Representation: {dynamics['representation']}")
    print("  • Equations:")
    for i, eq in enumerate(dynamics['equations'][:3], 1):  # Show first 3
        print(f"    {i}. {eq}")
    if len(dynamics['equations']) > 3:
        print(f"    ... and {len(dynamics['equations']) - 3} more")
    
    print(f"\n🌪️  External Factors ({len(skill_schema['external_factors'])}):")
    for factor in skill_schema['external_factors']:
        print(f"  • {factor['name']} ({factor['type']}): {factor['description']}")
    
    print(f"\n⚖️  Variable Priorities:")
    for var, priority in skill_schema['variable_priorities'].items():
        print(f"  • {var}: {priority}")
    
    print(f"\n📊 Metadata:")
    print(f"  • Template: {skill_schema.get('template', 'None')}")
    print(f"  • Confidence: {skill_schema.get('confidence_score', 0.0)}")
    print(f"  • Extraction method: {skill_schema.get('extraction_method', 'unknown')}")
    
    # Save to file
    with open('example_skill_schema.json', 'w') as f:
        json.dump(skill_schema, f, indent=2)
    
    print(f"\n💾 Example schema saved to: example_skill_schema.json")
    
    return skill_schema


if __name__ == "__main__":
    demo_skill_schema_output()
