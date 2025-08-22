"""
Real Agent Evaluator

AIDEV-NOTE: Evaluator that runs actual agent tasks and validates results using the simple evaluation platform.
Connects the table-driven testing with real agent execution via DDD infrastructure.
"""

from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime

from ...domain.agents.entities.agent import Agent
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.repositories.agent_execution_repository import (
    IAgentExecutionRepository, AgentExecutionRequest, AgentExecutionResult
)
from ...domain.agents.value_objects.agent_id import AgentId
from ...domain.evaluation.entities.test_case import TestCase, TestSuite, ActualResult
from ...domain.evaluation.services.simple_evaluator import SimpleEvaluator, EvaluationReport


class RealAgentEvaluator:
    """
    Evaluator that runs actual agent tasks and validates using simple evaluation platform.
    
    AIDEV-NOTE: This is the bridge between real agent execution and table-driven testing.
    Now uses the DDD IAgentExecutionRepository for real smolagents execution.
    """
    
    def __init__(
        self,
        agent_repository: IAgentRepository,
        execution_repository: IAgentExecutionRepository  # DDD execution repository
    ):
        self.agent_repository = agent_repository
        self.execution_repository = execution_repository
        self.simple_evaluator = SimpleEvaluator()
    
    async def evaluate_agent_with_test_suite(
        self, 
        agent_id: int, 
        test_suite: TestSuite
    ) -> EvaluationReport:
        """
        Run a complete test suite against a real agent.
        
        Args:
            agent_id: ID of agent to test
            test_suite: Test suite to run
            
        Returns:
            Evaluation report with actual vs expected results
        """
        print(f"🚀 Running real evaluation: {test_suite.name} with agent {agent_id}")
        
        # Load agent
        agent = await self.agent_repository.find_by_id(AgentId(agent_id))
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Execute each test case
        actual_results = []
        for i, test_case in enumerate(test_suite.test_cases):
            print(f"  📝 Running test {i+1}/{len(test_suite.test_cases)}: {test_case.name}")
            
            # Execute the task with the real agent using DDD execution repository
            execution_request = AgentExecutionRequest(
                agent_id=AgentId(agent_id),
                instructions=test_case.input.instructions,
                execution_id=f"eval_{agent_id}_{i}_{int(datetime.now().timestamp())}"
            )
            
            execution_result = await self.execution_repository.execute_agent(execution_request)
            
            # Convert to ActualResult for evaluation
            actual_result = self._convert_to_actual_result(execution_result, test_case)
            actual_results.append(actual_result)
            
            # Print intermediate result
            status = "✅" if actual_result.succeeded else "❌"
            print(f"    {status} Execution: {execution_result.duration_ms or 0}ms")
        
        # Evaluate using simple evaluator
        report = self.simple_evaluator.evaluate_test_suite(test_suite, actual_results)
        
        print(f"\n📊 Evaluation complete: {report.success_rate:.1f}% success rate")
        return report
    
    async def evaluate_single_test_case(
        self, 
        agent_id: int, 
        test_case: TestCase
    ) -> TestCase:
        """
        Run a single test case against a real agent.
        
        Args:
            agent_id: ID of agent to test
            test_case: Single test case to run
            
        Returns:
            TestCase with actual results and pass/fail status
        """
        print(f"🔬 Running single test: {test_case.name} with agent {agent_id}")
        
        # Load agent
        agent = await self.agent_repository.find_by_id(AgentId(agent_id))
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Execute the task using DDD execution repository
        execution_request = AgentExecutionRequest(
            agent_id=AgentId(agent_id),
            instructions=test_case.input.instructions,
            execution_id=f"eval_{agent_id}_{int(datetime.now().timestamp())}"
        )
        
        execution_result = await self.execution_repository.execute_agent(execution_request)
        
        # Convert to ActualResult and evaluate
        actual_result = self._convert_to_actual_result(execution_result, test_case)
        evaluated_case = self.simple_evaluator.evaluate_test_case(test_case, actual_result)
        
        status = "✅ PASS" if evaluated_case.passed else f"❌ FAIL: {evaluated_case.failure_reason}"
        print(f"  {status}")
        
        return evaluated_case
    
    def _convert_to_actual_result(
        self, 
        execution_result: AgentExecutionResult,
        test_case: TestCase
    ) -> ActualResult:
        """Convert DDD AgentExecutionResult to ActualResult for evaluation."""
        
        # Extract generated code from output_data if available
        generated_code = None
        output_text = ""
        called_tools = []
        created_variables = []
        
        if execution_result.output_data:
            output_data = execution_result.output_data
            if isinstance(output_data, dict):
                generated_code = output_data.get("generated_code")
                output_text = output_data.get("output", "")
                called_tools = output_data.get("tools_called", [])
                created_variables = output_data.get("variables_created", [])
            else:
                output_text = str(output_data)
        
        # Extract variables from generated code if available
        if generated_code:
            extracted_vars = self._extract_variables_from_code(generated_code)
            created_variables.extend(extracted_vars)
        
        return ActualResult(
            succeeded=execution_result.success,
            execution_time_ms=execution_result.duration_ms or 0,
            generated_code=generated_code,
            called_tools=called_tools,
            created_variables=list(set(created_variables)),  # Remove duplicates
            output_text=output_text,
            error_message=execution_result.error
        )
    
    def _extract_variables_from_code(self, code: str) -> List[str]:
        """Extract variable names from generated code."""
        import re
        import ast
        
        variables = []
        
        try:
            # Use AST parsing for accurate extraction
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            variables.append(target.id)
        except SyntaxError:
            # Fallback to regex if AST parsing fails
            pattern = r'(\w+)\s*='
            variables = re.findall(pattern, code)
        
        return list(set(variables))