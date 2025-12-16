#!/usr/bin/env python3
"""
Simple test script for the new MPC Skill Builder.
"""

import os
import sys

# Add the parent directory to Python path for imports
sys.path.insert(0, '/Users/lancekraakman/orchastrate/emery-agents/src')

try:
    from emery_agents.mpc_skill_builder import MPCSkillBuilder, generate_skill_schema
    print("✅ Successfully imported MPCSkillBuilder")
    
    # Test basic functionality
    description = "Manage tasks across 3 teams with minimal delay and balanced workload."
    
    print(f"\n🔧 Testing with description: {description}")
    
    # Test the convenience function
    try:
        schema = generate_skill_schema(description)
        print("✅ Successfully generated skill schema using convenience function")
        print(f"📊 Generated {len(schema.states)} states, {len(schema.inputs)} inputs, {len(schema.outputs)} outputs")
        print(f"🎯 Generated {len(schema.objectives)} objectives")
        print(f"⚙️ Generated {len(schema.dynamics.equations)} dynamics equations")
        
        # Print some details
        if schema.states:
            print(f"\n📈 States:")
            for state in schema.states[:3]:  # Show first 3
                print(f"  - {state.name} ({state.var_type.value}): {state.description}")
        
        if schema.objectives:
            print(f"\n🎯 Objectives:")
            for obj in schema.objectives[:3]:  # Show first 3
                print(f"  - {obj.type.value} {obj.target_variable}: {obj.description}")
        
        print("\n✅ Test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error generating schema: {e}")
        import traceback
        traceback.print_exc()

except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure all files are created correctly")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()