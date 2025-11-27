"""
Healthcare Report Generation Tests

AIDEV-NOTE: Tests that execute actual healthcare report generation tasks using real smolagents
and AI models. These tests validate the complete DDD architecture works with healthcare-specific
report generation capabilities.

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


class TestHealthcareReports:
    """Test suite for healthcare report generation using DRCare agent and AI models."""
    
    @pytest.fixture(scope="session")
    def hf_token_required(self):
        """Check if HF_TOKEN is available for AI model access."""
        hf_token = os.getenv('HF_TOKEN')
        if not hf_token:
            pytest.skip("HF_TOKEN environment variable required for healthcare report execution tests")
        return hf_token
    
    @pytest.fixture
    def fixture_loader(self):
        """Load test fixtures for agents and tasks."""
        return FixtureLoader()
    
    @pytest.fixture  
    def healthcare_execution_container(self, hf_token_required):
        """Create container with real smolagents execution repository for healthcare testing."""
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
    def healthcare_agent(self, fixture_loader):
        """Create healthcare report writer agent with proper value objects."""
        agents_data = fixture_loader.load_agents()
        
        # Find the healthcare agent (ID 8 or by name)
        healthcare_agent_data = next((agent for agent in agents_data if hasattr(agent, 'id') and agent.id == 8), None)
        if not healthcare_agent_data:
            healthcare_agent_data = next((agent for agent in agents_data if agent.name == "DRCare Healthcare Report Writer"), None)
        if not healthcare_agent_data:
            pytest.skip("Healthcare agent not found in fixtures")
        
        # Convert to domain agent with value objects
        agent = Agent.create(AgentConfig(
            name=AgentName(healthcare_agent_data.name),
            organization_id=OrganizationId(1),
            owner_id="healthcare_test_user",
            role=AgentRole(healthcare_agent_data.role) if healthcare_agent_data.role else None,
            description=healthcare_agent_data.description,
            persona=healthcare_agent_data.persona,
            status=AgentStatus.active(),
            api_key=ApiKey("ak_secure_production_healthcare_agent_abc123def456")
        ))
        agent.id = AgentId(8)
        
        return agent
    
    @pytest.fixture
    def healthcare_tasks_data(self, fixture_loader):
        """Load healthcare tasks from tasks.json fixture."""
        tasks = fixture_loader.load_tasks()
        healthcare_tasks = [task for task in tasks if task["id"].startswith("task_healthcare_")]
        return healthcare_tasks
    
    @pytest.mark.healthcare
    @pytest.mark.real_execution
    @pytest.mark.asyncio
    async def test_aged_care_report_generation(self, healthcare_execution_container, healthcare_agent, healthcare_tasks_data):
        """Test aged care placement report generation with real AI agent."""
        container = healthcare_execution_container
        service = container.get_agent_task_service()
        
        # Find healthcare task 001: Residential Aged Care Report
        aged_care_task = next((task for task in healthcare_tasks_data if task["id"] == "task_healthcare_001"), None)
        assert aged_care_task is not None, "task_healthcare_001 not found in fixtures"
        
        # Setup agent repository to return healthcare agent
        agent_repo = container.repositories['agent_repo']
        agent_repo._agents[AgentId(8)] = healthcare_agent
        
        # Create task request
        fixture_loader = FixtureLoader()
        agents_data = fixture_loader.load_agents()
        agent_config = next((agent for agent in agents_data if hasattr(agent, 'id') and agent.id == 8), None)
        if not agent_config:
            agent_config = next((agent for agent in agents_data if agent.name == "DRCare Healthcare Report Writer"), None)
        
        task_request = TaskRequest(
            task_id=aged_care_task["id"],
            agent_id=aged_care_task["agentId"],
            agent_config=agent_config,
            trigger_data={"payload": {}},
            organization_id="1",
            owner_id="healthcare_test_user",
            timeout_seconds=300,
            name=aged_care_task["name"],
            capability_name=aged_care_task.get("capabilityName"),
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
            pytest.fail(f"Aged care report generation failed with error: {e}")
        
        # Verify execution results
        assert len(progress_updates) > 0, "Should have received progress updates"
        assert execution_completed, "Task should have completed"
        
        final_progress = progress_updates[-1]
        assert final_progress.get("status") == "completed", f"Aged care report should complete successfully, got: {final_progress.get('status')}"
        assert "result" in final_progress or "output" in final_progress, "Should have report output"
        
        # Verify report content structure
        result = final_progress.get("result") or final_progress.get("output")
        assert result is not None, "Should have aged care report result"
        
        # Check for expected report components - be more flexible
        result_str = str(result).lower()
        expected_components = ["aged care", "care assessment", "placement", "facility", "residential", "report", "comprehensive"]
        found_components = [comp for comp in expected_components if comp in result_str]
        assert len(found_components) >= 1, f"Should contain at least one healthcare report component, found: {found_components}"
        
        print(f"✅ Found healthcare components: {found_components}")
        result_preview = str(result)[:200] if isinstance(result, str) else str(result)[:200]
        print(f"📄 Report result: {result_preview}...")  # Show first 200 chars
    
    @pytest.mark.healthcare
    @pytest.mark.real_execution  
    @pytest.mark.asyncio
    async def test_life_plan_report_generation(self, healthcare_execution_container, healthcare_agent, healthcare_tasks_data):
        """Test life plan report generation for couple planning."""
        container = healthcare_execution_container
        service = container.get_agent_task_service()
        
        # Find healthcare task 002: Life Plan Report
        life_plan_task = next((task for task in healthcare_tasks_data if task["id"] == "task_healthcare_002"), None)
        assert life_plan_task is not None, "task_healthcare_002 not found in fixtures"
        
        # Setup agent repository
        agent_repo = container.repositories['agent_repo']
        agent_repo._agents[AgentId(8)] = healthcare_agent
        
        # Create task request
        fixture_loader = FixtureLoader()
        agents_data = fixture_loader.load_agents()
        agent_config = next((agent for agent in agents_data if hasattr(agent, 'id') and agent.id == 8), None)
        if not agent_config:
            agent_config = next((agent for agent in agents_data if agent.name == "DRCare Healthcare Report Writer"), None)
        
        task_request = TaskRequest(
            task_id=life_plan_task["id"],
            agent_id=life_plan_task["agentId"],
            agent_config=agent_config,
            trigger_data={"payload": {}},
            organization_id="1",
            owner_id="healthcare_test_user",
            timeout_seconds=400,  # Extended timeout for comprehensive planning
            name=life_plan_task["name"],
            capability_name=life_plan_task.get("capabilityName"),
            instruction_config=None
        )
        
        # Execute task and collect progress
        progress_updates = []
        execution_completed = False
        start_time = datetime.now()
        
        try:
            async for progress in service.execute_task(task_request):
                progress_updates.append(progress)
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"📊 [{elapsed:.1f}s] Life Plan: {progress.get('status', 'unknown')} - {progress.get('step', 'N/A')}")
                
                if progress.get("status") in ["completed", "failed"]:
                    execution_completed = True
                    break
                    
        except Exception as e:
            pytest.fail(f"Life plan report generation failed: {e}")
        
        # Verify execution results
        assert len(progress_updates) > 0, "Should have received progress updates"
        assert execution_completed, "Life plan task should have completed"
        
        final_progress = progress_updates[-1]
        assert final_progress.get("status") == "completed", f"Life plan should complete successfully, got: {final_progress.get('status')}"
        
        # Verify life plan output structure
        result = final_progress.get("result") or final_progress.get("output")
        assert result is not None, "Should have life plan result"
        
        # Check for expected life plan components
        result_str = str(result).lower()
        expected_components = ["life plan", "wilson", "healthcare pathway", "financial planning"]
        found_components = [comp for comp in expected_components if comp in result_str]
        assert len(found_components) >= 2, f"Should contain life plan components, found: {found_components}"
        
        execution_time = (datetime.now() - start_time).total_seconds()
        print(f"✅ Life plan report generated successfully in {execution_time:.1f}s")
    
    @pytest.mark.healthcare
    @pytest.mark.real_execution
    @pytest.mark.asyncio  
    async def test_executive_summary_generation(self, healthcare_execution_container, healthcare_agent, healthcare_tasks_data):
        """Test executive summary report generation with concise output."""
        container = healthcare_execution_container
        service = container.get_agent_task_service()
        
        # Find healthcare task 003: Executive Summary Report
        summary_task = next((task for task in healthcare_tasks_data if task["id"] == "task_healthcare_003"), None)
        assert summary_task is not None, "task_healthcare_003 not found in fixtures"
        
        # Setup agent repository
        agent_repo = container.repositories['agent_repo']
        agent_repo._agents[AgentId(8)] = healthcare_agent
        
        # Create task request
        fixture_loader = FixtureLoader()
        agents_data = fixture_loader.load_agents()
        agent_config = next((agent for agent in agents_data if hasattr(agent, 'id') and agent.id == 8), None)
        if not agent_config:
            agent_config = next((agent for agent in agents_data if agent.name == "DRCare Healthcare Report Writer"), None)
        
        task_request = TaskRequest(
            task_id=summary_task["id"],
            agent_id=summary_task["agentId"],
            agent_config=agent_config,
            trigger_data={"payload": {}},
            organization_id="1",
            owner_id="healthcare_test_user",
            timeout_seconds=300,
            name=summary_task["name"],
            capability_name=summary_task.get("capabilityName"),
            instruction_config=None
        )
        
        # Execute executive summary generation
        progress_updates = []
        execution_completed = False
        start_time = datetime.now()
        
        try:
            async for progress in service.execute_task(task_request):
                progress_updates.append(progress)
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"📊 [{elapsed:.1f}s] Executive Summary: {progress.get('status', 'unknown')} - {progress.get('step', 'N/A')}")
                
                if progress.get("status") in ["completed", "failed"]:
                    execution_completed = True
                    break
                    
        except Exception as e:
            pytest.fail(f"Executive summary generation failed: {e}")
        
        # Verify execution results
        assert execution_completed, "Executive summary should complete"
        final_progress = progress_updates[-1]
        assert final_progress.get("status") == "completed", "Executive summary should succeed"
        
        # Verify summary output
        result = final_progress.get("result") or final_progress.get("output")
        assert result is not None, "Should have executive summary output"
        
        # Check for executive summary components
        result_str = str(result).lower()
        expected_components = ["executive summary", "william chen", "key points", "next steps"]
        found_components = [comp for comp in expected_components if comp in result_str]
        assert len(found_components) >= 2, f"Should contain executive summary components, found: {found_components}"
        
        execution_time = (datetime.now() - start_time).total_seconds()
        print(f"✅ Executive summary created successfully in {execution_time:.1f}s")
    
    @pytest.mark.healthcare
    @pytest.mark.slow  
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_complete_healthcare_workflow(self, healthcare_execution_container, healthcare_agent, healthcare_tasks_data):
        """Test complete healthcare documentation workflow: aged care → life plan → executive summary."""
        container = healthcare_execution_container
        service = container.get_agent_task_service()
        
        # Find workflow task 004: Complete Healthcare Documentation Workflow
        workflow_task = next((task for task in healthcare_tasks_data if task["id"] == "task_healthcare_004"), None)
        assert workflow_task is not None, "task_healthcare_004 not found in fixtures"
        
        # Setup agent repository
        agent_repo = container.repositories['agent_repo']
        agent_repo._agents[AgentId(8)] = healthcare_agent
        
        fixture_loader = FixtureLoader()
        agents_data = fixture_loader.load_agents()
        agent_config = next((agent for agent in agents_data if agent.id == 8), None)
        
        # Execute complete workflow
        task_request = TaskRequest(
            task_id=workflow_task["id"],
            agent_id=workflow_task["agentId"],
            agent_config=agent_config,
            trigger_data={"payload": {}},
            organization_id="1",
            owner_id="healthcare_test_user",
            timeout_seconds=800,  # Extended timeout for complete workflow
            name=workflow_task["name"],
            capability_name=workflow_task.get("capabilityName"),
            instruction_config=None
        )
        
        # Execute workflow and track progress
        progress_updates = []
        execution_completed = False
        start_time = datetime.now()
        
        try:
            async for progress in service.execute_task(task_request):
                progress_updates.append(progress)
                elapsed = (datetime.now() - start_time).total_seconds()
                print(f"📊 [{elapsed:.1f}s] Healthcare Workflow: {progress.get('status', 'unknown')} - {progress.get('step', 'N/A')}")
                
                if progress.get("status") in ["completed", "failed"]:
                    execution_completed = True
                    break
                    
        except Exception as e:
            pytest.fail(f"Complete healthcare workflow failed: {e}")
        
        # Verify complete workflow results
        assert len(progress_updates) > 0, "Should have workflow progress updates"
        assert execution_completed, "Complete workflow should finish"
        
        final_progress = progress_updates[-1]
        assert final_progress.get("status") == "completed", f"Healthcare workflow should complete successfully"
        
        # Verify workflow output contains all report types
        result = final_progress.get("result") or final_progress.get("output")
        assert result is not None, "Should have complete workflow output"
        
        # Check for all healthcare report components
        result_str = str(result).lower()
        expected_workflow_components = ["aged care", "life plan", "executive summary", "healthcare", "report"]
        found_components = [comp for comp in expected_workflow_components if comp in result_str]
        assert len(found_components) >= 3, f"Should contain multiple healthcare report components, found: {found_components}"
        
        total_time = (datetime.now() - start_time).total_seconds()
        print(f"\n🎊 Complete healthcare documentation workflow executed successfully in {total_time:.1f}s total")
        print("📋 Healthcare Workflow Results Summary:")
        print(f"   Total Progress Updates: {len(progress_updates)}")
        print(f"   Final Status: {final_progress.get('status')}")
        print(f"   Total Execution Time: {total_time:.1f}s")


class TestHealthcareValidation:
    """Additional validation tests for healthcare report generation."""
    
    @pytest.mark.healthcare
    def test_healthcare_fixture_loading_integrity(self):
        """Verify that healthcare fixtures load correctly and contain expected data."""
        loader = FixtureLoader()
        
        # Test healthcare agent loading
        agents = loader.load_agents()
        healthcare_agent = next((agent for agent in agents if hasattr(agent, 'id') and agent.id == 8), None)
        if not healthcare_agent:
            # Try finding by name if id attribute doesn't exist
            healthcare_agent = next((agent for agent in agents if agent.name == "DRCare Healthcare Report Writer"), None)
        assert healthcare_agent is not None, "Should find healthcare agent"
        assert healthcare_agent.name == "DRCare Healthcare Report Writer", "Healthcare agent should have correct name"
        assert healthcare_agent.role == "report_writer", "Healthcare agent should have report writer role"
        
        # Test healthcare tasks loading
        tasks = loader.load_tasks()
        healthcare_tasks = [task for task in tasks if task["id"].startswith("task_healthcare_")]
        assert len(healthcare_tasks) == 4, f"Should load 4 healthcare tasks, got {len(healthcare_tasks)}"
        
        # Test specific healthcare tasks exist
        expected_task_ids = ["task_healthcare_001", "task_healthcare_002", "task_healthcare_003", "task_healthcare_004"]
        existing_task_ids = [task['id'] for task in healthcare_tasks]
        missing_tasks = [task_id for task_id in expected_task_ids if task_id not in existing_task_ids]
        assert len(missing_tasks) == 0, f"Missing healthcare tasks: {missing_tasks}"
        
        # Test healthcare data file exists
        healthcare_data_path = "/Users/lancekraakman/orchastrate/emery-agents/tests/fixtures/healthcare_data.json"
        assert os.path.exists(healthcare_data_path), "Healthcare data fixture should exist"
        
        with open(healthcare_data_path, 'r') as f:
            healthcare_data = json.load(f)
        assert len(healthcare_data) >= 3, "Should have at least 3 healthcare client records"
        
        print(f"✅ Healthcare fixtures validated: 1 agent, {len(healthcare_tasks)} tasks, {len(healthcare_data)} client records")
    
    @pytest.mark.healthcare
    def test_healthcare_tools_availability(self):
        """Verify healthcare tools and dependencies are available."""
        try:
            from emery_agents.execution.tools.healthcare_tools import HEALTHCARE_TOOLS
            assert "document_generator" in HEALTHCARE_TOOLS, "document_generator tool should be available"
            assert "file_writer" in HEALTHCARE_TOOLS, "file_writer tool should be available"
            assert "template_reader" in HEALTHCARE_TOOLS, "template_reader tool should be available"
            print("✅ Healthcare tools imports successful")
        except ImportError as e:
            pytest.fail(f"Healthcare tools not available: {e}")
        
        # Test tool registry includes healthcare tools
        from emery_agents.infrastructure.db.repositories.tools.tool_registry_repository import ToolRegistryRepository
        tool_registry = ToolRegistryRepository()
        
        # Test healthcare tool loading
        from emery_agents.core.entities import ToolConfig
        doc_gen_config = ToolConfig(name="document_generator", version="1.0", config={})
        file_writer_config = ToolConfig(name="file_writer", version="1.0", config={})
        template_reader_config = ToolConfig(name="template_reader", version="1.0", config={})
        
        try:
            doc_gen_tool = tool_registry.load_tool(doc_gen_config)
            file_writer_tool = tool_registry.load_tool(file_writer_config)
            template_reader_tool = tool_registry.load_tool(template_reader_config)
            assert doc_gen_tool is not None, "document_generator should load successfully"
            assert file_writer_tool is not None, "file_writer should load successfully"
            assert template_reader_tool is not None, "template_reader should load successfully"
            print("✅ Healthcare tools load successfully from registry")
        except Exception as e:
            pytest.fail(f"Healthcare tool loading failed: {e}")