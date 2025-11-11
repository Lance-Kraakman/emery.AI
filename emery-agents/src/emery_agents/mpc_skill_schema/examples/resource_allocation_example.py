"""
Resource allocation skill example for MPC Skill Schema Builder.

Example: "Allocate compute resources to maximize throughput"
"""

from ..builder.skill_builder import generate_skill_from_user_input_simple


def resource_allocation_example():
    """Generate resource allocation skill schema example."""
    
    user_description = """
    Allocate compute resources across multiple services to maximize throughput.
    Services have different resource requirements and priorities.
    Consider CPU, memory, and network bandwidth constraints.
    Handle variable workload patterns and service dependencies.
    Minimize response time while maximizing overall system throughput.
    Scale resources dynamically based on demand.
    """
    
    template = "robotics"  # Using robotics as it's closest to control systems
    
    print("🚀 Generating Resource Allocation Skill Schema...")
    print(f"📝 Description: {user_description.strip()}")
    print(f"📋 Template: {template}")
    
    # Generate skill schema
    schema = generate_skill_from_user_input_simple(user_description, template)
    
    # Display results
    print("\n" + "="*60)
    print("GENERATED RESOURCE ALLOCATION SKILL SCHEMA")
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
    for i, eq in enumerate(dynamics['equations'][:5], 1):  # Show first 5
        print(f"    {i}. {eq}")
    if len(dynamics['equations']) > 5:
        print(f"    ... and {len(dynamics['equations']) - 5} more")
    
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
    
    return schema


if __name__ == "__main__":
    resource_allocation_example()
