"""
Evaluation Report Service

AIDEV-NOTE: Application service for generating evaluation reports and analysis.
Provides comprehensive reporting capabilities for agent capability evaluation results.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

from ...domain.evaluation.entities.evaluation_result import (
    EvaluationResult,
    CapabilityExecutionResult,
    StepExecutionResult,
    ExecutionStatus,
    StepExecutionStatus,
    PerformanceMetrics
)
from ...domain.evaluation.entities.test_scenario import StepType


@dataclass
class EvaluationSummary:
    """Summary of evaluation results."""
    total_evaluations: int
    successful_evaluations: int
    failed_evaluations: int
    average_success_rate: float
    average_execution_time_ms: int
    total_capabilities_tested: int
    total_steps_executed: int
    most_common_failures: List[str]
    best_performing_capabilities: List[str]
    worst_performing_capabilities: List[str]


@dataclass
class CapabilityAnalysis:
    """Analysis of specific capability performance."""
    capability_name: str
    total_executions: int
    success_rate: float
    average_execution_time_ms: float
    common_step_failures: List[str]
    code_step_performance: Optional[float] = None
    tool_step_performance: Optional[float] = None


@dataclass
class ComparisonReport:
    """Comparison between multiple agent evaluations."""
    agent_performances: Dict[int, float]  # agent_id -> success_rate
    capability_comparisons: Dict[str, Dict[int, float]]  # capability -> agent_id -> success_rate
    performance_trends: Dict[str, List[float]]  # metric_name -> values_over_time
    recommendations: List[str]


class EvaluationReportService:
    """Service for generating evaluation reports and analysis."""
    
    def generate_evaluation_summary(
        self, 
        evaluation_results: List[EvaluationResult]
    ) -> EvaluationSummary:
        """
        Generate comprehensive summary of evaluation results.
        
        Args:
            evaluation_results: List of evaluation results to analyze
            
        Returns:
            EvaluationSummary with aggregated metrics and insights
        """
        if not evaluation_results:
            return EvaluationSummary(
                total_evaluations=0,
                successful_evaluations=0,
                failed_evaluations=0,
                average_success_rate=0.0,
                average_execution_time_ms=0,
                total_capabilities_tested=0,
                total_steps_executed=0,
                most_common_failures=[],
                best_performing_capabilities=[],
                worst_performing_capabilities=[]
            )
        
        # Basic statistics
        total_evaluations = len(evaluation_results)
        successful_evaluations = sum(
            1 for result in evaluation_results 
            if result.overall_status == ExecutionStatus.COMPLETED
        )
        failed_evaluations = total_evaluations - successful_evaluations
        
        # Performance metrics
        success_rates = [result.overall_success_rate for result in evaluation_results]
        average_success_rate = sum(success_rates) / len(success_rates)
        
        execution_times = [result.total_execution_time_ms for result in evaluation_results]
        average_execution_time_ms = sum(execution_times) // len(execution_times)
        
        # Capability and step counts
        all_capability_results = []
        all_step_results = []
        
        for result in evaluation_results:
            all_capability_results.extend(result.capability_results.values())
            for cap_result in result.capability_results.values():
                all_step_results.extend(cap_result.step_results)
        
        total_capabilities_tested = len(all_capability_results)
        total_steps_executed = len(all_step_results)
        
        # Failure analysis
        most_common_failures = self._analyze_common_failures(evaluation_results)
        
        # Performance analysis
        capability_performance = self._analyze_capability_performance(all_capability_results)
        best_performing = sorted(
            capability_performance.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:3]
        worst_performing = sorted(
            capability_performance.items(), 
            key=lambda x: x[1]
        )[:3]
        
        return EvaluationSummary(
            total_evaluations=total_evaluations,
            successful_evaluations=successful_evaluations,
            failed_evaluations=failed_evaluations,
            average_success_rate=average_success_rate,
            average_execution_time_ms=average_execution_time_ms,
            total_capabilities_tested=total_capabilities_tested,
            total_steps_executed=total_steps_executed,
            most_common_failures=most_common_failures,
            best_performing_capabilities=[name for name, _ in best_performing],
            worst_performing_capabilities=[name for name, _ in worst_performing]
        )
    
    def analyze_capability_performance(
        self, 
        evaluation_results: List[EvaluationResult],
        capability_name: str
    ) -> Optional[CapabilityAnalysis]:
        """
        Analyze performance of specific capability across evaluations.
        
        Args:
            evaluation_results: List of evaluation results
            capability_name: Name of capability to analyze
            
        Returns:
            CapabilityAnalysis or None if capability not found
        """
        capability_results = []
        
        # Collect all results for this capability
        for evaluation in evaluation_results:
            if capability_name in evaluation.capability_results:
                capability_results.append(evaluation.capability_results[capability_name])
        
        if not capability_results:
            return None
        
        # Calculate metrics
        total_executions = len(capability_results)
        successful_executions = sum(
            1 for result in capability_results 
            if result.status == ExecutionStatus.COMPLETED
        )
        success_rate = (successful_executions / total_executions) * 100
        
        execution_times = [result.execution_time_ms for result in capability_results]
        average_execution_time_ms = sum(execution_times) / len(execution_times)
        
        # Analyze step failures
        common_step_failures = self._analyze_step_failures(capability_results)
        
        # Analyze step type performance
        code_step_performance = self._calculate_step_type_performance(
            capability_results, StepType.CODE_STEP
        )
        tool_step_performance = self._calculate_step_type_performance(
            capability_results, StepType.TOOL_STEP
        )
        
        return CapabilityAnalysis(
            capability_name=capability_name,
            total_executions=total_executions,
            success_rate=success_rate,
            average_execution_time_ms=average_execution_time_ms,
            common_step_failures=common_step_failures,
            code_step_performance=code_step_performance,
            tool_step_performance=tool_step_performance
        )
    
    def generate_agent_comparison_report(
        self, 
        agent_evaluations: Dict[int, List[EvaluationResult]]
    ) -> ComparisonReport:
        """
        Generate comparison report between multiple agents.
        
        Args:
            agent_evaluations: Dict of agent_id -> list of evaluation results
            
        Returns:
            ComparisonReport with agent performance comparisons
        """
        agent_performances = {}
        capability_comparisons = {}
        
        # Calculate agent performance metrics
        for agent_id, results in agent_evaluations.items():
            if results:
                success_rates = [result.overall_success_rate for result in results]
                agent_performances[agent_id] = sum(success_rates) / len(success_rates)
        
        # Analyze capability performance per agent
        all_capability_names = set()
        for results in agent_evaluations.values():
            for result in results:
                all_capability_names.update(result.capability_results.keys())
        
        for capability_name in all_capability_names:
            capability_comparisons[capability_name] = {}
            
            for agent_id, results in agent_evaluations.items():
                capability_results = []
                for result in results:
                    if capability_name in result.capability_results:
                        cap_result = result.capability_results[capability_name]
                        if cap_result.status == ExecutionStatus.COMPLETED:
                            capability_results.append(cap_result.success_rate)
                
                if capability_results:
                    avg_success_rate = sum(capability_results) / len(capability_results)
                    capability_comparisons[capability_name][agent_id] = avg_success_rate
        
        # Generate recommendations
        recommendations = self._generate_recommendations(agent_performances, capability_comparisons)
        
        return ComparisonReport(
            agent_performances=agent_performances,
            capability_comparisons=capability_comparisons,
            performance_trends={},  # TODO: Implement time-series analysis
            recommendations=recommendations
        )
    
    def generate_detailed_report(
        self, 
        evaluation_result: EvaluationResult
    ) -> Dict[str, Any]:
        """
        Generate detailed report for single evaluation result.
        
        Args:
            evaluation_result: Single evaluation result to analyze
            
        Returns:
            Detailed report as dictionary
        """
        report = {
            "evaluation_id": evaluation_result.id,
            "agent_id": evaluation_result.agent_id,
            "test_suite": evaluation_result.test_suite_name,
            "overall_status": evaluation_result.overall_status.value,
            "overall_success_rate": evaluation_result.overall_success_rate,
            "total_execution_time_ms": evaluation_result.total_execution_time_ms,
            "duration_seconds": evaluation_result.duration_seconds,
            "started_at": evaluation_result.started_at.isoformat() if evaluation_result.started_at else None,
            "completed_at": evaluation_result.completed_at.isoformat() if evaluation_result.completed_at else None,
        }
        
        # Performance metrics
        metrics = evaluation_result.performance_metrics
        report["performance_metrics"] = {
            "total_capabilities": metrics.total_capabilities,
            "successful_capabilities": metrics.successful_capabilities,
            "total_steps": metrics.total_steps,
            "successful_steps": metrics.successful_steps,
            "capability_completion_rate": metrics.capability_completion_rate,
            "step_completion_rate": metrics.step_completion_rate,
            "code_steps_success_rate": metrics.code_steps_success_rate,
            "tool_steps_success_rate": metrics.tool_steps_success_rate,
            "average_step_time_ms": metrics.average_step_time_ms
        }
        
        # Capability results
        report["capabilities"] = {}
        for cap_name, cap_result in evaluation_result.capability_results.items():
            cap_report = {
                "status": cap_result.status.value,
                "success_rate": cap_result.success_rate,
                "execution_time_ms": cap_result.execution_time_ms,
                "error_message": cap_result.error_message,
                "steps": []
            }
            
            for step_result in cap_result.step_results:
                step_report = {
                    "step_id": step_result.step_id,
                    "step_type": step_result.step_type.value,
                    "status": step_result.status.value,
                    "execution_time_ms": step_result.execution_time_ms,
                    "error_message": step_result.error_message
                }
                
                if step_result.generated_code:
                    step_report["generated_code_length"] = len(step_result.generated_code)
                
                if step_result.tool_calls:
                    step_report["tool_calls_count"] = len(step_result.tool_calls)
                    step_report["tools_used"] = [
                        call.get("tool_name") for call in step_result.tool_calls
                    ]
                
                if step_result.validation_results:
                    passed_validations = sum(1 for v in step_result.validation_results if v.passed)
                    total_validations = len(step_result.validation_results)
                    step_report["validation_success_rate"] = (passed_validations / total_validations) * 100
                
                cap_report["steps"].append(step_report)
            
            report["capabilities"][cap_name] = cap_report
        
        # Errors
        if evaluation_result.errors:
            report["errors"] = [
                {
                    "error_type": error.error_type,
                    "message": error.message,
                    "capability_name": error.capability_name,
                    "step_id": error.step_id,
                    "timestamp": error.timestamp.isoformat() if error.timestamp else None
                }
                for error in evaluation_result.errors
            ]
        
        return report
    
    def _analyze_common_failures(self, evaluation_results: List[EvaluationResult]) -> List[str]:
        """Analyze most common failure patterns across evaluations."""
        failure_counts = {}
        
        for result in evaluation_results:
            for error in result.errors:
                failure_key = f"{error.error_type}: {error.message[:50]}..."
                failure_counts[failure_key] = failure_counts.get(failure_key, 0) + 1
        
        # Return top 5 most common failures
        sorted_failures = sorted(failure_counts.items(), key=lambda x: x[1], reverse=True)
        return [failure for failure, _ in sorted_failures[:5]]
    
    def _analyze_capability_performance(
        self, 
        capability_results: List[CapabilityExecutionResult]
    ) -> Dict[str, float]:
        """Analyze performance by capability name."""
        capability_stats = {}
        
        for result in capability_results:
            cap_name = result.capability_name
            if cap_name not in capability_stats:
                capability_stats[cap_name] = []
            
            success_rate = result.success_rate if result.status == ExecutionStatus.COMPLETED else 0.0
            capability_stats[cap_name].append(success_rate)
        
        # Calculate average success rate per capability
        return {
            cap_name: sum(rates) / len(rates) 
            for cap_name, rates in capability_stats.items()
        }
    
    def _analyze_step_failures(
        self, 
        capability_results: List[CapabilityExecutionResult]
    ) -> List[str]:
        """Analyze common step failures for a capability."""
        step_failure_counts = {}
        
        for cap_result in capability_results:
            for step_result in cap_result.step_results:
                if step_result.status in [StepExecutionStatus.FAILED, StepExecutionStatus.VALIDATION_FAILED]:
                    failure_key = f"{step_result.step_id}: {step_result.error_message[:30] if step_result.error_message else 'Unknown error'}..."
                    step_failure_counts[failure_key] = step_failure_counts.get(failure_key, 0) + 1
        
        # Return top 3 most common step failures
        sorted_failures = sorted(step_failure_counts.items(), key=lambda x: x[1], reverse=True)
        return [failure for failure, _ in sorted_failures[:3]]
    
    def _calculate_step_type_performance(
        self, 
        capability_results: List[CapabilityExecutionResult],
        step_type: StepType
    ) -> Optional[float]:
        """Calculate success rate for specific step type."""
        step_results = []
        
        for cap_result in capability_results:
            for step_result in cap_result.step_results:
                if step_result.step_type == step_type:
                    step_results.append(step_result)
        
        if not step_results:
            return None
        
        successful_steps = sum(
            1 for step in step_results 
            if step.status == StepExecutionStatus.COMPLETED
        )
        
        return (successful_steps / len(step_results)) * 100
    
    def _generate_recommendations(
        self, 
        agent_performances: Dict[int, float],
        capability_comparisons: Dict[str, Dict[int, float]]
    ) -> List[str]:
        """Generate recommendations based on performance analysis."""
        recommendations = []
        
        if not agent_performances:
            return recommendations
        
        # Identify best and worst performing agents
        best_agent_id = max(agent_performances, key=agent_performances.get)
        worst_agent_id = min(agent_performances, key=agent_performances.get)
        
        best_performance = agent_performances[best_agent_id]
        worst_performance = agent_performances[worst_agent_id]
        
        if best_performance - worst_performance > 20:  # 20% difference
            recommendations.append(
                f"Significant performance gap: Agent {best_agent_id} ({best_performance:.1f}%) "
                f"outperforms Agent {worst_agent_id} ({worst_performance:.1f}%). "
                f"Consider analyzing Agent {best_agent_id}'s configuration."
            )
        
        # Analyze capability-specific issues
        for capability_name, agent_results in capability_comparisons.items():
            if len(agent_results) > 1:
                values = list(agent_results.values())
                if max(values) - min(values) > 30:  # 30% difference in capability
                    best_agent_for_cap = max(agent_results, key=agent_results.get)
                    recommendations.append(
                        f"Capability '{capability_name}' shows large performance variance. "
                        f"Agent {best_agent_for_cap} performs best at {agent_results[best_agent_for_cap]:.1f}%."
                    )
        
        # General recommendations
        avg_performance = sum(agent_performances.values()) / len(agent_performances)
        if avg_performance < 50:
            recommendations.append(
                "Overall low success rates detected. Consider reviewing test scenarios "
                "or agent configurations for systematic issues."
            )
        elif avg_performance > 90:
            recommendations.append(
                "High success rates achieved! Consider adding more challenging test scenarios "
                "to better differentiate agent capabilities."
            )
        
        return recommendations[:5]  # Limit to top 5 recommendations