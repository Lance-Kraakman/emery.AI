#!/usr/bin/env python3
"""
Real Agent Evaluation Demo

AIDEV-NOTE: Demonstrates how to run actual agent evaluations with real task execution.
Shows the complete flow from test definition to real execution to validation.
"""

import asyncio
from typing import Dict, Any
from unittest.mock import AsyncMock

from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.evaluation.entities.test_case import (
    get_test_suite, create_custom_test_case, TestSuite
)
from emery_agents.application.services.real_agent_evaluator import (
    RealAgentEvaluator, IAgentExecutor
)


class MockAgentExecutor(IAgentExecutor):
    """
    Mock implementation of agent executor for demonstration.
    
    AIDEV-NOTE: Replace this with your actual agent execution system.
    This could be a gRPC client, HTTP client, or direct library integration.
    """
    
    async def execute_task(
        self, 
        agent: Agent, 
        instructions: str, 
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Mock task execution that simulates real agent behavior."""
        
        print(f"    🤖 Agent '{agent.name}' executing: {instructions[:60]}...")
        
        # Simulate processing time
        await asyncio.sleep(0.2)
        
        instructions_lower = instructions.lower()
        
        # Simulate different execution outcomes based on instructions
        if "email" in instructions_lower and "compose" in instructions_lower:
            return {
                "success": True,
                "generated_code": """
# Email composition code
email_data = {
    'recipient': 'test@example.com',
    'subject': 'Test Email Subject',
    'body': 'Hello World from the agent!'
}
recipient = email_data['recipient']
subject = email_data['subject'] 
body = email_data['body']
print(f"Email composed for {recipient} with subject: {subject}")
                """.strip(),
                "output": "Email composition completed successfully with test@example.com, Test Email Subject, Hello World from the agent!",
                "variables_created": ["email_data", "recipient", "subject", "body"]
            }
        
        elif "email" in instructions_lower and "send" in instructions_lower:
            return {
                "success": True,
                "tools_called": ["gmail_send"],
                "output": "Email sent successfully, message_id: msg_demo_12345",
                "tool_responses": [
                    {
                        "tool": "gmail_send",
                        "result": {"message_id": "msg_demo_12345", "status": "sent"}
                    }
                ]
            }
        
        elif "pandas" in instructions_lower or "dataframe" in instructions_lower:
            if "statistics" in instructions_lower or "mean" in instructions_lower:
                return {
                    "success": True,
                    "generated_code": """
import pandas as pd
# Calculate statistics
data = [25, 30, 28, 35, 27]
df = pd.DataFrame({'age': data})
stats = df.describe()
mean_age = df['age'].mean()
median_age = df['age'].median()
print(f"Mean age: {mean_age}, Median age: {median_age}")
                    """.strip(),
                    "output": "Statistical analysis completed with mean, median calculations",
                    "variables_created": ["data", "df", "stats", "mean_age", "median_age"]
                }
            else:
                return {
                    "success": True,
                    "generated_code": """
import pandas as pd
df = pd.DataFrame(csv_data)
data = df.copy()
print(f"DataFrame loaded with shape: {df.shape}")
                    """.strip(),
                    "output": "DataFrame created successfully from CSV data",
                    "variables_created": ["df", "data"]
                }
        
        elif "search" in instructions_lower:
            return {
                "success": True,
                "tools_called": ["web_search"],
                "output": "Search completed, found Python best practices results",
                "tool_responses": [
                    {
                        "tool": "web_search", 
                        "result": {
                            "results": [
                                {"title": "Python Best Practices Guide", "url": "https://python.org/guide"},
                                {"title": "Clean Code in Python", "url": "https://github.com/python-guide"}
                            ]
                        }
                    }
                ]
            }
        
        elif "impossible" in instructions_lower or "divide by zero" in instructions_lower:
            # Simulate a failure case
            return {
                "success": False,
                "error": "ZeroDivisionError: division by zero",
                "output": "Task failed due to mathematical error"
            }
        
        else:
            # Default success case
            return {
                "success": True,
                "generated_code": f"# Task: {instructions}\nresult = 'completed'\nprint('Task finished successfully')",
                "output": f"Generic task completed: {instructions}",
                "variables_created": ["result"]
            }


async def demo_email_capability_evaluation():
    """Demonstrate evaluating email capability with real agent execution."""
    print("📧 DEMO 1: Real Email Capability Evaluation")
    print("=" * 60)
    
    # Create mock agent
    agent_config = AgentConfig(
        name="Email Agent",
        description="Agent specialized in email operations", 
        organization_id=1,
        owner_id="demo_user"
    )
    test_agent = Agent.create(agent_config)
    test_agent.id = 123  # Mock ID
    
    # Setup evaluator with mocks
    mock_agent_repo = AsyncMock()
    mock_agent_repo.find_by_id.return_value = test_agent
    
    mock_executor = MockAgentExecutor()
    evaluator = RealAgentEvaluator(mock_agent_repo, mock_executor)
    
    # Get pre-defined email test suite
    email_suite = get_test_suite("email")
    print(f"Running {email_suite.total_tests} email tests with real execution...\n")
    
    # Run the evaluation
    report = await evaluator.evaluate_agent_with_test_suite(test_agent.id, email_suite)
    
    # Print detailed results
    evaluator.simple_evaluator.print_evaluation_report(report)


async def demo_custom_evaluation_scenario():
    """Demonstrate creating and running custom evaluation scenarios."""
    print("\n🔬 DEMO 2: Custom Real Evaluation Scenario")
    print("=" * 60)
    
    # Create custom test cases for specific scenarios you want to test
    custom_tests = [
        create_custom_test_case(
            name="data_analysis_workflow",
            description="Complete data analysis workflow with pandas",
            instructions="Load CSV data, calculate descriptive statistics (mean, median), and analyze the results",
            should_succeed=True,
            should_generate_code=True,
            expected_should_contain=["pandas", "mean", "median", "statistics"],
            expected_should_have_variables=["df", "stats", "mean_age", "median_age"]
        ),
        
        create_custom_test_case(
            name="web_research_task", 
            description="Research Python best practices online",
            instructions="Search for 'Python programming best practices' and return the top results",
            should_succeed=True,
            should_generate_code=False,
            should_call_tools=["web_search"],
            expected_should_contain=["Python", "results", "practices"]
        ),
        
        create_custom_test_case(
            name="expected_failure_case",
            description="Task that should fail gracefully",
            instructions="Perform an impossible mathematical operation: divide 10 by zero and return the result",
            should_succeed=False  # We expect this to fail
        )
    ]
    
    custom_suite = TestSuite(
        name="Custom Real Agent Tests",
        description="Custom scenarios with real agent execution",
        test_cases=custom_tests
    )
    
    # Setup agent and evaluator
    agent_config = AgentConfig(
        name="Multi-Purpose Agent",
        description="Agent capable of various tasks",
        organization_id=1,
        owner_id="demo_user"
    )
    test_agent = Agent.create(agent_config)
    test_agent.id = 456
    
    mock_agent_repo = AsyncMock()
    mock_agent_repo.find_by_id.return_value = test_agent
    
    evaluator = RealAgentEvaluator(mock_agent_repo, MockAgentExecutor())
    
    print(f"Running {custom_suite.total_tests} custom tests with real execution...\n")
    
    # Run evaluation
    report = await evaluator.evaluate_agent_with_test_suite(test_agent.id, custom_suite)
    evaluator.simple_evaluator.print_evaluation_report(report)


async def demo_single_test_execution():
    """Demonstrate running and debugging a single test case."""
    print("\n🔍 DEMO 3: Single Test Case Debugging")
    print("=" * 60)
    
    # Create a specific test case to debug
    debug_test = create_custom_test_case(
        name="pandas_statistics_debug",
        description="Debug pandas statistics calculation",
        instructions="Load data into pandas DataFrame and calculate mean, median, and standard deviation for the age column",
        should_succeed=True,
        should_generate_code=True,
        expected_should_contain=["pandas", "DataFrame", "mean", "median"],
        expected_should_have_variables=["df", "stats", "mean_age", "median_age"]
    )
    
    # Setup agent
    agent_config = AgentConfig(
        name="Data Analysis Agent",
        description="Specialized in data analysis tasks",
        organization_id=1,
        owner_id="debug_user"
    )
    debug_agent = Agent.create(agent_config) 
    debug_agent.id = 789
    
    mock_agent_repo = AsyncMock()
    mock_agent_repo.find_by_id.return_value = debug_agent
    
    evaluator = RealAgentEvaluator(mock_agent_repo, MockAgentExecutor())
    
    print("Running single test for detailed debugging...\n")
    
    # Run single test
    result = await evaluator.evaluate_single_test_case(debug_agent.id, debug_test)
    
    print(f"\n🔍 DETAILED RESULTS:")
    print(f"Test Name: {result.name}")
    print(f"Description: {result.description}")
    print(f"Status: {'✅ PASSED' if result.passed else '❌ FAILED'}")
    if result.failure_reason:
        print(f"Failure Reason: {result.failure_reason}")
    
    if result.actual:
        print(f"Execution Time: {result.actual.execution_time_ms}ms")
        print(f"Generated Code Preview:")
        if result.actual.generated_code:
            code_lines = result.actual.generated_code.split('\n')[:5]
            for i, line in enumerate(code_lines):
                print(f"  {i+1}: {line}")
            if len(result.actual.generated_code.split('\n')) > 5:
                print("  ...")
        print(f"Created Variables: {result.actual.created_variables}")
        print(f"Called Tools: {result.actual.called_tools}")


async def demo_connecting_to_real_system():
    """Show how to connect this to your real agent execution system."""
    print("\n🔌 DEMO 4: Connecting to Real Agent System")
    print("=" * 60)
    
    print("""
To connect this evaluation system to your real agent execution:

1. IMPLEMENT IAgentExecutor INTERFACE:
   
   class YourAgentExecutor(IAgentExecutor):
       def __init__(self, grpc_client_or_api_client):
           self.client = grpc_client_or_api_client
       
       async def execute_task(self, agent: Agent, instructions: str, context: Dict = None):
           # Make actual call to your agent system:
           # - gRPC call to agent worker
           # - HTTP API call  
           # - Direct smolagents execution
           # - etc.
           
           response = await self.client.execute_agent_task(
               agent_id=agent.id,
               instructions=instructions,
               context=context
           )
           
           return {
               "success": response.success,
               "generated_code": response.generated_code,
               "tools_called": response.tools_used,
               "output": response.output_text,
               "error": response.error_message
           }

2. USE WITH REAL AGENT REPOSITORY:
   
   real_agent_repo = YourAgentRepository()  # Your actual repo
   real_executor = YourAgentExecutor(your_grpc_client)
   
   evaluator = RealAgentEvaluator(real_agent_repo, real_executor)

3. RUN REAL EVALUATIONS:
   
   # Test specific agent
   email_suite = get_test_suite("email")
   report = await evaluator.evaluate_agent_with_test_suite(123, email_suite)
   
   # Custom scenarios
   custom_tests = [create_custom_test_case(...)]
   custom_suite = TestSuite("My Tests", "Custom test suite", custom_tests)
   report = await evaluator.evaluate_agent_with_test_suite(456, custom_suite)

4. INTEGRATION WITH CI/CD:
   
   # In your test pipeline
   async def test_production_agents():
       for agent_id in production_agent_ids:
           report = await evaluator.evaluate_agent_with_test_suite(
               agent_id, get_test_suite("core_capabilities")
           )
           assert report.success_rate >= 90.0, f"Agent {agent_id} below quality threshold"

The evaluation framework provides:
✅ Clear pass/fail results for each capability
✅ Detailed failure analysis for debugging
✅ Performance metrics and timing
✅ Easy integration with existing systems
✅ Table-driven test definitions
✅ Beautiful reporting for stakeholders
    """)


async def main():
    """Run all evaluation demos."""
    print("🚀 REAL AGENT EVALUATION SYSTEM DEMO")
    print("=" * 80)
    print("Demonstrating actual agent task execution with validation")
    print("=" * 80)
    
    await demo_email_capability_evaluation()
    await demo_custom_evaluation_scenario() 
    await demo_single_test_execution()
    await demo_connecting_to_real_system()
    
    print("\n" + "=" * 80)
    print("✨ REAL EVALUATION SYSTEM READY!")
    print("=" * 80)
    print("You now have:")
    print("• Real agent task execution with validation")
    print("• Clear pass/fail results for debugging") 
    print("• Pre-defined test suites for common capabilities")
    print("• Custom test scenarios for specific needs")
    print("• Integration interface for your agent execution system")
    print("• Production-ready evaluation pipeline")
    print("\nReady to evaluate your agents! 🎉")


if __name__ == "__main__":
    asyncio.run(main())