"""
Tests for Step-Specific Evaluators

AIDEV-NOTE: Tests for CodeStepEvaluator and ToolStepEvaluator domain services.
Validates step evaluation logic and validation rule application.
"""

import pytest
from datetime import datetime
from typing import List, Dict, Any

from emery_agents.domain.evaluation.entities.test_scenario import (
    StepTestScenario,
    StepType,
    ExpectedStepBehavior,
    ValidationRule,
    ValidationRuleType
)
from emery_agents.domain.evaluation.entities.evaluation_result import (
    StepExecutionResult,
    StepExecutionStatus
)
from emery_agents.domain.evaluation.services.code_step_evaluator import CodeStepEvaluator
from emery_agents.domain.evaluation.services.tool_step_evaluator import ToolStepEvaluator


@pytest.fixture
def code_step_evaluator():
    return CodeStepEvaluator()


@pytest.fixture
def tool_step_evaluator():
    return ToolStepEvaluator()


@pytest.fixture
def code_step_scenario():
    return StepTestScenario(
        step_id="test_code_step",
        step_type=StepType.CODE_STEP,
        description="Generate code for data processing",
        input_context={"data": "test_data"},
        expected_behavior=ExpectedStepBehavior(
            should_produce_code=True,
            expected_variables=["df", "results", "processed_data"]
        ),
        validation_rules=[
            ValidationRule(
                rule_type=ValidationRuleType.CONTAINS,
                pattern="pandas",
                description="Code should use pandas",
                required=True
            )
        ]
    )


@pytest.fixture
def tool_step_scenario():
    return StepTestScenario(
        step_id="test_tool_step",
        step_type=StepType.TOOL_STEP,
        description="Send email using Gmail tool",
        input_context={"recipient": "test@example.com"},
        expected_behavior=ExpectedStepBehavior(
            should_execute_tools=["gmail_send"],  # Only expect gmail_send tool
            should_produce_code=False
        ),
        validation_rules=[
            ValidationRule(
                rule_type=ValidationRuleType.JSON_SCHEMA,
                pattern='{"type": "object", "properties": {"message_id": {"type": "string"}}, "required": ["message_id"]}',
                description="Tool response should contain message_id",
                required=True
            )
        ]
    )


class TestCodeStepEvaluator:
    """Test CodeStepEvaluator functionality."""
    
    def test_evaluate_successful_code_step(self, code_step_evaluator, code_step_scenario):
        """Test evaluation of successful code step with generated code."""
        # Create step result with generated code
        step_result = StepExecutionResult(
            step_id="test_code_step",
            step_type=StepType.CODE_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=1500,
            generated_code="""
import pandas as pd

# Load and process data
df = pd.DataFrame({'col1': [1, 2, 3], 'col2': [4, 5, 6]})
results = df.describe()
processed_data = df.groupby('col1').mean()

print("Data processing completed")
            """.strip(),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = code_step_evaluator.evaluate_code_step(step_result, code_step_scenario)
        
        # Verify evaluation results
        assert evaluated_result.status == StepExecutionStatus.COMPLETED
        assert evaluated_result.validation_results is not None
        assert len(evaluated_result.validation_results) > 0
        
        # Check that all validations passed
        all_passed = all(v.passed for v in evaluated_result.validation_results)
        assert all_passed, f"Some validations failed: {[v.rule_description for v in evaluated_result.validation_results if not v.passed]}"
    
    def test_evaluate_code_step_missing_variables(self, code_step_evaluator, code_step_scenario):
        """Test evaluation of code step missing expected variables."""
        step_result = StepExecutionResult(
            step_id="test_code_step",
            step_type=StepType.CODE_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=1000,
            generated_code="print('Hello World')",  # Missing expected variables
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = code_step_evaluator.evaluate_code_step(step_result, code_step_scenario)
        
        # Should fail validation due to missing variables
        assert evaluated_result.status == StepExecutionStatus.VALIDATION_FAILED
        
        # Check that variable validations failed
        variable_validations = [
            v for v in evaluated_result.validation_results 
            if "Variable" in v.rule_description and not v.passed
        ]
        assert len(variable_validations) > 0
    
    def test_evaluate_code_step_no_code_generated(self, code_step_evaluator, code_step_scenario):
        """Test evaluation when no code was generated."""
        step_result = StepExecutionResult(
            step_id="test_code_step",
            step_type=StepType.CODE_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=500,
            generated_code="",  # No code generated
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = code_step_evaluator.evaluate_code_step(step_result, code_step_scenario)
        
        # Should fail validation
        assert evaluated_result.status == StepExecutionStatus.VALIDATION_FAILED
        
        # Check for code generation validation failure
        code_gen_validations = [
            v for v in evaluated_result.validation_results 
            if "Code generation" in v.rule_description or "Should produce code" in v.rule_description
        ]
        assert len(code_gen_validations) > 0
        assert not code_gen_validations[0].passed
    
    def test_code_analysis_with_syntax_error(self, code_step_evaluator):
        """Test code analysis handles syntax errors gracefully."""
        # Create step scenario that expects code
        scenario = StepTestScenario(
            step_id="syntax_error_test",
            step_type=StepType.CODE_STEP,
            description="Test syntax error handling",
            input_context={},
            expected_behavior=ExpectedStepBehavior(
                should_produce_code=True,
                expected_variables=["result"]
            )
        )
        
        step_result = StepExecutionResult(
            step_id="syntax_error_test",
            step_type=StepType.CODE_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=1000,
            generated_code="result = invalid syntax here ))))",  # Invalid syntax
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Should not crash on syntax error
        evaluated_result = code_step_evaluator.evaluate_code_step(step_result, scenario)
        
        # Should still detect the variable using regex fallback
        assert evaluated_result.validation_results is not None
        
        # Should find 'result' variable even with syntax error
        variable_validations = [
            v for v in evaluated_result.validation_results 
            if "result" in v.rule_description and v.passed
        ]
        assert len(variable_validations) > 0


class TestToolStepEvaluator:
    """Test ToolStepEvaluator functionality."""
    
    def test_evaluate_successful_tool_step(self, tool_step_evaluator, tool_step_scenario):
        """Test evaluation of successful tool step with tool calls."""
        step_result = StepExecutionResult(
            step_id="test_tool_step",
            step_type=StepType.TOOL_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=2000,
            tool_calls=[
                {
                    "tool_name": "gmail_send",
                    "parameters": {
                        "recipient": "test@example.com",
                        "subject": "Test Email",
                        "body": "Test message"
                    },
                    "result": {"message_id": "msg_123456789"}
                }
            ],
            output_data={"message_id": "msg_123456789", "status": "sent"},
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = tool_step_evaluator.evaluate_tool_step(step_result, tool_step_scenario)
        
        # Verify evaluation results
        assert evaluated_result.status == StepExecutionStatus.COMPLETED
        assert evaluated_result.validation_results is not None
        
        # Check that all validations passed
        all_passed = all(v.passed for v in evaluated_result.validation_results)
        assert all_passed, f"Some validations failed: {[v.rule_description for v in evaluated_result.validation_results if not v.passed]}"
    
    def test_evaluate_tool_step_missing_expected_tool(self, tool_step_evaluator, tool_step_scenario):
        """Test evaluation when expected tool was not called."""
        step_result = StepExecutionResult(
            step_id="test_tool_step",
            step_type=StepType.TOOL_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=1000,
            tool_calls=[
                {
                    "tool_name": "wrong_tool",  # Wrong tool called
                    "parameters": {"param": "value"},
                    "result": {"status": "success"}
                }
            ],
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = tool_step_evaluator.evaluate_tool_step(step_result, tool_step_scenario)
        
        # Should fail validation due to wrong tool
        assert evaluated_result.status == StepExecutionStatus.VALIDATION_FAILED
        
        # Check for tool validation failures
        tool_validations = [
            v for v in evaluated_result.validation_results 
            if "gmail_send" in v.rule_description and not v.passed
        ]
        assert len(tool_validations) > 0
    
    def test_evaluate_tool_step_no_tools_called(self, tool_step_evaluator, tool_step_scenario):
        """Test evaluation when no tools were called."""
        step_result = StepExecutionResult(
            step_id="test_tool_step",
            step_type=StepType.TOOL_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=500,
            tool_calls=[],  # No tools called
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = tool_step_evaluator.evaluate_tool_step(step_result, tool_step_scenario)
        
        # Should fail validation
        assert evaluated_result.status == StepExecutionStatus.VALIDATION_FAILED
        
        # Check for tool execution validation failure
        tool_exec_validations = [
            v for v in evaluated_result.validation_results 
            if "Should execute tools" in v.rule_description and not v.passed
        ]
        assert len(tool_exec_validations) > 0
    
    def test_tool_step_with_boolean_tool_expectation(self, tool_step_evaluator):
        """Test tool step evaluation with boolean tool expectation."""
        scenario = StepTestScenario(
            step_id="any_tool_test",
            step_type=StepType.TOOL_STEP,
            description="Execute any tool",
            input_context={},
            expected_behavior=ExpectedStepBehavior(
                should_execute_tools=True  # Just True, not specific tools
            )
        )
        
        step_result = StepExecutionResult(
            step_id="any_tool_test",
            step_type=StepType.TOOL_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=1000,
            tool_calls=[
                {
                    "tool_name": "any_tool",
                    "parameters": {"test": "value"},
                    "result": {"success": True}
                }
            ],
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = tool_step_evaluator.evaluate_tool_step(step_result, scenario)
        
        # Should pass with any tool usage
        assert evaluated_result.status == StepExecutionStatus.COMPLETED
        
        # Check tool execution validation passed
        tool_exec_validations = [
            v for v in evaluated_result.validation_results 
            if "Any tools should be executed" in v.rule_description
        ]
        assert len(tool_exec_validations) > 0
        assert tool_exec_validations[0].passed
    
    def test_json_schema_validation(self, tool_step_evaluator):
        """Test JSON schema validation in tool step evaluation."""
        scenario = StepTestScenario(
            step_id="schema_test",
            step_type=StepType.TOOL_STEP,
            description="Test JSON schema validation",
            input_context={},
            expected_behavior=ExpectedStepBehavior(
                should_execute_tools=["test_tool"]
            ),
            validation_rules=[
                ValidationRule(
                    rule_type=ValidationRuleType.JSON_SCHEMA,
                    pattern='{"type": "object", "properties": {"status": {"type": "string"}}, "required": ["status"]}',
                    description="Response should have status field",
                    required=True
                )
            ]
        )
        
        step_result = StepExecutionResult(
            step_id="schema_test",
            step_type=StepType.TOOL_STEP,
            status=StepExecutionStatus.COMPLETED,
            execution_time_ms=1000,
            tool_calls=[
                {
                    "tool_name": "test_tool",
                    "parameters": {"param": "value"},
                    "result": {"message": "success"}
                }
            ],
            output_data={"status": "completed", "result": "success"},
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        
        # Evaluate step
        evaluated_result = tool_step_evaluator.evaluate_tool_step(step_result, scenario)
        
        # Should pass schema validation
        assert evaluated_result.status == StepExecutionStatus.COMPLETED
        
        # Check schema validation passed
        schema_validations = [
            v for v in evaluated_result.validation_results 
            if "Response should have status field" in v.rule_description and v.passed
        ]
        assert len(schema_validations) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])