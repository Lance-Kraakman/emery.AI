"""
Simple test of MPC Skill Schema Builder from emery-agents root.
"""

import sys
import os

# Add the path to mpc_skill_schema
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'emery_agents'))

def test_basic_imports():
    """Test basic imports work."""
    try:
        from mpc_skill_schema.core.schema import SkillSchema, StateVariable
        from mpc_skill_schema.core.types import VariableType, ObjectiveType
        from mpc_skill_schema.core.archetypes import ArchetypeMapper
        print("✅ Core imports work!")
        
        # Test basic schema creation
        state = StateVariable(
            name="test_state",
            var_type=VariableType.CONTINUOUS,
            description="Test state variable"
        )
        print(f"✅ Created state: {state.name} ({state.var_type.value})")
        
        return True
        
    except Exception as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_archetype_mapping():
    """Test archetype mapping."""
    try:
        from mpc_skill_schema.core.archetypes import ArchetypeMapper
        
        mapper = ArchetypeMapper()
        
        # Test mapping
        result = mapper.map_term_to_archetype("queue", "states")
        print(f"✅ Mapped 'queue' to: {result['name']}")
        
        result = mapper.map_term_to_archetype("allocate", "inputs")
        print(f"✅ Mapped 'allocate' to: {result['name']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Archetype mapping error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_simple_demo():
    """Test the simple demo that doesn't require LLM."""
    try:
        # Run the simple demo
        demo_path = os.path.join(os.path.dirname(__file__), 'src', 'emery_agents', 'mpc_skill_schema', 'simple_demo.py')
        
        # Read and execute demo code
        with open(demo_path, 'r') as f:
            demo_code = f.read()
        
        # Create a namespace for execution
        demo_namespace = {}
        exec(demo_code, demo_namespace)
        
        # Run the demo function
        if 'demo_skill_schema_output' in demo_namespace:
            demo_namespace['demo_skill_schema_output']()
            print("✅ Simple demo executed successfully!")
            return True
        else:
            print("❌ Demo function not found")
            return False
            
    except Exception as e:
        print(f"❌ Demo execution error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🧪 MPC Skill Schema Builder - Simple Tests")
    print("=" * 60)
    
    # Test 1: Basic imports
    print("\n1. Testing basic imports...")
    import_success = test_basic_imports()
    
    # Test 2: Archetype mapping
    print("\n2. Testing archetype mapping...")
    archetype_success = test_archetype_mapping()
    
    # Test 3: Simple demo
    print("\n3. Testing simple demo...")
    demo_success = test_simple_demo()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Imports: {'PASS' if import_success else 'FAIL'}")
    print(f"✅ Archetype Mapping: {'PASS' if archetype_success else 'FAIL'}")
    print(f"✅ Simple Demo: {'PASS' if demo_success else 'FAIL'}")
    
    if import_success and archetype_success and demo_success:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ MPC Skill Schema Builder is working correctly!")
    else:
        print("\n⚠️ Some tests failed - check output above")
