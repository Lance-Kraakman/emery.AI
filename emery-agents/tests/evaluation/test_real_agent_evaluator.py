"""
Tests for Real Agent Evaluator

AIDEV-NOTE: Tests the integration between real agent execution and table-driven evaluation.
Shows how to test the actual evaluation flow with mock agent execution.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock
from typing import Dict, Any

from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.evaluation.entities.test_case import (
    create_custom_test_case, TestSuite, get_test_suite
)
from emery_agents.application.services.real_agent_evaluator import RealAgentEvaluator
from emery_agents.domain.agents.repositories.agent_execution_repository import (
    IAgentExecutionRepository, AgentExecutionRequest, AgentExecutionResult
)
from emery_agents.domain.agents.value_objects.agent_id import AgentId


class TestAgentExecutionRepository(IAgentExecutionRepository):
    """Test implementation of execution repository with predictable responses."""
    
    def __init__(self, mock_responses: Dict[str, Dict[str, Any]] = None):
        self.mock_responses = mock_responses or {}
        self.execution_count = 0
    
    async def execute_agent(self, request: AgentExecutionRequest) -> AgentExecutionResult:
        """Return predefined mock responses based on instructions."""
        self.execution_count += 1
        
        # Look for matching mock response
        for key, response in self.mock_responses.items():
            if key.lower() in request.instructions.lower():
                return AgentExecutionResult(
                    success=response.get("success", True),
                    execution_id=request.execution_id,
                    status="completed" if response.get("success", True) else "failed",
                    output_data=response,
                    error=response.get("error"),
                    duration_ms=response.get("execution_time_ms", 100)
                )
        
        # Default successful response
        return AgentExecutionResult(
            success=True,
            execution_id=request.execution_id,
            status="completed",
            output_data={
                "output": f"Task completed: {request.instructions}",
                "generated_code": f"# Generated code for: {request.instructions}\nresult = 'completed'"
            },
            duration_ms=100
        )
    
    async def cancel_execution(self, execution_id: str, reason: str = None):
        """Mock cancel execution."""
        pass
    
    async def get_execution_status(self, execution_id: str) -> str:
        """Mock get execution status."""
        return "completed"
    
    async def is_execution_available(self, organization_id: str) -> bool:
        """Mock availability check."""
        return True
    
    async def get_worker_health(self, organization_id: str) -> Dict[str, Any]:
        """Mock worker health."""
        return {"status": "healthy"}
    
    async def list_active_executions(self, organization_id) -> list[str]:
        """Mock list active executions."""
        return []
    
    async def get_execution_logs(self, execution_id: str) -> list[str]:
        """Mock get execution logs."""
        return []


@pytest.fixture
def test_agent():
    """Create test agent."""
    config = AgentConfig(
        name="Test Agent",
        description="Agent for testing evaluation",
        organization_id=1,
        owner_id="test_user"
    )
    agent = Agent.create(config)
    agent.id = 123
    return agent


@pytest.fixture
def mock_agent_repository(test_agent):
    """Create mock agent repository."""
    repo = AsyncMock()
    repo.find_by_id.return_value = test_agent
    return repo


class TestRealAgentEvaluator:
    """Test the real agent evaluator functionality."""
    
    @pytest.mark.asyncio
    async def test_single_test_case_execution_success(self, test_agent, mock_agent_repository):
        """Test successful execution of a single test case."""
        # Setup mock execution repository with specific response
        mock_execution_repo = TestAgentExecutionRepository({
            "pandas": {
                "success": True,
                "generated_code": "import pandas as pd\ndf = pd.DataFrame(data)\nstats = df.describe()",
                "output": "DataFrame created successfully",
                "variables_created": ["df", "stats"]
            }
        })
        
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Create test case
        test_case = create_custom_test_case(
            name="pandas_test",
            description="Test pandas DataFrame creation",
            instructions="Create a pandas DataFrame and calculate statistics",
            should_succeed=True,
            should_generate_code=True,
            expected_should_contain=["pandas", "DataFrame"],
            expected_should_have_variables=["df", "stats"]
        )
        
        # Execute evaluation
        result = await evaluator.evaluate_single_test_case(test_agent.id, test_case)
        
        # Verify results
        assert result.passed is True
        assert result.actual is not None
        assert result.actual.succeeded is True
        assert "pandas" in result.actual.generated_code
        assert "df" in result.actual.created_variables
        assert "stats" in result.actual.created_variables
        assert mock_execution_repo.execution_count == 1
    
    @pytest.mark.asyncio
    async def test_single_test_case_execution_failure(self, test_agent, mock_agent_repository):
        """Test handling of failed agent execution."""
        # Setup mock execution repository that returns failure
        mock_execution_repo = TestAgentExecutionRepository({
            "impossible": {
                "success": False,
                "error": "Task impossible to complete",
                "output": "Execution failed"
            }
        })
        
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Create test case that expects success (will fail evaluation)
        test_case = create_custom_test_case(
            name="impossible_task",
            description="Task that should fail",
            instructions="Do something impossible",
            should_succeed=True  # Expecting success but will get failure
        )
        
        # Execute evaluation
        result = await evaluator.evaluate_single_test_case(test_agent.id, test_case)
        
        # Verify failure is handled correctly
        assert result.passed is False
        assert result.failure_reason is not None
        assert "Expected success=True, got success=False" in result.failure_reason
        assert result.actual.succeeded is False
        assert result.actual.error_message == "Task impossible to complete"
    
    @pytest.mark.asyncio
    async def test_expected_failure_case(self, test_agent, mock_agent_repository):
        """Test that expected failures are marked as passing."""
        # Setup mock executor that returns failure
        mock_execution_repo = TestAgentExecutionRepository({
            "divide by zero": {
                "success": False,
                "error": "ZeroDivisionError: division by zero",
                "output": "Mathematical error"
            }
        })
        
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Create test case that expects failure
        test_case = create_custom_test_case(
            name="expected_failure",
            description="Task expected to fail",
            instructions="Divide by zero and return result",
            should_succeed=False  # We expect this to fail
        )
        
        # Execute evaluation
        result = await evaluator.evaluate_single_test_case(test_agent.id, test_case)
        
        # Verify expected failure is marked as pass
        assert result.passed is True
        assert result.actual.succeeded is False  # Task failed as expected
        assert "ZeroDivisionError" in result.actual.error_message
    
    @pytest.mark.asyncio
    async def test_tool_execution_validation(self, test_agent, mock_agent_repository):
        """Test validation of tool execution."""
        # Setup mock executor for tool usage
        mock_execution_repo = TestAgentExecutionRepository({
            "email": {
                "success": True,
                "tools_called": ["gmail_send"],
                "output": "Email sent successfully, message_id: test123",
                "tool_responses": [{"tool": "gmail_send", "result": {"message_id": "test123"}}]
            }
        })
        
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Create test case expecting specific tool usage
        test_case = create_custom_test_case(
            name="email_send_test",
            description="Test email sending with Gmail tool",
            instructions="Send an email using Gmail API",
            should_succeed=True,
            should_generate_code=False,
            should_call_tools=["gmail_send"],
            expected_should_contain=["sent", "message_id"]
        )
        
        # Execute evaluation
        result = await evaluator.evaluate_single_test_case(test_agent.id, test_case)
        
        # Verify tool usage validation
        assert result.passed is True
        assert "gmail_send" in result.actual.called_tools
        assert "sent" in result.actual.output_text
        assert "message_id" in result.actual.output_text
    
    @pytest.mark.asyncio
    async def test_test_suite_execution(self, test_agent, mock_agent_repository):
        """Test execution of complete test suite."""
        # Setup mock executor with responses for different tests
        mock_execution_repo = TestAgentExecutionRepository({
            "compose": {
                "success": True,
                "generated_code": "email_data = {'recipient': 'test@example.com', 'subject': 'Test', 'body': 'Hello'}\nrecipient = email_data['recipient']\nsubject = email_data['subject']\nbody = email_data['body']",
                "output": "Email composed with test@example.com, Test, Hello",
                "variables_created": ["email_data", "recipient", "subject", "body"]
            },
            "send": {
                "success": True,
                "tools_called": ["gmail_send"],
                "output": "Email sent successfully, message_id: suite_test_123"
            },
            "attachment": {
                "success": True,
                "tools_called": ["gmail_send"],
                "output": "Email with PDF attachment sent successfully"
            }
        })
        
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Get pre-defined email test suite
        email_suite = get_test_suite("email")
        
        # Execute full test suite
        report = await evaluator.evaluate_agent_with_test_suite(test_agent.id, email_suite)
        
        # Verify suite execution
        assert report.total_tests == 3
        assert report.passed_tests >= 2  # At least 2 should pass
        assert report.execution_time_ms > 0
        assert mock_execution_repo.execution_count == 3  # All tests executed
    
    @pytest.mark.asyncio
    async def test_custom_test_suite_execution(self, test_agent, mock_agent_repository):
        """Test execution of custom test suite."""
        # Setup mock executor for custom scenarios
        mock_execution_repo = TestAgentExecutionRepository({
            "data analysis": {
                "success": True,
                "generated_code": "import pandas as pd\ndf = pd.DataFrame(data)\nstats = df.describe()\nmean_val = df.mean()",
                "output": "Data analysis completed",
                "variables_created": ["df", "stats", "mean_val"]
            },
            "search": {
                "success": True,
                "tools_called": ["web_search"],
                "output": "Search completed, found Python programming results"
            },
            "impossible": {
                "success": False,
                "error": "Task cannot be completed",
                "output": "Failed as expected"
            }
        })
        
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Create custom test suite
        custom_tests = [
            create_custom_test_case(
                name="data_analysis",
                description="Analyze data with pandas",
                instructions="Load data and perform statistical analysis",
                should_succeed=True,
                should_generate_code=True,
                expected_should_contain=["pandas", "DataFrame"],
                expected_should_have_variables=["df", "stats"]
            ),
            create_custom_test_case(
                name="web_search",
                description="Search for information",
                instructions="Search for Python programming resources",
                should_succeed=True,
                should_call_tools=["web_search"],
                expected_should_contain=["Python", "results"]
            ),
            create_custom_test_case(
                name="expected_failure",
                description="Task that should fail",
                instructions="Do something impossible",
                should_succeed=False  # Expected failure
            )
        ]
        
        custom_suite = TestSuite(
            name="Custom Test Suite",
            description="Custom evaluation scenarios",
            test_cases=custom_tests
        )
        
        # Execute custom suite
        report = await evaluator.evaluate_agent_with_test_suite(test_agent.id, custom_suite)
        
        # Verify custom suite results
        assert report.total_tests == 3
        assert report.passed_tests == 3  # All should pass (including expected failure)
        assert report.success_rate == 100.0
        assert mock_execution_repo.execution_count == 3
    
    @pytest.mark.asyncio
    async def test_agent_not_found_error(self, mock_agent_repository):
        """Test error handling when agent is not found."""
        mock_agent_repository.find_by_id.return_value = None
        mock_execution_repo = TestAgentExecutionRepository()
        
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        test_case = create_custom_test_case(
            name="test",
            description="Test case",
            instructions="Do something",
            should_succeed=True
        )
        
        # Should raise error for non-existent agent
        with pytest.raises(ValueError, match="Agent 999 not found"):
            await evaluator.evaluate_single_test_case(999, test_case)
    
    def test_variable_extraction_from_code(self, test_agent, mock_agent_repository):
        """Test extraction of variables from generated code."""
        mock_execution_repo = TestAgentExecutionRepository()
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Test AST-based extraction
        code = """
import pandas as pd
df = pd.DataFrame(data)
result = df.describe()
stats = result.copy()
"""
        variables = evaluator._extract_variables_from_code(code)
        expected_vars = ["df", "result", "stats"]
        
        for var in expected_vars:
            assert var in variables
    
    def test_variable_extraction_with_syntax_error(self, test_agent, mock_agent_repository):
        """Test variable extraction with invalid syntax (fallback to regex)."""
        mock_execution_repo = TestAgentExecutionRepository()
        evaluator = RealAgentEvaluator(mock_agent_repository, mock_execution_repo)
        
        # Code with syntax error
        invalid_code = "result = something invalid syntax )))"
        variables = evaluator._extract_variables_from_code(invalid_code)
        
        # Should still find 'result' using regex fallback
        assert "result" in variables


if __name__ == "__main__":
    pytest.main([__file__, "-v"])