"""
Real Agent Execution Tests

AIDEV-NOTE: Tests that execute actual tasks from tasks.json using real smolagents
and AI models. These tests validate the complete DDD architecture works with 
real agent execution, not just mocked components.

Loads HF_TOKEN from .env.local file for AI model access.
"""

import pytest
import os
import asyncio
import json
from typing import Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env.local
env_local_path = os.path.join(os.path.dirname(__file__), '../../.env.local')
if os.path.exists(env_local_path):
    load_dotenv(env_local_path)
    print(f"✅ Loaded environment from: {env_local_path}")
else:
    print(f"⚠️ .env.local not found at: {env_local_path}")

from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions
from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId, TaskId
from emery_agents.domain.agents.value_objects.agent_value_objects import (
    AgentName, AgentStatus, ApiKey, AgentRole
)
from emery_agents.application.di.container import Container
from emery_agents.core.entities import TaskRequest, AgentConfig as CoreAgentConfig, InstructionConfig, ToolConfig
from emery_agents.infrastructure.execution.smolagents_execution_repository import SmolAgentsExecutionRepository
from emery_agents.domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from tests.fixtures.fixture_loader import FixtureLoader


class TestRealAgentExecution:
    """Test suite for real agent execution using smolagents and AI models."""
    
    @pytest.fixture(scope="session")
    def hf_token_required(self):
        """Check if HF_TOKEN is available for AI model access."""
        hf_token = os.getenv('HF_TOKEN')
        if not hf_token:
            pytest.skip("HF_TOKEN environment variable required for real agent execution tests")
        return hf_token
    
    @pytest.fixture
    def fixture_loader(self):
        """Load test fixtures for agents and tasks."""
        return FixtureLoader()
    
    @pytest.fixture  
    def real_execution_container(self, hf_token_required):
        """Create container with real smolagents execution repository."""
        from emery_agents.domain.agents.repositories.agent_repository import IAgentRepository
        from emery_agents.domain.agents.repositories.task_repository import ITaskRepository
        from emery_agents.domain.execution.repositories.execution_repository import IExecutionRepository
        from emery_agents.domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
        from emery_agents.infrastructure.repositories.mock_agent_repository import MockAgentRepository
        from emery_agents.infrastructure.repositories.mock_task_repository import MockTaskRepository
        from emery_agents.infrastructure.db.repositories.tools.tool_registry_repository import ToolRegistryRepository
        
        container = Container()
        
        # Use real execution repository with smolagents
        tool_registry = ToolRegistryRepository()
        from emery_agents.infrastructure.ai.smolagents_model_provider import SmolagentsModelProvider
        model_provider = SmolagentsModelProvider()
        execution_repo = SmolAgentsExecutionRepository(tool_registry, model_provider)
        
        # Use mock repositories for agent/task persistence (focus on execution testing)
        agent_repo = MockAgentRepository()
        task_repo = MockTaskRepository()
        
        # Register repositories
        container.register_repository(IAgentRepository, agent_repo)
        container.register_repository(ITaskRepository, task_repo)
        container.register_repository(IExecutionRepository, execution_repo)
        container.register_repository(IToolRegistryRepository, tool_registry)
        
        # Store references for easy access
        container.repositories = {
            'agent_repo': agent_repo,
            'task_repo': task_repo,
            'execution_repo': execution_repo,
            'tool_repo': tool_registry
        }
        
        return container
    
    @pytest.fixture
    def real_test_agents(self, fixture_loader):
        """Create real test agents with proper value objects."""
        agents_data = fixture_loader.load_agents()
        
        real_agents = {}
        for i, agent_config in enumerate(agents_data):
            # Convert to domain agent with value objects
            agent = Agent.create(AgentConfig(
                name=AgentName(agent_config.name),
                organization_id=OrganizationId(1),
                owner_id="real_test_user",
                role=AgentRole(agent_config.role) if agent_config.role else None,
                description=agent_config.description,
                persona=agent_config.persona,
                status=AgentStatus.active(),
                api_key=ApiKey(f"ak_secure_production_agent_{i+1}_abc123def456")
            ))
            agent.id = AgentId(i + 1)
            real_agents[i + 1] = agent
            
        return real_agents
    
    @pytest.fixture
    def real_tasks_data(self, fixture_loader):
        """Load real tasks from tasks.json fixture."""
        return fixture_loader.load_tasks()
    
    @pytest.mark.real_execution
    @pytest.mark.asyncio
    async def test_simple_email_task_real_execution(self, real_execution_container, real_test_agents, real_tasks_data):
        """Test simple email task execution with real AI agent."""
        container = real_execution_container
        service = container.get_agent_task_service()
        
        # Find task_001: Send Welcome Email
        email_task = next((task for task in real_tasks_data if task["id"] == "task_001"), None)
        assert email_task is not None, "task_001 not found in fixtures"
        
        # Setup agent repository to return real agent
        agent_repo = container.repositories['agent_repo']
        agent_repo._agents[AgentId(1)] = real_test_agents[1]
        
        # Create task request
        agent_config = container._agent_configs[1] if hasattr(container, '_agent_configs') else None
        if not agent_config:
            # Create core agent config from fixture
            fixture_loader = FixtureLoader()
            agents_data = fixture_loader.load_agents()
            agent_config = agents_data[0]  # First agent (Email Assistant)
        
        task_request = TaskRequest(
            task_id=email_task["id"],
            agent_id=email_task["agentId"],
            agent_config=agent_config,
            trigger_data={"payload": {}},
            organization_id="1",
            owner_id="real_test_user",
            timeout_seconds=300,
            name=email_task["name"],
            capability_name=email_task.get("capabilityName"),
            instruction_config=None
        )
        
        # Execute task and collect progress
        progress_updates = []
        execution_completed = False
        
        try:
            async for progress in service.execute_task(task_request):
                progress_updates.append(progress)
                print(f"📊 Progress: {progress}")
                
                if progress.get("status") in ["completed", "failed"]:
                    execution_completed = True
                    break
                    
        except Exception as e:
            pytest.fail(f"Task execution failed with error: {e}")
        
        # Verify execution results
        assert len(progress_updates) > 0, "Should have received progress updates"
        assert execution_completed, "Task should have completed"
        
        final_progress = progress_updates[-1]
        assert final_progress.get("status") == "completed", f"Task should complete successfully, got: {final_progress.get('status')}"
        assert "result" in final_progress or "output" in final_progress, "Should have task output"
    
    @pytest.mark.real_execution  
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_stripe_website_analysis_real_execution(self, real_execution_container, real_test_agents, real_tasks_data):
        """Test complex Stripe website analysis with real AI execution."""
        container = real_execution_container
        service = container.get_agent_task_service()
        
        # Find task_007: Comprehensive Website Organizational Analysis
        analysis_task = next((task for task in real_tasks_data if task["id"] == "task_007"), None)
        assert analysis_task is not None, "task_007 not found in fixtures"
        
        # Setup agent repository (agent 4: Organizational Intelligence Analyst)
        agent_repo = container.repositories['agent_repo']
        agent_repo._agents[AgentId(4)] = real_test_agents[4]
        
        # Create task request with instruction config
        instructions_data = analysis_task["instructions"]
        tools = []
        for tool_data in instructions_data.get("tools", []):
            tools.append(ToolConfig(
                name=tool_data["name"],
                version=tool_data.get("version", "1.0"),
                config=tool_data.get("config", {})
            ))
        
        instruction_config = InstructionConfig(
            instructions=instructions_data["instructions"],
            tools=tools,
            servers=[]
        )
        
        # Get agent config from fixture  
        fixture_loader = FixtureLoader()
        agents_data = fixture_loader.load_agents()
        agent_config = agents_data[3]  # Agent 4 (index 3)
        
        task_request = TaskRequest(
            task_id=analysis_task["id"],
            agent_id=analysis_task["agentId"],
            agent_config=agent_config,
            trigger_data={"payload": {}},
            organization_id="1", 
            owner_id="real_test_user",
            timeout_seconds=600,  # Extended timeout for complex analysis
            name=analysis_task["name"],
            capability_name=None,  # Using instruction_config instead
            instruction_config=instruction_config
        )
        
        # Execute task and collect progress
        progress_updates = []
        execution_completed = False
        start_time = datetime.now()
        
        try:
            async for progress in service.execute_task(task_request):
                progress_updates.append(progress)
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"📊 [{elapsed:.1f}s] Progress: {progress.get('status', 'unknown')} - {progress.get('step', 'N/A')}")
                
                if progress.get("status") in ["completed", "failed"]:
                    execution_completed = True
                    break
                    
        except Exception as e:
            pytest.fail(f"Stripe analysis task execution failed: {e}")
        
        # Verify execution results
        assert len(progress_updates) > 0, "Should have received progress updates"
        assert execution_completed, "Task should have completed"
        
        final_progress = progress_updates[-1]
        assert final_progress.get("status") == "completed", f"Analysis should complete successfully, got: {final_progress.get('status')}"
        
        # Verify analysis output structure
        result = final_progress.get("result") or final_progress.get("output")
        assert result is not None, "Should have analysis result"
        
        # Check for expected analysis components (adaptive to Stripe)
        if isinstance(result, dict):
            # Should contain business analysis insights
            expected_keys = ["website_analysis", "business_classification", "key_insights"]
            found_analysis_keys = [key for key in expected_keys if key in str(result).lower()]
            assert len(found_analysis_keys) > 0, f"Should contain analysis insights, got keys: {list(result.keys()) if isinstance(result, dict) else 'non-dict result'}"
        
        print(f"✅ Stripe analysis completed successfully in {(datetime.now() - start_time).total_seconds():.1f}s")
    
    @pytest.mark.real_execution
    @pytest.mark.slow  
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_complete_stripe_workflow_real_execution(self, real_execution_container, real_test_agents, real_tasks_data):
        """Test complete Stripe analysis workflow: context init → website analysis → measurement framework."""
        container = real_execution_container
        service = container.get_agent_task_service()
        
        # Find workflow tasks 17, 18, 19
        workflow_tasks = []
        for task_id in ["task_017", "task_018", "task_019"]:
            task = next((t for t in real_tasks_data if t["id"] == task_id), None)
            assert task is not None, f"{task_id} not found in fixtures"
            workflow_tasks.append(task)
        
        # Setup agent repository for all agents used in workflow
        agent_repo = container.repositories['agent_repo']
        for agent_id in [4, 5]:  # Agents used in workflow
            if agent_id in real_test_agents:
                agent_repo._agents[AgentId(agent_id)] = real_test_agents[agent_id]
        
        fixture_loader = FixtureLoader()
        agents_data = fixture_loader.load_agents()
        
        workflow_results = []
        
        # Execute workflow tasks in sequence
        for i, task_data in enumerate(workflow_tasks):
            print(f"\n🚀 Executing Step {i+1}/3: {task_data['name']}")
            
            # Create instruction config for task
            instructions_data = task_data["instructions"]
            tools = []
            for tool_data in instructions_data.get("tools", []):
                tools.append(ToolConfig(
                    name=tool_data["name"],
                    version=tool_data.get("version", "1.0"),
                    config=tool_data.get("config", {})
                ))
            
            instruction_config = InstructionConfig(
                instructions=instructions_data["instructions"],
                tools=tools,
                servers=[]
            )
            
            # Get appropriate agent config
            agent_config = agents_data[task_data["agentId"] - 1]  # Convert to 0-based index
            
            task_request = TaskRequest(
                task_id=task_data["id"],
                agent_id=task_data["agentId"],
                agent_config=agent_config,
                trigger_data={"payload": {}},
                organization_id="1",
                owner_id="real_test_user", 
                timeout_seconds=600,
                name=task_data["name"],
                capability_name=None,
                instruction_config=instruction_config
            )
            
            # Execute individual task
            progress_updates = []
            execution_completed = False
            start_time = datetime.now()
            
            try:
                async for progress in service.execute_task(task_request):
                    progress_updates.append(progress)
                    elapsed = (datetime.now() - start_time).total_seconds()
                    print(f"📊 [{elapsed:.1f}s] Step {i+1}: {progress.get('status', 'unknown')} - {progress.get('step', 'N/A')}")
                    
                    if progress.get("status") in ["completed", "failed"]:
                        execution_completed = True
                        break
                        
            except Exception as e:
                pytest.fail(f"Workflow step {i+1} failed: {e}")
            
            # Verify step completion
            assert execution_completed, f"Step {i+1} should have completed"
            final_progress = progress_updates[-1]
            assert final_progress.get("status") == "completed", f"Step {i+1} should complete successfully"
            
            workflow_results.append({
                "task_id": task_data["id"],
                "result": final_progress.get("result") or final_progress.get("output"),
                "execution_time": (datetime.now() - start_time).total_seconds()
            })
            
            print(f"✅ Step {i+1} completed in {workflow_results[-1]['execution_time']:.1f}s")
        
        # Verify complete workflow results
        assert len(workflow_results) == 3, "All workflow steps should complete"
        
        # Verify each step has meaningful output
        for i, result in enumerate(workflow_results):
            assert result["result"] is not None, f"Step {i+1} should have output"
            assert result["execution_time"] < 600, f"Step {i+1} should complete within timeout"
        
        total_time = sum(r["execution_time"] for r in workflow_results)
        print(f"\n🎊 Complete Stripe workflow executed successfully in {total_time:.1f}s total")
        print("📋 Workflow Results Summary:")
        for i, result in enumerate(workflow_results):
            print(f"   Step {i+1}: {result['task_id']} - {result['execution_time']:.1f}s")
    
    @pytest.mark.real_execution
    @pytest.mark.slow
    @pytest.mark.asyncio  
    async def test_measurement_framework_creation_real_execution(self, real_execution_container, real_test_agents, real_tasks_data):
        """Test measurement framework creation for e-commerce organization."""
        container = real_execution_container
        service = container.get_agent_task_service()
        
        # Find task_009: Design Comprehensive E-commerce Measurement Framework
        framework_task = next((task for task in real_tasks_data if task["id"] == "task_009"), None)
        assert framework_task is not None, "task_009 not found in fixtures"
        
        # Setup agent repository (agent 5: Adaptive Measurement Framework Architect)
        agent_repo = container.repositories['agent_repo']
        agent_repo._agents[AgentId(5)] = real_test_agents[5]
        
        # Create instruction config
        instructions_data = framework_task["instructions"]
        tools = []
        for tool_data in instructions_data.get("tools", []):
            tools.append(ToolConfig(
                name=tool_data["name"],
                version=tool_data.get("version", "1.0"),
                config=tool_data.get("config", {})
            ))
        
        instruction_config = InstructionConfig(
            instructions=instructions_data["instructions"],
            tools=tools,
            servers=[]
        )
        
        # Get agent config
        fixture_loader = FixtureLoader()
        agents_data = fixture_loader.load_agents()
        agent_config = agents_data[4]  # Agent 5 (index 4)
        
        task_request = TaskRequest(
            task_id=framework_task["id"],
            agent_id=framework_task["agentId"],
            agent_config=agent_config,
            trigger_data={"payload": {}},
            organization_id="1",
            owner_id="real_test_user",
            timeout_seconds=600,
            name=framework_task["name"],
            capability_name=None,
            instruction_config=instruction_config
        )
        
        # Execute framework creation
        progress_updates = []
        execution_completed = False
        start_time = datetime.now()
        
        try:
            async for progress in service.execute_task(task_request):
                progress_updates.append(progress)
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"📊 [{elapsed:.1f}s] Framework Creation: {progress.get('status', 'unknown')} - {progress.get('step', 'N/A')}")
                
                if progress.get("status") in ["completed", "failed"]:
                    execution_completed = True
                    break
                    
        except Exception as e:
            pytest.fail(f"Measurement framework creation failed: {e}")
        
        # Verify execution results
        assert execution_completed, "Framework creation should complete"
        final_progress = progress_updates[-1]
        assert final_progress.get("status") == "completed", "Framework creation should succeed"
        
        # Verify framework output
        result = final_progress.get("result") or final_progress.get("output")
        assert result is not None, "Should have framework output"
        
        # Check for measurement framework components
        result_str = str(result).lower()
        expected_components = ["measurement", "kpi", "framework", "ecommerce"]
        found_components = [comp for comp in expected_components if comp in result_str]
        assert len(found_components) >= 2, f"Should contain framework components, found: {found_components}"
        
        execution_time = (datetime.now() - start_time).total_seconds()
        print(f"✅ E-commerce measurement framework created successfully in {execution_time:.1f}s")


class TestRealAgentValidation:
    """Additional validation tests for real agent execution."""
    
    @pytest.mark.real_execution
    def test_fixture_loading_integrity(self):
        """Verify that fixtures load correctly and contain expected data."""
        loader = FixtureLoader()
        
        # Test agents loading
        agents = loader.load_agents()
        assert len(agents) > 0, "Should load agents from fixtures"
        assert all(hasattr(agent, 'name') for agent in agents), "All agents should have names"
        assert all(hasattr(agent, 'capabilities') for agent in agents), "All agents should have capabilities"
        
        # Test tasks loading
        tasks = loader.load_tasks()
        assert len(tasks) > 0, "Should load tasks from fixtures"
        assert all('id' in task for task in tasks), "All tasks should have IDs"
        assert all('agentId' in task for task in tasks), "All tasks should have agent IDs"
        
        # Test specific high-value tasks exist
        high_value_task_ids = ["task_007", "task_017", "task_018", "task_019"]
        existing_task_ids = [task['id'] for task in tasks]
        missing_tasks = [task_id for task_id in high_value_task_ids if task_id not in existing_task_ids]
        assert len(missing_tasks) == 0, f"Missing high-value tasks: {missing_tasks}"
        
        print(f"✅ Fixtures validated: {len(agents)} agents, {len(tasks)} tasks")
    
    @pytest.mark.real_execution
    def test_smolagents_availability(self):
        """Verify smolagents and dependencies are available."""
        try:
            from smolagents import CodeAgent, ToolCallingAgent
            from smolagents.models import InferenceClientModel
            print("✅ smolagents imports successful")
        except ImportError as e:
            pytest.fail(f"smolagents not available: {e}")
        
        # Test HF_TOKEN availability
        hf_token = os.getenv('HF_TOKEN')
        if not hf_token:
            pytest.skip("HF_TOKEN required for real execution tests")
        
        assert len(hf_token) > 10, "HF_TOKEN should be a valid token"
        print("✅ HF_TOKEN available for AI model access")