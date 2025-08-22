"""
Integration Test for Real Evaluation → SmolAgents Execution Flow

AIDEV-NOTE: Tests the complete integration from table-driven evaluation tests
through DDD execution repository to real smolagents execution.
"""

import pytest
import os
from unittest.mock import AsyncMock

from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.evaluation.entities.test_case import (
    create_custom_test_case, TestSuite
)
from emery_agents.application.services.real_agent_evaluator import RealAgentEvaluator
from emery_agents.application.di.agent_container import create_agent_container


class TestRealEvaluationFlow:
    """Test complete evaluation → real smolagents execution flow."""
    
    @pytest.mark.asyncio
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required for real execution")
    async def test_complete_evaluation_to_smolagents_flow(self):
        """
        Test complete flow: Evaluation → DDD Repository → SmolAgents execution.
        
        AIDEV-NOTE: This tests the actual integration without mocks.
        Requires HF_TOKEN environment variable.
        """
        # Create agent container with real dependencies
        container = create_agent_container()
        
        # Create test agent
        agent_config = AgentConfig(
            name="Test Agent for Real Execution",
            description="Agent for testing real smolagents execution",
            organization_id=1,
            owner_id="test_user"
        )
        test_agent = Agent.create(agent_config)
        test_agent.id = 123
        
        # Mock agent repository to return our test agent
        mock_agent_repo = AsyncMock()
        mock_agent_repo.find_by_id.return_value = test_agent
        
        # Use real execution repository from container
        real_execution_repo = container.execution_repository()
        
        # Create evaluator with real execution
        evaluator = RealAgentEvaluator(mock_agent_repo, real_execution_repo)
        
        # Create simple test case for real execution
        test_case = create_custom_test_case(
            name="simple_python_task",
            description="Simple Python task to test real execution",
            instructions="Create a variable x with value 42 and print it",
            should_succeed=True,
            should_generate_code=True,
            expected_should_contain=["42", "print"],
            expected_should_have_variables=["x"]
        )
        
        # Execute evaluation with real smolagents
        result = await evaluator.evaluate_single_test_case(test_agent.id, test_case)
        
        # Verify results
        assert result is not None
        assert result.passed is True, f"Test failed: {result.failure_reason}"
        assert result.actual is not None
        assert result.actual.succeeded is True
        
        # The actual execution should produce some output
        assert result.actual.output_text is not None
        print(f"✅ Real execution output: {result.actual.output_text}")
        
        if result.actual.generated_code:
            print(f"Generated code: {result.actual.generated_code}")
    
    @pytest.mark.asyncio 
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required for real execution")
    async def test_evaluation_with_simple_test_suite(self):
        """Test evaluation with a simple test suite using real execution."""
        
        # Create agent container
        container = create_agent_container()
        
        # Create test agent
        agent_config = AgentConfig(
            name="Test Suite Agent",
            description="Agent for testing with test suite",
            organization_id=1,
            owner_id="test_user"
        )
        test_agent = Agent.create(agent_config)
        test_agent.id = 456
        
        # Mock agent repository
        mock_agent_repo = AsyncMock()
        mock_agent_repo.find_by_id.return_value = test_agent
        
        # Use real execution repository
        real_execution_repo = container.execution_repository()
        
        # Create evaluator
        evaluator = RealAgentEvaluator(mock_agent_repo, real_execution_repo)
        
        # Create simple test suite
        test_cases = [
            create_custom_test_case(
                name="variable_creation",
                description="Create and use variables",
                instructions="Create variables a=1, b=2, and c=a+b",
                should_succeed=True,
                should_generate_code=True,
                expected_should_have_variables=["a", "b", "c"]
            ),
            create_custom_test_case(
                name="simple_calculation",
                description="Perform basic calculation",
                instructions="Calculate 10 * 5 and store in result variable",
                should_succeed=True,
                should_generate_code=True,
                expected_should_contain=["10", "5", "*"],
                expected_should_have_variables=["result"]
            )
        ]
        
        test_suite = TestSuite(
            name="Simple Math Test Suite",
            description="Basic math operations with real execution",
            test_cases=test_cases
        )
        
        # Execute test suite with real smolagents
        report = await evaluator.evaluate_agent_with_test_suite(test_agent.id, test_suite)
        
        # Verify results
        assert report is not None
        assert report.total_tests == 2
        assert report.passed_tests >= 1, "At least one test should pass with real execution"
        assert report.success_rate >= 50.0, "At least 50% success rate expected"
        
        print(f"✅ Test suite results: {report.passed_tests}/{report.total_tests} passed ({report.success_rate:.1f}%)")
        
        # Print individual test results for debugging
        for i, test_case in enumerate(test_suite.test_cases):
            if hasattr(test_case, 'passed') and hasattr(test_case, 'actual'):
                status = "✅ PASS" if test_case.passed else "❌ FAIL"
                print(f"  {status} {test_case.name}: {test_case.actual.output_text[:100] if test_case.actual.output_text else 'No output'}")
    
    @pytest.mark.asyncio
    async def test_evaluation_with_mock_execution(self):
        """Test evaluation flow with mock execution for comparison."""
        from tests.evaluation.test_real_agent_evaluator import TestAgentExecutionRepository
        
        # Create test agent
        agent_config = AgentConfig(
            name="Mock Test Agent",
            description="Agent for testing with mock execution",
            organization_id=1,
            owner_id="test_user"
        )
        test_agent = Agent.create(agent_config)
        test_agent.id = 789
        
        # Mock agent repository
        mock_agent_repo = AsyncMock()
        mock_agent_repo.find_by_id.return_value = test_agent
        
        # Mock execution repository with predictable responses
        mock_execution_repo = TestAgentExecutionRepository({
            "variable": {
                "success": True,
                "generated_code": "x = 42\nprint(x)",
                "output": "42",
                "variables_created": ["x"]
            }
        })
        
        # Create evaluator with mock execution
        evaluator = RealAgentEvaluator(mock_agent_repo, mock_execution_repo)
        
        # Create test case
        test_case = create_custom_test_case(
            name="mock_variable_test",
            description="Test with mock execution",
            instructions="Create variable x with value 42",
            should_succeed=True,
            should_generate_code=True,
            expected_should_contain=["42"],
            expected_should_have_variables=["x"]
        )
        
        # Execute evaluation
        result = await evaluator.evaluate_single_test_case(test_agent.id, test_case)
        
        # Verify mock execution works
        assert result.passed is True
        assert result.actual.succeeded is True
        assert "x" in result.actual.created_variables
        assert "42" in result.actual.generated_code
        assert mock_execution_repo.execution_count == 1
        
        print("✅ Mock execution test passed - evaluation system working correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])