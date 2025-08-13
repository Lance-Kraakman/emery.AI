"""End-to-end integration tests."""

import pytest
import asyncio
import os
from unittest.mock import patch

from emery_agents.core.runner import AgentRunner
from emery_agents.core.context_manager import ExecutionContextManager
from emery_agents.core.types import TaskStatus, Agent, Task, TaskInstructions
from emery_agents.integrations.emery_client import EmeryClientIntegration
from emery_agents.integrations.smolagents import SmolAgentsOrchestrator


@pytest.mark.integration
class TestIntegration:
    """Integration tests for complete workflows."""
    
    @pytest.mark.asyncio
    async def test_full_execution_flow(self, sample_agent, sample_trigger_data):
        """Test complete execution flow from start to finish."""
        # Create real integrations (mocked external calls)
        emery_client = EmeryClientIntegration(agent_id="test_agent_123")
        smolagents = SmolAgentsOrchestrator()
        
        with patch.object(emery_client, 'report_execution_result', return_value=None):
            runner = AgentRunner(emery_client, smolagents, None)
            
            task = await runner.execute_capability(
                sample_agent,
                "test",  # Use test capability
                sample_trigger_data
            )
            
            assert task.id is not None
            assert task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
            assert task.startedAt is not None
            assert task.completedAt is not None
    
    def test_context_manager_lifecycle(self, sample_agent, sample_trigger_data):
        """Test ExecutionContextManager lifecycle."""
        task = Task(
            id="test_context_task",
            agentId=sample_agent.id,
            name="Context Test",
            instructions=TaskInstructions(instructions="Test context"),
            capabilityName="test_capability"
        )
        
        with ExecutionContextManager(task, sample_agent, sample_trigger_data) as context_mgr:
            # Test context creation
            assert context_mgr.base_dir.exists()
            assert context_mgr.context_file.exists()
            assert context_mgr.execution_log_file.exists()
            
            # Test context operations
            context_mgr.mark_step_started("step_1")
            context_mgr.save_step_output("step_1", {"result": "test_output"})
            context_mgr.mark_step_completed("step_1")
            
            # Verify context data
            context = context_mgr.get_context()
            assert "step_outputs" in context
            assert context["step_outputs"]["step_1"]["result"] == "test_output"
            assert "step_1" in context["completed_steps"]
        
        # Verify cleanup
        assert not context_mgr.base_dir.exists()
    
    def test_local_file_operations(self, temp_working_dir):
        """Test local filesystem operations that don't require external services."""
        import tempfile
        import json
        from pathlib import Path
        
        # Create test file structure
        test_data = {"message": "test data", "timestamp": "2024-01-01"}
        test_file = temp_working_dir / "test_data.json"
        test_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(test_file, 'w') as f:
            json.dump(test_data, f)
        
        # Verify file operations work
        assert test_file.exists()
        
        with open(test_file, 'r') as f:
            loaded_data = json.load(f)
        
        assert loaded_data == test_data
        print("✅ Local file operations work correctly")
    
    @pytest.mark.asyncio
    async def test_smolagents_orchestrator_setup(self, sample_agent):
        """Test SmolAgentsOrchestrator setup without HF_TOKEN."""
        orchestrator = SmolAgentsOrchestrator()
        
        # Should work without HF_TOKEN for setup
        orchestrator.setup_agent_orchestrator(sample_agent)
        
        assert len(orchestrator.task_executor.capability_agents) == 1
        assert "test_capability" in orchestrator.task_executor.capability_agents
        assert orchestrator.default_executor is not None
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required for smolagents")
    @pytest.mark.asyncio
    async def test_smolagents_execution(self, sample_agent, sample_trigger_data):
        """Test actual smolagents execution (requires HF_TOKEN)."""
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(sample_agent)
        
        instructions = TaskInstructions(
            instructions="Generate a simple Python function that adds two numbers"
        )
        
        result = await orchestrator.execute_with_orchestrator(
            instructions,
            sample_trigger_data
        )
        
        assert result["status"] == "success"
        assert "result" in result
    
    @pytest.mark.asyncio
    async def test_error_propagation(self, sample_agent, sample_trigger_data):
        """Test error propagation through system."""
        # Create agent with non-existent capability
        bad_agent = Agent(
            id=999,
            name="Bad Agent", 
            capabilities=[]  # No capabilities
        )
        
        emery_client = EmeryClientIntegration(agent_id="test_agent_999")
        runner = AgentRunner(emery_client, None, None)
        
        with pytest.raises(ValueError, match="not found"):
            await runner.execute_capability(
                bad_agent,
                "nonexistent_capability",
                sample_trigger_data
            )
    
    def test_step_context_flow(self, sample_agent, sample_trigger_data, temp_working_dir):
        """Test step context data flow."""
        task = Task(
            id="context_flow_test",
            agentId=sample_agent.id,
            name="Context Flow Test",
            instructions=TaskInstructions(instructions="Test")
        )
        
        with ExecutionContextManager(task, sample_agent, sample_trigger_data) as context_mgr:
            # Step 1: Save some data
            step1_output = {"processed_data": "step1_result", "count": 42}
            context_mgr.save_step_output("step1", step1_output)
            
            # Step 2: Get context that should include step1 output
            step2_context = context_mgr.get_step_context_for_smolagents("step2")
            
            # Verify step1 data is available in step2 context
            assert step2_context["processed_data"] == "step1_result"
            assert step2_context["count"] == 42
            assert step2_context["previous_steps"]["step1"] == step1_output
            assert step2_context["execution_id"] == task.id
    
    @pytest.mark.asyncio
    async def test_concurrent_executions(self, sample_agent, sample_trigger_data):
        """Test multiple concurrent executions."""
        emery_client = EmeryClientIntegration(agent_id="test_agent_concurrent")
        runner = AgentRunner(emery_client, None, None)
        
        # Create multiple tasks
        tasks = []
        for i in range(3):
            task_coro = runner.execute_capability(
                sample_agent,
                "test",
                {**sample_trigger_data, "task_id": i}
            )
            tasks.append(task_coro)
        
        # Execute concurrently
        with patch.object(emery_client, 'report_execution_result', return_value=None):
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify all completed
        for result in results:
            if isinstance(result, Exception):
                pytest.fail(f"Task failed with exception: {result}")
            assert result.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
            assert result.id is not None