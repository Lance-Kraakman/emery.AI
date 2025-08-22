"""
Evaluation Result Domain Entities

AIDEV-NOTE: Entities for storing and analyzing agent evaluation results.
Includes detailed step-by-step execution results and performance metrics.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from enum import Enum

from .test_scenario import StepType, CapabilityTestScenario, StepTestScenario


class ExecutionStatus(Enum):
    """Status of test execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    SKIPPED = "skipped"


class StepExecutionStatus(Enum):
    """Status of individual step execution."""
    NOT_STARTED = "not_started"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    VALIDATION_FAILED = "validation_failed"


@dataclass
class ValidationResult:
    """Result of validation rule execution."""
    rule_description: str
    passed: bool
    expected: str
    actual: str
    error_message: Optional[str] = None


@dataclass
class StepExecutionResult:
    """Result of individual step execution."""
    step_id: str
    step_type: StepType
    status: StepExecutionStatus
    execution_time_ms: int
    output_data: Optional[Dict[str, Any]] = None
    generated_code: Optional[str] = None  # For CODE_STEP results
    tool_calls: Optional[List[Dict[str, Any]]] = None  # For TOOL_STEP results
    variables_created: Optional[List[str]] = None
    validation_results: Optional[List[ValidationResult]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class CapabilityExecutionResult:
    """Result of capability execution."""
    capability_name: str
    status: ExecutionStatus
    execution_time_ms: int
    step_results: List[StepExecutionResult]
    final_output: Optional[Dict[str, Any]] = None
    success_rate: float = 0.0  # Percentage of successful steps
    validation_results: Optional[List[ValidationResult]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class EvaluationError:
    """Error encountered during evaluation."""
    error_type: str  # "validation_error", "execution_error", "timeout_error"
    message: str
    capability_name: Optional[str] = None
    step_id: Optional[str] = None
    timestamp: Optional[datetime] = None


@dataclass
class PerformanceMetrics:
    """Performance metrics for evaluation."""
    total_execution_time_ms: int
    average_step_time_ms: float
    capability_completion_rate: float  # Percentage of capabilities completed successfully
    step_completion_rate: float  # Percentage of steps completed successfully
    code_steps_success_rate: float
    tool_steps_success_rate: float
    total_capabilities: int
    total_steps: int
    successful_capabilities: int
    successful_steps: int


class EvaluationResult:
    """Complete evaluation result for agent capability testing."""
    
    def __init__(
        self,
        id: str,
        agent_id: int,
        test_scenario_id: str,
        test_suite_name: str,
        capability_results: Dict[str, CapabilityExecutionResult],
        overall_status: ExecutionStatus,
        started_at: datetime,
        completed_at: Optional[datetime] = None,
        errors: Optional[List[EvaluationError]] = None
    ):
        self.id = id
        self.agent_id = agent_id
        self.test_scenario_id = test_scenario_id
        self.test_suite_name = test_suite_name
        self.capability_results = capability_results
        self.overall_status = overall_status
        self.started_at = started_at
        self.completed_at = completed_at
        self.errors = errors or []
    
    @classmethod
    def create(
        cls, 
        agent_id: int, 
        test_scenario_id: str, 
        test_suite_name: str
    ) -> "EvaluationResult":
        """Create new evaluation result instance."""
        import uuid
        
        return cls(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            test_scenario_id=test_scenario_id,
            test_suite_name=test_suite_name,
            capability_results={},
            overall_status=ExecutionStatus.PENDING,
            started_at=datetime.utcnow()
        )
    
    @classmethod
    def from_persistence(cls, data: Dict[str, Any]) -> "EvaluationResult":
        """Create evaluation result from persistence data."""
        capability_results = {}
        
        for cap_name, cap_data in data.get("capability_results", {}).items():
            step_results = []
            for step_data in cap_data.get("step_results", []):
                validation_results = None
                if step_data.get("validation_results"):
                    validation_results = [ValidationResult(**vr) for vr in step_data["validation_results"]]
                
                step_results.append(StepExecutionResult(
                    step_id=step_data["step_id"],
                    step_type=StepType(step_data["step_type"]),
                    status=StepExecutionStatus(step_data["status"]),
                    execution_time_ms=step_data["execution_time_ms"],
                    output_data=step_data.get("output_data"),
                    generated_code=step_data.get("generated_code"),
                    tool_calls=step_data.get("tool_calls"),
                    variables_created=step_data.get("variables_created"),
                    validation_results=validation_results,
                    error_message=step_data.get("error_message"),
                    started_at=step_data.get("started_at"),
                    completed_at=step_data.get("completed_at")
                ))
            
            cap_validation_results = None
            if cap_data.get("validation_results"):
                cap_validation_results = [ValidationResult(**vr) for vr in cap_data["validation_results"]]
            
            capability_results[cap_name] = CapabilityExecutionResult(
                capability_name=cap_data["capability_name"],
                status=ExecutionStatus(cap_data["status"]),
                execution_time_ms=cap_data["execution_time_ms"],
                step_results=step_results,
                final_output=cap_data.get("final_output"),
                success_rate=cap_data.get("success_rate", 0.0),
                validation_results=cap_validation_results,
                error_message=cap_data.get("error_message"),
                started_at=cap_data.get("started_at"),
                completed_at=cap_data.get("completed_at")
            )
        
        errors = None
        if data.get("errors"):
            errors = [EvaluationError(**error) for error in data["errors"]]
        
        return cls(
            id=data["id"],
            agent_id=data["agent_id"],
            test_scenario_id=data["test_scenario_id"],
            test_suite_name=data["test_suite_name"],
            capability_results=capability_results,
            overall_status=ExecutionStatus(data["overall_status"]),
            started_at=data["started_at"],
            completed_at=data.get("completed_at"),
            errors=errors
        )
    
    # Business logic methods
    @property
    def total_execution_time_ms(self) -> int:
        """Get total execution time across all capabilities."""
        return sum(result.execution_time_ms for result in self.capability_results.values())
    
    @property
    def overall_success_rate(self) -> float:
        """Calculate overall success rate across all capabilities."""
        if not self.capability_results:
            return 0.0
        
        successful_capabilities = sum(
            1 for result in self.capability_results.values() 
            if result.status == ExecutionStatus.COMPLETED
        )
        return (successful_capabilities / len(self.capability_results)) * 100
    
    @property
    def performance_metrics(self) -> PerformanceMetrics:
        """Calculate comprehensive performance metrics."""
        total_capabilities = len(self.capability_results)
        successful_capabilities = sum(
            1 for result in self.capability_results.values()
            if result.status == ExecutionStatus.COMPLETED
        )
        
        all_steps = []
        code_steps = []
        tool_steps = []
        
        for cap_result in self.capability_results.values():
            for step_result in cap_result.step_results:
                all_steps.append(step_result)
                if step_result.step_type == StepType.CODE_STEP:
                    code_steps.append(step_result)
                elif step_result.step_type == StepType.TOOL_STEP:
                    tool_steps.append(step_result)
        
        total_steps = len(all_steps)
        successful_steps = sum(
            1 for step in all_steps 
            if step.status == StepExecutionStatus.COMPLETED
        )
        
        successful_code_steps = sum(
            1 for step in code_steps
            if step.status == StepExecutionStatus.COMPLETED
        )
        
        successful_tool_steps = sum(
            1 for step in tool_steps
            if step.status == StepExecutionStatus.COMPLETED
        )
        
        avg_step_time = (
            sum(step.execution_time_ms for step in all_steps) / total_steps 
            if total_steps > 0 else 0
        )
        
        return PerformanceMetrics(
            total_execution_time_ms=self.total_execution_time_ms,
            average_step_time_ms=avg_step_time,
            capability_completion_rate=(successful_capabilities / total_capabilities * 100) if total_capabilities > 0 else 0,
            step_completion_rate=(successful_steps / total_steps * 100) if total_steps > 0 else 0,
            code_steps_success_rate=(successful_code_steps / len(code_steps) * 100) if code_steps else 0,
            tool_steps_success_rate=(successful_tool_steps / len(tool_steps) * 100) if tool_steps else 0,
            total_capabilities=total_capabilities,
            total_steps=total_steps,
            successful_capabilities=successful_capabilities,
            successful_steps=successful_steps
        )
    
    def get_capability_result(self, capability_name: str) -> Optional[CapabilityExecutionResult]:
        """Get result for specific capability."""
        return self.capability_results.get(capability_name)
    
    def get_failed_capabilities(self) -> List[CapabilityExecutionResult]:
        """Get all failed capability results."""
        return [
            result for result in self.capability_results.values()
            if result.status in [ExecutionStatus.FAILED, ExecutionStatus.TIMEOUT]
        ]
    
    def get_failed_steps(self) -> List[StepExecutionResult]:
        """Get all failed step results across all capabilities."""
        failed_steps = []
        for cap_result in self.capability_results.values():
            for step_result in cap_result.step_results:
                if step_result.status in [StepExecutionStatus.FAILED, StepExecutionStatus.TIMEOUT, StepExecutionStatus.VALIDATION_FAILED]:
                    failed_steps.append(step_result)
        return failed_steps
    
    def add_capability_result(self, capability_result: CapabilityExecutionResult) -> None:
        """Add capability execution result."""
        self.capability_results[capability_result.capability_name] = capability_result
    
    def add_error(self, error: EvaluationError) -> None:
        """Add evaluation error."""
        self.errors.append(error)
    
    def complete_evaluation(self, status: ExecutionStatus = ExecutionStatus.COMPLETED) -> None:
        """Mark evaluation as completed."""
        self.overall_status = status
        self.completed_at = datetime.utcnow()
    
    @property
    def is_completed(self) -> bool:
        """Check if evaluation is completed."""
        return self.overall_status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.TIMEOUT]
    
    @property
    def duration_seconds(self) -> Optional[float]:
        """Get evaluation duration in seconds."""
        if not self.completed_at:
            return None
        return (self.completed_at - self.started_at).total_seconds()