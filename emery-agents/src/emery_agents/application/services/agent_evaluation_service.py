"""
Agent Evaluation Application Service

AIDEV-NOTE: Application service for orchestrating agent capability evaluation.
Coordinates between domain services, repositories, and external integrations.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

from ...domain.agents.entities.agent import Agent
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.evaluation.entities.test_scenario import (
    TestScenario, 
    CapabilityTestScenario, 
    StepTestScenario,
    StepType
)
from ...domain.evaluation.entities.evaluation_result import (
    EvaluationResult,
    CapabilityExecutionResult,
    StepExecutionResult,
    ExecutionStatus,
    StepExecutionStatus,
    EvaluationError,
    ValidationResult
)
from ...domain.evaluation.services.capability_parser import CapabilityParser
from ...domain.evaluation.services.code_step_evaluator import CodeStepEvaluator
from ...domain.evaluation.services.tool_step_evaluator import ToolStepEvaluator


@dataclass
class EvaluateAgentRequest:
    """Request to evaluate agent capabilities."""
    agent_id: int
    test_scenario_id: Optional[str] = None  # If None, generate basic scenarios
    capability_names: Optional[List[str]] = None  # Test specific capabilities only
    parallel_execution: bool = False
    timeout_seconds: int = 300


@dataclass
class EvaluateCapabilityRequest:
    """Request to evaluate single capability."""
    agent_id: int
    capability_name: str
    test_scenario: CapabilityTestScenario
    timeout_seconds: int = 60


class AgentEvaluationApplicationService:
    """Application service for agent capability evaluation."""
    
    def __init__(
        self,
        agent_repository: IAgentRepository,
        capability_parser: CapabilityParser
    ):
        self.agent_repository = agent_repository
        self.capability_parser = capability_parser
        self.code_step_evaluator = CodeStepEvaluator()
        self.tool_step_evaluator = ToolStepEvaluator()
    
    async def evaluate_agent_capabilities(
        self, 
        request: EvaluateAgentRequest
    ) -> EvaluationResult:
        """
        Evaluate all or specified capabilities of an agent.
        
        AIDEV-NOTE: Main orchestration method for agent evaluation.
        Handles both custom test scenarios and auto-generated basic tests.
        """
        print(f"[EVALUATION] Starting evaluation for agent {request.agent_id}")
        
        # 1. Load and validate agent
        agent = await self.agent_repository.find_by_id(request.agent_id)
        if not agent:
            raise ValueError(f"Agent {request.agent_id} not found")
        
        agent.validate_for_execution()
        
        # 2. Create evaluation result
        evaluation_result = EvaluationResult.create(
            agent_id=request.agent_id,
            test_scenario_id=request.test_scenario_id or "auto-generated",
            test_suite_name="Agent Capability Evaluation"
        )
        
        try:
            # 3. Get or generate test scenarios
            if request.test_scenario_id:
                # TODO: Load test scenario from repository
                capability_scenarios = await self._load_test_scenarios(request.test_scenario_id)
            else:
                # Generate basic scenarios from agent capabilities
                capability_scenarios = await self._generate_basic_scenarios(agent, request.capability_names)
            
            if not capability_scenarios:
                evaluation_result.add_error(EvaluationError(
                    error_type="configuration_error",
                    message="No test scenarios found or generated for agent",
                    timestamp=datetime.utcnow()
                ))
                evaluation_result.complete_evaluation(ExecutionStatus.FAILED)
                return evaluation_result
            
            print(f"[EVALUATION] Found {len(capability_scenarios)} capability scenarios to test")
            
            # 4. Execute capability evaluations
            if request.parallel_execution:
                # TODO: Implement parallel execution
                await self._execute_capabilities_sequentially(agent, capability_scenarios, evaluation_result)
            else:
                await self._execute_capabilities_sequentially(agent, capability_scenarios, evaluation_result)
            
            # 5. Complete evaluation
            evaluation_result.complete_evaluation(ExecutionStatus.COMPLETED)
            
            print(f"[EVALUATION] Completed evaluation for agent {request.agent_id}")
            print(f"[EVALUATION] Success rate: {evaluation_result.overall_success_rate:.1f}%")
            
            return evaluation_result
            
        except Exception as e:
            print(f"[EVALUATION] Error during evaluation: {e}")
            evaluation_result.add_error(EvaluationError(
                error_type="execution_error",
                message=str(e),
                timestamp=datetime.utcnow()
            ))
            evaluation_result.complete_evaluation(ExecutionStatus.FAILED)
            return evaluation_result
    
    async def evaluate_single_capability(
        self,
        request: EvaluateCapabilityRequest
    ) -> CapabilityExecutionResult:
        """
        Evaluate single capability with detailed step analysis.
        
        AIDEV-NOTE: Focused evaluation for debugging specific capabilities.
        """
        print(f"[EVALUATION] Evaluating capability '{request.capability_name}' for agent {request.agent_id}")
        
        # 1. Load and validate agent
        agent = await self.agent_repository.find_by_id(request.agent_id)
        if not agent:
            raise ValueError(f"Agent {request.agent_id} not found")
        
        agent.validate_for_execution()
        
        # 2. Execute capability evaluation
        start_time = datetime.utcnow()
        
        try:
            capability_result = await self._execute_single_capability(
                agent, 
                request.test_scenario,
                request.timeout_seconds
            )
            
            print(f"[EVALUATION] Capability '{request.capability_name}' completed: {capability_result.status}")
            return capability_result
            
        except Exception as e:
            print(f"[EVALUATION] Error evaluating capability '{request.capability_name}': {e}")
            
            end_time = datetime.utcnow()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            
            return CapabilityExecutionResult(
                capability_name=request.capability_name,
                status=ExecutionStatus.FAILED,
                execution_time_ms=execution_time,
                step_results=[],
                error_message=str(e),
                started_at=start_time,
                completed_at=end_time
            )
    
    async def _load_test_scenarios(self, test_scenario_id: str) -> List[CapabilityTestScenario]:
        """Load test scenarios from repository or file system."""
        # TODO: Implement test scenario repository
        # For now, return empty list to trigger auto-generation
        return []
    
    async def _generate_basic_scenarios(
        self, 
        agent: Agent, 
        capability_names: Optional[List[str]]
    ) -> List[CapabilityTestScenario]:
        """Generate basic test scenarios from agent capabilities."""
        print("[EVALUATION] Generating basic test scenarios from agent capabilities")
        
        # 1. Parse agent capabilities
        parsed_capabilities = self.capability_parser.extract_capabilities(agent)
        
        if not parsed_capabilities:
            print("[EVALUATION] No capabilities found in agent configuration")
            return []
        
        print(f"[EVALUATION] Found {len(parsed_capabilities)} capabilities")
        for cap in parsed_capabilities:
            print(f"[EVALUATION] - {cap.name}: {len(cap.steps)} steps")
        
        # 2. Filter capabilities if requested
        if capability_names:
            parsed_capabilities = [
                cap for cap in parsed_capabilities 
                if cap.name in capability_names
            ]
        
        # 3. Generate test scenarios
        test_scenarios = self.capability_parser.generate_basic_test_scenarios(parsed_capabilities)
        
        return test_scenarios
    
    async def _execute_capabilities_sequentially(
        self,
        agent: Agent,
        capability_scenarios: List[CapabilityTestScenario],
        evaluation_result: EvaluationResult
    ) -> None:
        """Execute capability tests sequentially."""
        for scenario in capability_scenarios:
            print(f"[EVALUATION] Executing capability: {scenario.capability_name}")
            
            capability_result = await self._execute_single_capability(
                agent, 
                scenario,
                scenario.timeout_seconds
            )
            
            evaluation_result.add_capability_result(capability_result)
            
            print(f"[EVALUATION] Capability '{scenario.capability_name}' result: {capability_result.status}")
    
    async def _execute_single_capability(
        self,
        agent: Agent,
        scenario: CapabilityTestScenario,
        timeout_seconds: int
    ) -> CapabilityExecutionResult:
        """Execute single capability test scenario."""
        start_time = datetime.utcnow()
        step_results = []
        
        try:
            # Execute each step in the capability
            for step_scenario in scenario.step_tests:
                print(f"[EVALUATION] Executing step: {step_scenario.step_id}")
                
                step_result = await self._execute_single_step(
                    agent,
                    step_scenario,
                    scenario.input_data
                )
                
                step_results.append(step_result)
                
                print(f"[EVALUATION] Step '{step_scenario.step_id}' result: {step_result.status}")
                
                # If step failed critically, stop capability execution
                if step_result.status == StepExecutionStatus.FAILED:
                    print(f"[EVALUATION] Critical step failure, stopping capability execution")
                    break
            
            # Calculate success rate
            successful_steps = sum(1 for step in step_results if step.status == StepExecutionStatus.COMPLETED)
            success_rate = (successful_steps / len(step_results) * 100) if step_results else 0
            
            # Determine overall capability status
            if success_rate == 100:
                status = ExecutionStatus.COMPLETED
            elif success_rate > 0:
                status = ExecutionStatus.COMPLETED  # Partial success still counts as completed
            else:
                status = ExecutionStatus.FAILED
            
            end_time = datetime.utcnow()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            
            return CapabilityExecutionResult(
                capability_name=scenario.capability_name,
                status=status,
                execution_time_ms=execution_time,
                step_results=step_results,
                success_rate=success_rate,
                started_at=start_time,
                completed_at=end_time
            )
            
        except Exception as e:
            end_time = datetime.utcnow()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            
            return CapabilityExecutionResult(
                capability_name=scenario.capability_name,
                status=ExecutionStatus.FAILED,
                execution_time_ms=execution_time,
                step_results=step_results,
                error_message=str(e),
                started_at=start_time,
                completed_at=end_time
            )
    
    async def _execute_single_step(
        self,
        agent: Agent,
        step_scenario: StepTestScenario,
        context_data: Dict[str, Any]
    ) -> StepExecutionResult:
        """
        Execute single step test scenario.
        
        AIDEV-NOTE: This is a mock implementation. In real implementation,
        this would integrate with your gRPC agent execution system.
        """
        start_time = datetime.utcnow()
        
        try:
            # Mock step execution based on step type
            if step_scenario.step_type == StepType.CODE_STEP:
                result = await self._mock_code_step_execution(step_scenario, context_data)
            else:  # TOOL_STEP
                result = await self._mock_tool_step_execution(step_scenario, context_data)
            
            end_time = datetime.utcnow()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            
            # Create initial step result
            step_result = StepExecutionResult(
                step_id=step_scenario.step_id,
                step_type=step_scenario.step_type,
                status=StepExecutionStatus.COMPLETED,
                execution_time_ms=execution_time,
                output_data=result.get("output_data"),
                generated_code=result.get("generated_code"),
                tool_calls=result.get("tool_calls"),
                variables_created=result.get("variables_created"),
                started_at=start_time,
                completed_at=end_time
            )
            
            # Apply step-specific evaluation
            if step_scenario.step_type == StepType.CODE_STEP:
                step_result = self.code_step_evaluator.evaluate_code_step(step_result, step_scenario)
            else:  # TOOL_STEP
                step_result = self.tool_step_evaluator.evaluate_tool_step(step_result, step_scenario)
            
            return step_result
            
        except Exception as e:
            end_time = datetime.utcnow()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            
            return StepExecutionResult(
                step_id=step_scenario.step_id,
                step_type=step_scenario.step_type,
                status=StepExecutionStatus.FAILED,
                execution_time_ms=execution_time,
                error_message=str(e),
                started_at=start_time,
                completed_at=end_time
            )
    
    async def _mock_code_step_execution(
        self, 
        step_scenario: StepTestScenario, 
        context_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Mock code step execution for testing."""
        # Simulate code generation based on step instructions
        generated_code = f"# Generated code for: {step_scenario.step_id}\n"
        generated_code += f"# Instructions: {step_scenario.description}\n"
        generated_code += f"result = 'Mock execution of {step_scenario.step_id}'\n"
        
        # Simulate variable creation
        variables_created = ["result"]
        if step_scenario.expected_behavior and step_scenario.expected_behavior.expected_variables:
            variables_created.extend(step_scenario.expected_behavior.expected_variables)
        
        return {
            "output_data": {"status": "success", "result": f"Code step {step_scenario.step_id} executed"},
            "generated_code": generated_code,
            "variables_created": variables_created
        }
    
    async def _mock_tool_step_execution(
        self, 
        step_scenario: StepTestScenario, 
        context_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Mock tool step execution for testing."""
        # Simulate tool calls based on expected tools
        tool_calls = []
        if step_scenario.expected_behavior and step_scenario.expected_behavior.should_execute_tools:
            expected_tools = step_scenario.expected_behavior.should_execute_tools
            
            if isinstance(expected_tools, list):
                # Specific tools expected
                for tool_name in expected_tools:
                    tool_calls.append({
                        "tool_name": tool_name,
                        "parameters": {"test_param": "test_value"},
                        "result": f"Mock result from {tool_name}"
                    })
            elif isinstance(expected_tools, bool) and expected_tools:
                # Any tool usage expected, create a default mock tool call
                tool_calls.append({
                    "tool_name": "mock_tool",
                    "parameters": {"test_param": "test_value"},
                    "result": f"Mock result from default tool"
                })
        
        return {
            "output_data": {"status": "success", "result": f"Tool step {step_scenario.step_id} executed"},
            "tool_calls": tool_calls
        }