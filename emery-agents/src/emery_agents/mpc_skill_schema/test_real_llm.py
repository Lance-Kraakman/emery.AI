"""
Real LLM test for MPC Skill Schema Builder.
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from llm.client import HuggingFaceLLMClient
from llm.extractors import LLM_extract_states, LLM_extract_inputs, LLM_extract_outputs
from embeddings.archetype_mapper import embeddings_suggest_archetypes


def test_real_llm_extraction():
    """Test real LLM extraction with HF token."""
    
    print("🚀 Testing Real LLM Extraction")
    print("=" * 50)
    
    # Initialize LLM client
    llm_client = HuggingFaceLLMClient(
        model_id="microsoft/DialoGPT-medium"  # Using a free model
    )
    
    user_description = """
    Manage multiple tasks across three teams. Minimize delays and balance workload 
    while respecting task dependencies. Each team has different capacity and skills.
    Tasks have priorities and can be reallocated between teams.
    """
    
    template = "workflow"
    
    print(f"📝 Description: {user_description.strip()}")
    print(f"📋 Template: {template}")
    print()
    
    try:
        # Test states extraction
        print("🧠 Extracting states...")
        states = LLM_extract_states(user_description, template, llm_client)
        print(f"✅ Found {len(states)} states:")
        for state in states:
            print(f"  • {state['name']} ({state['type']}): {state['description']}")
        print()
        
        # Test inputs extraction
        print("🎛️ Extracting inputs...")
        inputs = LLM_extract_inputs(user_description, template, llm_client)
        print(f"✅ Found {len(inputs)} inputs:")
        for inp in inputs:
            print(f"  • {inp['name']} ({inp['type']}): {inp['description']}")
        print()
        
        # Test outputs extraction
        print("📈 Extracting outputs...")
        outputs = LLM_extract_outputs(user_description, template, llm_client)
        print(f"✅ Found {len(outputs)} outputs:")
        for output in outputs:
            print(f"  • {output['name']} ({output['type']}): {output['description']}")
        print()
        
        # Test archetype mapping
        print("🎯 Testing archetype mapping...")
        all_terms = []
        for var_list in [states, inputs]:
            all_terms.extend([var['name'] for var in var_list])
        
        archetype_mapping = embeddings_suggest_archetypes(all_terms)
        print(f"✅ Mapped {len(archetype_mapping)} terms:")
        for term, mapping in archetype_mapping.items():
            print(f"  • {term} → {mapping['suggested_archetype']['name']} "
                  f"(similarity: {mapping['similarity']:.2f})")
        print()
        
        print("🎉 Real LLM test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error during LLM test: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_simple_llm_client():
    """Test basic LLM client functionality."""
    
    print("🔧 Testing Basic LLM Client")
    print("=" * 30)
    
    try:
        llm_client = HuggingFaceLLMClient(
            model_id="microsoft/DialoGPT-medium"
        )
        
        # Test simple text generation
        print("📝 Testing text generation...")
        response = llm_client.generate_text(
            "What is Model Predictive Control?",
            temperature=0.7,
            max_tokens=100
        )
        print(f"✅ Response: {response[:100]}...")
        print()
        
        # Test structured output
        print("🏗️ Testing structured output...")
        prompt = "List 3 variables for a control system"
        schema = {
            "type": "object",
            "properties": {
                "variables": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            }
        }
        
        result = llm_client.generate_structured_output(prompt, schema)
        print(f"✅ Structured result: {result}")
        print()
        
        print("🎉 Basic LLM client test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Error in basic LLM test: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🧪 MPC Skill Schema Builder - Real LLM Test")
    print("=" * 60)
    
    # Test basic client first
    basic_success = test_simple_llm_client()
    
    if basic_success:
        print()
        # Test full extraction pipeline
        extraction_success = test_real_llm_extraction()
        
        if extraction_success:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ LLM integration is working correctly")
        else:
            print("\n⚠️ Extraction test failed")
    else:
        print("\n⚠️ Basic LLM client test failed")
