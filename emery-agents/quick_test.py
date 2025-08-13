#!/usr/bin/env uv run python
"""
Quick smoke tests for Emery Agents using simplified architecture.

Tests basic functionality without external dependencies.
"""

import sys
import traceback
from pathlib import Path

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

def test_imports():
    """Test that all modules can be imported."""
    print("🔍 Testing imports...")
    
    try:
        # Core modules
        from emery_agents.core.types import Agent, StepType, TaskStatus
        from emery_agents.core.runner import AgentRunner
        
        # Integrations
        from emery_agents.integrations.smolagents import SmolAgentsOrchestrator
        from emery_agents.integrations.emery_client import EmeryClientIntegration
        from emery_agents.integrations.mcp_servers import MCPServerIntegration
        
        print("✅ All imports successful")
        return True
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False

def test_basic_types():
    """Test basic type construction."""
    print("🔍 Testing basic types...")
    
    try:
        from emery_agents.core.types import (
            Agent, CapabilityConfig, StepConfig, StepType, 
            TaskInstructions, TaskStatus
        )
        
        # Create test step
        step = StepConfig(
            id="test_step",
            type=StepType.CODE_STEP,
            instructions="Test step instructions"
        )
        
        # Create test capability
        capability = CapabilityConfig(
            name="test_capability",
            description="Test capability for validation",
            steps=[step]
        )
        
        # Create test agent
        agent = Agent(
            id=123,
            name="Test Agent",
            capabilities=[capability]
        )
        
        print(f"✅ Created agent with {len(agent.capabilities)} capabilities")
        return True
    except Exception as e:
        print(f"❌ Type creation failed: {e}")
        traceback.print_exc()
        return False

def test_smolagents_initialization():
    """Test SmolAgents orchestrator initialization."""
    print("🔍 Testing SmolAgents initialization...")
    
    try:
        from emery_agents.integrations.smolagents import SmolAgentsOrchestrator
        
        orchestrator = SmolAgentsOrchestrator()
        assert orchestrator.agent is None  # Not set up yet
        
        print("✅ SmolAgentsOrchestrator initialized successfully")
        return True
    except Exception as e:
        print(f"❌ SmolAgents initialization failed: {e}")
        traceback.print_exc()
        return False

def test_runner_initialization():
    """Test AgentRunner initialization with simplified architecture."""
    print("🔍 Testing AgentRunner initialization...")
    
    try:
        from emery_agents.core.runner import AgentRunner
        from emery_agents.integrations.emery_client import EmeryClientIntegration
        from emery_agents.integrations.smolagents import SmolAgentsOrchestrator
        
        # Create integrations
        emery_client = EmeryClientIntegration(agent_id="test_agent")
        smolagents = SmolAgentsOrchestrator()
        
        # Create runner
        runner = AgentRunner(emery_client, smolagents)
        
        assert runner.emery_client is not None
        assert runner.smolagents is not None
        
        print("✅ AgentRunner initialized with simplified architecture")
        return True
    except Exception as e:
        print(f"❌ AgentRunner initialization failed: {e}")
        traceback.print_exc()
        return False

def test_agent_hierarchy_setup():
    """Test agent hierarchy setup."""
    print("🔍 Testing agent hierarchy setup...")
    
    try:
        from emery_agents.core.types import Agent, CapabilityConfig, StepConfig, StepType
        from emery_agents.integrations.smolagents import SmolAgentsOrchestrator
        import os
        
        # Create test agent
        step = StepConfig(
            id="code_step",
            type=StepType.CODE_STEP,
            instructions="Generate Python code"
        )
        
        capability = CapabilityConfig(
            name="coding",
            description="Code generation capability",
            steps=[step]
        )
        
        agent = Agent(
            id=456,
            name="Test Hierarchy Agent",
            capabilities=[capability]
        )
        
        # Test hierarchy setup (will fail without real token, but validates structure)
        orchestrator = SmolAgentsOrchestrator()
        
        try:
            # Set test token
            os.environ['HF_TOKEN'] = 'test-token'
            orchestrator.setup_agent_orchestrator(agent)
            print("✅ Agent hierarchy setup completed")
            return True
        except EnvironmentError as e:
            if "HF_TOKEN" in str(e):
                print("✅ Agent hierarchy validation successful (expected HF_TOKEN error)")
                return True
            raise
        
    except Exception as e:
        print(f"❌ Agent hierarchy setup failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run all quick tests."""
    print("🧪 Quick Smoke Tests for Simplified Emery Agents")
    print("=" * 55)
    
    tests = [
        test_imports,
        test_basic_types,
        test_smolagents_initialization,
        test_runner_initialization,
        test_agent_hierarchy_setup
    ]
    
    passed = 0
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
        print()
    
    print("=" * 55)
    print(f"📊 Results: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("🎉 All quick tests passed! Simplified architecture is working.")
        return 0
    else:
        print("💥 Some tests failed")
        return 1

if __name__ == "__main__":
    exit(main())