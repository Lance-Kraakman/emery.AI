#!/usr/bin/env python3
"""
Test script to verify Hugging Face integration works with emery-agents.
Now simplified to use HF models exclusively.

Usage:
    export HF_TOKEN=hf_your_token_here
    uv run test_hf_integration.py
"""

import os
import asyncio
from emery_agents.integrations.smolagents import SmolAgentsIntegration
from emery_agents.core.types import StepType

async def test_hf_integration():
    """Test that HF integration works correctly."""
    print("🧪 Testing HuggingFace Integration with Qwen Models...\n")
    
    hf_token = os.getenv('HF_TOKEN')
    print(f"HF_TOKEN present: {'✅' if hf_token else '❌'}")
    
    if not hf_token:
        print("❌ HF_TOKEN is required. Get your token from https://huggingface.co/settings/tokens")
        return False
    
    integration = SmolAgentsIntegration()
    
    try:
        # Test CODE_STEP with default Qwen model
        print("Testing CODE_STEP agent creation (default: Qwen/Qwen2.5-Coder-32B-Instruct)...")
        code_agent = integration._get_agent(StepType.CODE_STEP)
        print("✅ CODE_STEP agent created successfully")
        
        # Test TOOL_STEP with default model
        print("Testing TOOL_STEP agent creation...")
        tool_agent = integration._get_agent(StepType.TOOL_STEP)
        print("✅ TOOL_STEP agent created successfully")
        
        # Test with explicit Qwen models
        print("Testing with explicit Qwen models...")
        fast_agent = integration._get_agent(StepType.CODE_STEP, "Qwen/Qwen2.5-Coder-7B-Instruct")
        print("✅ Fast Qwen agent created successfully")
        
        general_agent = integration._get_agent(StepType.TOOL_STEP, "Qwen/Qwen2.5-72B-Instruct")
        print("✅ General Qwen agent created successfully")
        
        print("\n🎉 All tests passed! HuggingFace integration is working correctly.")
        print("🤖 Available models:")
        print("   • Qwen/Qwen2.5-Coder-32B-Instruct (default for code)")
        print("   • Qwen/Qwen2.5-72B-Instruct (best for reasoning)")
        print("   • Qwen/Qwen2.5-Coder-7B-Instruct (fastest)")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_hf_integration())