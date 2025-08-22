"""
Simple Table-Driven Evaluator

AIDEV-NOTE: Simplified evaluator using clear table-driven testing pattern.
Compare actual results against expected results with clear pass/fail logic.
"""

import re
import ast
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from ..entities.test_case import TestCase, TestSuite, TestInput, ExpectedResult, ActualResult


@dataclass
class EvaluationReport:
    """Simple evaluation report with clear results."""
    test_suite: TestSuite
    total_tests: int
    passed_tests: int
    failed_tests: int
    success_rate: float
    execution_time_ms: int
    failures: List[str]  # List of failure reasons


class SimpleEvaluator:
    """Simple evaluator using table-driven testing pattern."""
    
    def evaluate_test_case(self, test_case: TestCase, actual_result: ActualResult) -> TestCase:
        """
        Evaluate a single test case against actual results.
        
        Args:
            test_case: Test case with expected results
            actual_result: Actual execution result
            
        Returns:
            Updated test case with pass/fail status and failure reason
        """
        test_case.actual = actual_result
        
        # Check basic success/failure
        if test_case.expected.should_succeed != actual_result.succeeded:
            test_case.passed = False
            test_case.failure_reason = f"Expected success={test_case.expected.should_succeed}, got success={actual_result.succeeded}"
            if actual_result.error_message:
                test_case.failure_reason += f" (Error: {actual_result.error_message})"
            return test_case
        
        # If expected to fail and it did fail, that's a pass
        if not test_case.expected.should_succeed and not actual_result.succeeded:
            test_case.passed = True
            return test_case
        
        # Check code generation expectation
        if test_case.expected.should_generate_code:
            if not actual_result.generated_code or not actual_result.generated_code.strip():
                test_case.passed = False
                test_case.failure_reason = "Expected code generation but no code was generated"
                return test_case
        
        # Check tool calls
        if test_case.expected.should_call_tools:
            for expected_tool in test_case.expected.should_call_tools:
                if expected_tool not in actual_result.called_tools:
                    test_case.passed = False
                    test_case.failure_reason = f"Expected tool '{expected_tool}' to be called, but it wasn't. Called tools: {actual_result.called_tools}"
                    return test_case
        
        # Check expected content patterns
        if test_case.expected.should_contain:
            search_text = ""
            if actual_result.generated_code:
                search_text += actual_result.generated_code + " "
            if actual_result.output_text:
                search_text += actual_result.output_text + " "
            
            for pattern in test_case.expected.should_contain:
                if pattern.lower() not in search_text.lower():
                    test_case.passed = False
                    test_case.failure_reason = f"Expected content to contain '{pattern}' but it was not found"
                    return test_case
        
        # Check expected variables (for code generation)
        if test_case.expected.should_have_variables and actual_result.generated_code:
            missing_vars = []
            for expected_var in test_case.expected.should_have_variables:
                if expected_var not in actual_result.created_variables:
                    # Try to find it in the code directly
                    if not self._variable_found_in_code(expected_var, actual_result.generated_code):
                        missing_vars.append(expected_var)
            
            if missing_vars:
                test_case.passed = False
                test_case.failure_reason = f"Expected variables not found: {missing_vars}"
                return test_case
        
        # Check execution time if specified
        if test_case.expected.execution_time_max_ms:
            if actual_result.execution_time_ms > test_case.expected.execution_time_max_ms:
                test_case.passed = False
                test_case.failure_reason = f"Execution time {actual_result.execution_time_ms}ms exceeded maximum {test_case.expected.execution_time_max_ms}ms"
                return test_case
        
        # All checks passed
        test_case.passed = True
        return test_case
    
    def evaluate_test_suite(self, test_suite: TestSuite, actual_results: List[ActualResult]) -> EvaluationReport:
        """
        Evaluate entire test suite against actual results.
        
        Args:
            test_suite: Test suite to evaluate
            actual_results: List of actual results corresponding to test cases
            
        Returns:
            Evaluation report with summary
        """
        if len(actual_results) != len(test_suite.test_cases):
            raise ValueError(f"Mismatch: {len(test_suite.test_cases)} test cases but {len(actual_results)} results")
        
        total_execution_time = 0
        failures = []
        
        # Evaluate each test case
        for i, test_case in enumerate(test_suite.test_cases):
            actual_result = actual_results[i]
            evaluated_case = self.evaluate_test_case(test_case, actual_result)
            total_execution_time += actual_result.execution_time_ms
            
            if not evaluated_case.passed:
                failures.append(f"{evaluated_case.name}: {evaluated_case.failure_reason}")
        
        return EvaluationReport(
            test_suite=test_suite,
            total_tests=test_suite.total_tests,
            passed_tests=test_suite.passed_tests,
            failed_tests=test_suite.failed_tests,
            success_rate=test_suite.success_rate,
            execution_time_ms=total_execution_time,
            failures=failures
        )
    
    def _variable_found_in_code(self, variable_name: str, code: str) -> bool:
        """Check if variable is defined in code using AST or regex fallback."""
        try:
            # Try AST parsing first
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name) and target.id == variable_name:
                            return True
        except SyntaxError:
            # Fallback to regex
            pattern = rf'\b{re.escape(variable_name)}\s*='
            return bool(re.search(pattern, code))
        
        return False
    
    def print_evaluation_report(self, report: EvaluationReport) -> None:
        """Print formatted evaluation report."""
        print(f"\n{'='*60}")
        print(f"EVALUATION REPORT: {report.test_suite.name}")
        print(f"{'='*60}")
        print(f"Total Tests: {report.total_tests}")
        print(f"Passed: {report.passed_tests}")
        print(f"Failed: {report.failed_tests}")
        print(f"Success Rate: {report.success_rate:.1f}%")
        print(f"Total Execution Time: {report.execution_time_ms}ms")
        
        if report.failures:
            print(f"\nFAILURES:")
            for i, failure in enumerate(report.failures, 1):
                print(f"  {i}. {failure}")
        
        print(f"\nTEST DETAILS:")
        for test_case in report.test_suite.test_cases:
            status = "✅ PASS" if test_case.passed else "❌ FAIL"
            print(f"  {status} {test_case.name}: {test_case.description}")
            if not test_case.passed:
                print(f"    Reason: {test_case.failure_reason}")
        
        print(f"{'='*60}")


# Helper functions for creating mock results for testing
def create_successful_code_result(
    generated_code: str,
    variables: List[str] = None,
    execution_time_ms: int = 1000,
    output_text: str = ""
) -> ActualResult:
    """Create a successful code execution result."""
    return ActualResult(
        succeeded=True,
        execution_time_ms=execution_time_ms,
        generated_code=generated_code,
        created_variables=variables or [],
        output_text=output_text
    )


def create_successful_tool_result(
    called_tools: List[str],
    execution_time_ms: int = 2000,
    output_text: str = "Tool execution completed"
) -> ActualResult:
    """Create a successful tool execution result."""
    return ActualResult(
        succeeded=True,
        execution_time_ms=execution_time_ms,
        called_tools=called_tools,
        output_text=output_text
    )


def create_failed_result(
    error_message: str,
    execution_time_ms: int = 500
) -> ActualResult:
    """Create a failed execution result."""
    return ActualResult(
        succeeded=False,
        execution_time_ms=execution_time_ms,
        error_message=error_message
    )