"""
Agent Capability Evaluation Tests

AIDEV-NOTE: Integration tests for agent capability evaluation using pytest.
Follows existing DDD test patterns and uses real evaluation framework.
"""

import pytest
from unittest.mock import AsyncMock, Mock
from typing import Dict, Any, List

from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.evaluation.services.capability_parser import CapabilityParser
from emery_agents.application.services.agent_evaluation_service import (
    AgentEvaluationApplicationService,
    EvaluateAgentRequest,
    EvaluateCapabilityRequest
)
from emery_agents.infrastructure.evaluation.scenario_loader import TestScenarioLoader
from emery_agents.domain.evaluation.entities.evaluation_result import ExecutionStatus
from emery_agents.domain.evaluation.entities.test_scenario import StepType


class TestAgentCapabilities:
    """Integration tests for agent capability evaluation."""
    
    @pytest.fixture
    def mock_agent_repository(self):
        """Mock agent repository."""
        return AsyncMock()
    
    @pytest.fixture
    def capability_parser(self):
        """Create capability parser."""
        return CapabilityParser()
    
    @pytest.fixture
    def scenario_loader(self):
        """Create test scenario loader."""
        return TestScenarioLoader()
    
    @pytest.fixture
    def evaluation_service(self, mock_agent_repository, capability_parser):
        """Create evaluation service with dependencies."""
        return AgentEvaluationApplicationService(
            agent_repository=mock_agent_repository,
            capability_parser=capability_parser
        )
    
    @pytest.fixture
    def test_agent_with_email_capability(self):
        """Create test agent with email capability structure."""
        capabilities = {
            "send_email": {
                "name": "send_email",
                "description": "Send email using Gmail integration",
                "steps": [
                    {
                        "id": "compose_email",
                        "type": "CODE_STEP",
                        "instructions": "Compose email data structure with recipient, subject, and body",
                        "model": "gpt-4"
                    },
                    {
                        "id": "send_via_gmail",
                        "type": "TOOL_STEP", 
                        "instructions": "Send email using Gmail API tool",
                        "tools": [{"name": "gmail_send"}]
                    }
                ]
            }
        }
        
        config = AgentConfig(
            name="Email Agent",
            description="Agent specialized in email operations",
            capabilities=capabilities,
            organization_id=1,
            owner_id="user_123",
            api_key="test_key"
        )
        return Agent.create(config)
    
    @pytest.fixture
    def test_agent_with_search_capability(self):
        """Create test agent with web search capability."""
        capabilities = [
            {
                "name": "web_search",
                "description": "Perform web searches and analyze results", 
                "steps": [
                    {
                        "id": "execute_search",
                        "type": "TOOL_STEP",
                        "instructions": "Execute web search using search tool",
                        "tools": [{"name": "web_search"}]
                    },
                    {
                        "id": "process_results",
                        "type": "CODE_STEP",
                        "instructions": "Process and filter search results"
                    }
                ]
            }
        ]
        
        config = AgentConfig(
            name="Search Agent",
            description="Agent specialized in web search and research",
            capabilities=capabilities,
            organization_id=1,
            owner_id="user_123",
            api_key="test_key"
        )
        return Agent.create(config)
    
    @pytest.mark.asyncio
    async def test_evaluate_agent_basic_scenarios(
        self,
        evaluation_service,
        mock_agent_repository,
        test_agent_with_email_capability
    ):
        """Test basic agent capability evaluation with auto-generated scenarios."""
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = test_agent_with_email_capability
        
        # Create evaluation request
        request = EvaluateAgentRequest(
            agent_id=123,
            timeout_seconds=60
        )
        
        # Execute evaluation
        result = await evaluation_service.evaluate_agent_capabilities(request)
        
        # Verify results
        assert result is not None
        assert result.agent_id == 123
        assert result.overall_status == ExecutionStatus.COMPLETED
        assert len(result.capability_results) > 0
        
        # Check that email capability was evaluated
        assert "send_email" in result.capability_results
        email_result = result.capability_results["send_email"]
        
        # Verify step execution
        assert len(email_result.step_results) == 2  # compose_email + send_via_gmail
        
        code_steps = [s for s in email_result.step_results if s.step_type == StepType.CODE_STEP]
        tool_steps = [s for s in email_result.step_results if s.step_type == StepType.TOOL_STEP]
        
        assert len(code_steps) == 1  # compose_email
        assert len(tool_steps) == 1  # send_via_gmail
        
        # Verify repository interactions
        mock_agent_repository.find_by_id.assert_called_once_with(123)
        
        print(f"[TEST] Evaluation completed with {result.overall_success_rate:.1f}% success rate")
    
    @pytest.mark.asyncio
    async def test_evaluate_multiple_capabilities(
        self,
        evaluation_service,
        mock_agent_repository,
        test_agent_with_search_capability
    ):
        """Test evaluation of agent with multiple capabilities."""
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = test_agent_with_search_capability
        
        # Create evaluation request
        request = EvaluateAgentRequest(
            agent_id=456,
            capability_names=["web_search"]  # Test specific capability
        )
        
        # Execute evaluation
        result = await evaluation_service.evaluate_agent_capabilities(request)
        
        # Verify results
        assert result.overall_status == ExecutionStatus.COMPLETED
        assert "web_search" in result.capability_results
        
        search_result = result.capability_results["web_search"]
        assert len(search_result.step_results) == 2  # execute_search + process_results
        
        # Check performance metrics
        metrics = result.performance_metrics
        assert metrics.total_capabilities == 1
        assert metrics.total_steps == 2
        assert metrics.capability_completion_rate >= 0
        
    @pytest.mark.asyncio
    async def test_evaluate_single_capability_detailed(
        self,
        evaluation_service,
        mock_agent_repository,
        test_agent_with_email_capability,
        capability_parser
    ):
        """Test detailed evaluation of single capability."""
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = test_agent_with_email_capability
        
        # Parse capabilities to create test scenario
        parsed_capabilities = capability_parser.extract_capabilities(test_agent_with_email_capability)
        assert len(parsed_capabilities) == 1
        
        test_scenarios = capability_parser.generate_basic_test_scenarios(parsed_capabilities)
        capability_scenario = test_scenarios[0]
        
        # Create single capability evaluation request
        request = EvaluateCapabilityRequest(
            agent_id=123,
            capability_name="send_email",
            test_scenario=capability_scenario
        )
        
        # Execute single capability evaluation
        result = await evaluation_service.evaluate_single_capability(request)
        
        # Verify detailed results
        assert result.capability_name == "send_email"
        assert result.status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED]
        assert len(result.step_results) == 2
        
        # Check step-level details
        for step_result in result.step_results:
            assert step_result.step_id in ["compose_email", "send_via_gmail"]
            assert step_result.execution_time_ms >= 0
            if step_result.step_type == StepType.CODE_STEP:
                # Should have generated code
                assert step_result.generated_code is not None
            elif step_result.step_type == StepType.TOOL_STEP:
                # Should have tool calls
                assert step_result.tool_calls is not None
    
    @pytest.mark.asyncio
    async def test_evaluate_agent_with_no_capabilities(
        self,
        evaluation_service,
        mock_agent_repository
    ):
        """Test evaluation of agent with no capabilities defined."""
        # Create agent with no capabilities
        config = AgentConfig(
            name="Empty Agent",
            organization_id=1,
            owner_id="user_123",
            api_key="test_key"
        )
        empty_agent = Agent.create(config)
        
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = empty_agent
        
        # Create evaluation request
        request = EvaluateAgentRequest(agent_id=789)
        
        # Execute evaluation
        result = await evaluation_service.evaluate_agent_capabilities(request)
        
        # Should complete but with no capability results
        assert result.overall_status == ExecutionStatus.FAILED
        assert len(result.capability_results) == 0
        assert len(result.errors) > 0
    
    @pytest.mark.asyncio
    async def test_evaluate_nonexistent_agent(
        self,
        evaluation_service,
        mock_agent_repository
    ):
        """Test evaluation of non-existent agent."""
        # Setup mocks to return None (agent not found)
        mock_agent_repository.find_by_id.return_value = None
        
        # Create evaluation request
        request = EvaluateAgentRequest(agent_id=999)
        
        # Execute evaluation should raise ValueError
        with pytest.raises(ValueError, match="Agent 999 not found"):
            await evaluation_service.evaluate_agent_capabilities(request)
    
    @pytest.mark.asyncio
    async def test_capability_parser_extracts_capabilities_correctly(
        self,
        capability_parser,
        test_agent_with_email_capability
    ):
        """Test capability parser extracts agent capabilities correctly."""
        # Parse capabilities from agent
        parsed_capabilities = capability_parser.extract_capabilities(test_agent_with_email_capability)
        
        # Verify parsing
        assert len(parsed_capabilities) == 1
        
        email_cap = parsed_capabilities[0]
        assert email_cap.name == "send_email"
        assert email_cap.description == "Send email using Gmail integration"
        assert len(email_cap.steps) == 2
        
        # Check steps
        compose_step = email_cap.steps[0]
        assert compose_step.id == "compose_email"
        assert compose_step.type == StepType.CODE_STEP
        assert "compose" in compose_step.instructions.lower()
        
        send_step = email_cap.steps[1]
        assert send_step.id == "send_via_gmail"
        assert send_step.type == StepType.TOOL_STEP
        assert "gmail" in send_step.instructions.lower()
    
    def test_scenario_loader_lists_available_scenarios(self, scenario_loader):
        """Test scenario loader can list available test scenarios."""
        available_scenarios = scenario_loader.list_available_scenarios()
        
        # Should find the JSON scenario files we created
        expected_scenarios = ["email_agent_capability", "web_search_capability", "data_analysis_capability"]
        for expected in expected_scenarios:
            assert expected in available_scenarios, f"Expected scenario '{expected}' not found in {available_scenarios}"
    
    def test_scenario_loader_loads_email_scenario(self, scenario_loader):
        """Test scenario loader can load email capability scenario."""
        scenario = scenario_loader.load_scenario_by_name("email_agent_capability")
        
        assert scenario is not None
        assert scenario.name == "email_agent_evaluation"
        assert len(scenario.capability_scenarios) >= 1
        
        # Check email capability scenario
        email_capability = scenario.get_capability_scenario("send_email")
        assert email_capability is not None
        assert email_capability.capability_name == "send_email"
        assert len(email_capability.step_tests) >= 2  # Should have compose and send steps
        
        # Check step types
        step_types = [step.step_type for step in email_capability.step_tests]
        assert StepType.CODE_STEP in step_types
        assert StepType.TOOL_STEP in step_types
    
    def test_scenario_loader_validates_scenario_files(self, scenario_loader):
        """Test scenario loader validates scenario file structure."""
        # Validate existing scenario files
        for scenario_name in ["email_agent_capability", "web_search_capability"]:
            errors = scenario_loader.validate_scenario_file(scenario_name)
            assert len(errors) == 0, f"Validation errors in {scenario_name}: {errors}"
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("capability_name", ["send_email", "web_search", "csv_data_analysis"])
    async def test_evaluate_individual_capabilities_from_scenarios(
        self,
        evaluation_service,
        mock_agent_repository,
        scenario_loader,
        capability_name
    ):
        """Test evaluation of individual capabilities using JSON scenarios."""
        # Create a mock agent with the specific capability
        capabilities = {
            capability_name: {
                "name": capability_name,
                "description": f"Test capability for {capability_name}",
                "steps": [
                    {
                        "id": f"{capability_name}_step_1",
                        "type": "CODE_STEP",
                        "instructions": f"Execute {capability_name} step 1"
                    }
                ]
            }
        }
        
        config = AgentConfig(
            name=f"Test Agent for {capability_name}",
            capabilities=capabilities,
            organization_id=1,
            owner_id="user_123",
            api_key="test_key"
        )
        test_agent = Agent.create(config)
        
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = test_agent
        
        # Load scenarios for this capability
        capability_scenarios = scenario_loader.load_scenarios_for_capability(capability_name)
        
        if capability_scenarios:
            # Use first available scenario
            capability_scenario = capability_scenarios[0]
            
            # Create evaluation request
            request = EvaluateCapabilityRequest(
                agent_id=123,
                capability_name=capability_name,
                test_scenario=capability_scenario
            )
            
            # Execute evaluation
            result = await evaluation_service.evaluate_single_capability(request)
            
            # Verify results
            assert result.capability_name == capability_name
            assert result.status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED]
            
            print(f"[TEST] Capability '{capability_name}' evaluated: {result.status}")
        else:
            print(f"[TEST] No scenarios found for capability '{capability_name}', skipping")
    
    @pytest.mark.asyncio
    async def test_evaluation_performance_metrics(
        self,
        evaluation_service,
        mock_agent_repository,
        test_agent_with_search_capability
    ):
        """Test evaluation performance metrics calculation."""
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = test_agent_with_search_capability
        
        # Create evaluation request
        request = EvaluateAgentRequest(agent_id=123)
        
        # Execute evaluation
        result = await evaluation_service.evaluate_agent_capabilities(request)
        
        # Verify performance metrics
        metrics = result.performance_metrics
        
        assert metrics.total_capabilities >= 1
        assert metrics.total_steps >= 1
        assert metrics.total_execution_time_ms >= 0
        assert metrics.average_step_time_ms >= 0
        assert 0 <= metrics.capability_completion_rate <= 100
        assert 0 <= metrics.step_completion_rate <= 100
        assert metrics.successful_capabilities <= metrics.total_capabilities
        assert metrics.successful_steps <= metrics.total_steps
        
        print(f"[TEST] Performance metrics - Capabilities: {metrics.successful_capabilities}/{metrics.total_capabilities}, "
              f"Steps: {metrics.successful_steps}/{metrics.total_steps}")


class TestEvaluationFrameworkIntegration:
    """Test evaluation framework integration with existing systems."""
    
    @pytest.fixture
    def mock_agent_repository(self):
        """Mock agent repository."""
        return AsyncMock()
    
    @pytest.mark.asyncio
    async def test_evaluation_with_existing_agent_patterns(
        self,
        sample_agent,  # Using existing fixture from conftest.py
        mock_agent_repository
    ):
        """Test evaluation framework works with existing agent fixture patterns."""
        capability_parser = CapabilityParser()
        evaluation_service = AgentEvaluationApplicationService(
            agent_repository=mock_agent_repository,
            capability_parser=capability_parser
        )
        
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = sample_agent
        
        # Test with existing sample agent
        request = EvaluateAgentRequest(agent_id=sample_agent.id)
        
        # Should handle agents without structured capabilities gracefully
        result = await evaluation_service.evaluate_agent_capabilities(request)
        
        assert result is not None
        assert result.agent_id == sample_agent.id
    
    def test_scenario_loader_integration_with_test_structure(self):
        """Test scenario loader integrates well with existing test structure."""
        loader = TestScenarioLoader()
        
        # Should be able to find scenario files from test directory
        scenarios = loader.list_available_scenarios()
        assert len(scenarios) > 0
        
        # Should be able to load scenarios without errors
        for scenario_name in scenarios:
            scenario = loader.load_scenario_by_name(scenario_name)
            assert scenario is not None