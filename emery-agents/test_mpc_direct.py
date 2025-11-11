"""
Direct test of MPC Skill Schema Builder avoiding import conflicts.
"""

import sys
import os

# Add the specific path to avoid conflicts
mpc_path = os.path.join(os.path.dirname(__file__), 'src', 'emery_agents', 'mpc_skill_schema')
sys.path.insert(0, mpc_path)

def test_direct_imports():
    """Test imports directly from mpc_skill_schema."""
    try:
        # Import core components directly
        from core.schema import SkillSchema, StateVariable, ControlVariable
        from core.mpc_types import VariableType, ObjectiveType, PlanningHorizon
        from core.archetypes import ArchetypeMapper
        
        print("✅ Direct imports successful!")
        
        # Test creating a state variable
        state = StateVariable(
            name="test_workload",
            var_type=VariableType.CONTINUOUS,
            description="Test workload variable"
        )
        print(f"✅ Created state: {state.name} ({state.var_type.value})")
        
        # Test archetype mapper
        mapper = ArchetypeMapper()
        result = mapper.map_term_to_archetype("queue", "states")
        print(f"✅ Mapped 'queue' to: {result['name']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Direct import error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_simple_demo_direct():
    """Test simple demo directly."""
    try:
        # Import and run simple demo
        from simple_demo import demo_skill_schema_output
        
        print("✅ Running simple demo...")
        schema = demo_skill_schema_output()
        
        print(f"✅ Demo generated schema with {len(schema['states'])} states")
        return True
        
    except Exception as e:
        print(f"❌ Demo error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_llm_client_direct():
    """Test LLM client directly."""
    try:
        # Set HF token
        os.environ['HF_TOKEN'] = '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'
        
        from llm.client import HuggingFaceLLMClient
        
        print("✅ Creating LLM client...")
        client = HuggingFaceLLMClient(
            model_id="microsoft/DialoGPT-medium"
        )
        
        # Test simple text generation
        print("📝 Testing text generation...")
        response = client.generate_text(
            "What is Model Predictive Control? Answer in one sentence.",
            temperature=0.7,
            max_tokens=50
        )
        print(f"✅ LLM Response: {response}")
        
        return True
        
    except Exception as e:
        print(f"❌ LLM client error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🧪 MPC Skill Schema Builder - Direct Tests")
    print("=" * 60)
    
    # Test 1: Direct imports
    print("\n1. Testing direct imports...")
    import_success = test_direct_imports()
    
    # Test 2: Simple demo
    print("\n2. Testing simple demo...")
    demo_success = test_simple_demo_direct()
    
    # Test 3: LLM client
    print("\n3. Testing LLM client...")
    llm_success = test_llm_client_direct()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Direct Imports: {'PASS' if import_success else 'FAIL'}")
    print(f"✅ Simple Demo: {'PASS' if demo_success else 'FAIL'}")
    print(f"✅ LLM Client: {'PASS' if llm_success else 'FAIL'}")
    
    if import_success and demo_success and llm_success:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ MPC Skill Schema Builder is working correctly!")
        print("✅ Ready to generate real skill schemas with LLM!")
    else:
        print("\n⚠️ Some tests failed - check output above")
