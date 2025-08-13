#!/usr/bin/env uv run python
"""
Quick smoke tests for Emery Agents.

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
        from emery_agents.core.context_manager import ExecutionContextManager
        
        # Integrations
        from emery_agents.integrations.smolagents import SmolAgentsOrchestrator
        from emery_agents.integrations.emery_client import EmeryClientIntegration
        from emery_agents.integrations.mcp_servers import MCPServerIntegration
        
        # gRPC (optional)
        try:
            from emery_agents.grpc.server import AgentWorkerServiceImplementation
            from emery_agents.grpc.proto_mappers import create_task_progress
        except ImportError as e:
            print(f"⚠️  gRPC imports skipped: {e}")
        
        # Utils
        from emery_agents.utils.prompts import render_capability_execution
        
        print("✅ All imports successful")
        return True
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        traceback.print_exc()
        return False


def test_type_creation():
    """Test basic type creation."""
    print("🏗️  Testing type creation...")
    
    try:
        from emery_agents.core.types import (
            Agent, CapabilityConfig, StepConfig, StepType,
            TaskInstructions, ToolConfig, ServerConfig
        )
        
        # Create basic configurations
        tool = ToolConfig(name="test_tool")
        server = ServerConfig(name="test_server")
        
        step = StepConfig(
            id="test_step",
            type=StepType.CODE_STEP,
            instructions="Test step"
        )
        
        capability = CapabilityConfig(
            name="test_capability",
            description="Test capability",
            steps=[step]
        )
        
        agent = Agent(
            id=123,
            name="Test Agent",
            capabilities=[capability]
        )
        
        instructions = TaskInstructions(
            instructions="Test instructions"
        )
        
        print("✅ Type creation successful")
        return True
        
    except Exception as e:
        print(f"❌ Type creation failed: {e}")
        traceback.print_exc()
        return False


def test_orchestrator_setup():
    """Test orchestrator setup without external dependencies."""
    print("🎭 Testing orchestrator setup...")
    
    try:
        from emery_agents.integrations.smolagents import SmolAgentsOrchestrator
        from emery_agents.core.types import Agent, CapabilityConfig, StepConfig, StepType
        
        # Create test agent
        step = StepConfig(
            id="test_step",
            type=StepType.CODE_STEP,
            instructions="Test step"
        )
        
        capability = CapabilityConfig(
            name="test_capability",
            description="Test capability",
            steps=[step]
        )
        
        agent = Agent(
            id=123,
            name="Test Agent",
            capabilities=[capability]
        )
        
        # Setup orchestrator (should work without HF_TOKEN for setup)
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(agent)
        
        # Verify setup
        assert len(orchestrator.task_executor.capability_agents) == 1
        assert "test_capability" in orchestrator.task_executor.capability_agents
        
        print("✅ Orchestrator setup successful")
        return True
        
    except Exception as e:
        print(f"❌ Orchestrator setup failed: {e}")
        traceback.print_exc()
        return False


def test_grpc_service_creation():
    """Test gRPC service can be created."""
    print("🌐 Testing gRPC service creation...")
    
    try:
        from emery_agents.grpc.server import AgentWorkerServiceImplementation
        
        service = AgentWorkerServiceImplementation("test_org")
        
        assert service.organization_id == "test_org"
        assert service.worker_id.startswith("worker_test_org")
        assert len(service.active_tasks) == 0
        
        print("✅ gRPC service creation successful")
        return True
        
    except ImportError:
        print("⚠️  gRPC service creation skipped (missing dependencies)")
        return True  # Count as success since it's optional
    except Exception as e:
        print(f"❌ gRPC service creation failed: {e}")
        traceback.print_exc()
        return False


def test_context_manager():
    """Test ExecutionContextManager basic functionality."""
    print("📁 Testing context manager...")
    
    try:
        from emery_agents.core.context_manager import ExecutionContextManager
        from emery_agents.core.types import Agent, Task, TaskInstructions
        
        agent = Agent(id=123, name="Test Agent")
        task = Task(
            id="test_task",
            agentId=123,
            name="Test Task",
            instructions=TaskInstructions(instructions="Test"),
            capabilityName="test"
        )
        
        with ExecutionContextManager(task, agent) as context_mgr:
            # Test basic operations
            context_mgr.mark_step_started("step_1")
            context_mgr.save_step_output("step_1", {"result": "test"})
            context_mgr.mark_step_completed("step_1")
            
            # Verify context
            context = context_mgr.get_context()
            assert "step_outputs" in context
            assert context["step_outputs"]["step_1"]["result"] == "test"
        
        print("✅ Context manager test successful")
        return True
        
    except Exception as e:
        print(f"❌ Context manager test failed: {e}")
        traceback.print_exc()
        return False


def main():
    """Run all quick tests."""
    print("🚀 Emery Agents Quick Tests")
    print("=" * 40)
    print()
    
    tests = [
        test_imports,
        test_type_creation,
        test_orchestrator_setup,
        test_grpc_service_creation,
        test_context_manager
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            print()
    
    print("=" * 40)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All quick tests passed!")
        return True
    else:
        print("💥 Some tests failed")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)