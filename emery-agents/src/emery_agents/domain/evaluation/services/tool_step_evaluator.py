"""
Tool Step Evaluator

AIDEV-NOTE: Domain service for evaluating TOOL_STEP execution results.
Validates tool usage, parameter passing, and execution success.
"""

import json
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from ..entities.test_scenario import StepTestScenario, ValidationRule, ValidationRuleType
from ..entities.evaluation_result import StepExecutionResult, StepExecutionStatus, ValidationResult


@dataclass
class ToolUsageAnalysis:
    """Analysis of tool usage in TOOL_STEP execution."""
    tools_called: List[str]
    tool_call_count: int
    tools_with_errors: List[str]
    parameter_completeness: Dict[str, bool]
    response_formats_valid: Dict[str, bool]


class ToolStepEvaluator:
    """Domain service for evaluating TOOL_STEP execution results."""
    
    def evaluate_tool_step(
        self,
        step_result: StepExecutionResult,
        step_scenario: StepTestScenario
    ) -> StepExecutionResult:
        """
        Evaluate TOOL_STEP execution against test scenario expectations.
        
        Args:
            step_result: Actual execution result from agent
            step_scenario: Test scenario with expected behavior
            
        Returns:
            Updated StepExecutionResult with validation results
        """
        validation_results = []
        
        # 1. Validate tool execution occurred
        tool_execution_validation = self._validate_tool_execution(step_result, step_scenario)
        validation_results.extend(tool_execution_validation)
        
        # 2. Analyze tool usage
        if step_result.tool_calls:
            analysis = self._analyze_tool_usage(step_result.tool_calls)
            
            # 3. Validate expected tools were used
            tool_validation = self._validate_expected_tools(analysis, step_scenario)
            validation_results.extend(tool_validation)
            
            # 4. Validate tool call parameters
            parameter_validation = self._validate_tool_parameters(
                step_result.tool_calls, step_scenario
            )
            validation_results.extend(parameter_validation)
        
        # 5. Apply custom validation rules
        if step_result.output_data:
            rule_validation = self._apply_validation_rules(
                step_result.output_data, step_scenario
            )
            validation_results.extend(rule_validation)
        
        # 6. Update step result with validation results
        step_result.validation_results = validation_results
        
        # 7. Update overall status based on validation
        step_result.status = self._determine_step_status(validation_results, step_scenario)
        
        return step_result
    
    def _validate_tool_execution(
        self,
        step_result: StepExecutionResult,
        step_scenario: StepTestScenario
    ) -> List[ValidationResult]:
        """Validate that tools were executed as expected."""
        validations = []
        
        expected_behavior = step_scenario.expected_behavior
        if not expected_behavior:
            return validations
        
        # Check if tools should be executed
        should_execute_tools = expected_behavior.should_execute_tools
        has_tool_calls = bool(step_result.tool_calls)
        
        if should_execute_tools and not has_tool_calls:
            validations.append(ValidationResult(
                rule_description="Should execute tools",
                expected="Tool calls present",
                actual="No tool calls found",
                passed=False,
                error_message="Expected tool execution but no tool calls were made"
            ))
        elif not should_execute_tools and has_tool_calls:
            validations.append(ValidationResult(
                rule_description="Should not execute tools",
                expected="No tool calls",
                actual="Tool calls found",
                passed=False,
                error_message="Tool calls were made when none were expected"
            ))
        else:
            validations.append(ValidationResult(
                rule_description="Tool execution expectation",
                expected=f"Should execute tools: {should_execute_tools}",
                actual=f"Tool calls made: {has_tool_calls}",
                passed=True
            ))
        
        return validations
    
    def _analyze_tool_usage(self, tool_calls: List[Dict[str, Any]]) -> ToolUsageAnalysis:
        """Analyze tool usage patterns and results."""
        tools_called = []
        tools_with_errors = []
        parameter_completeness = {}
        response_formats_valid = {}
        
        for tool_call in tool_calls:
            tool_name = tool_call.get("tool_name") or tool_call.get("name", "unknown")
            tools_called.append(tool_name)
            
            # Check for errors
            if tool_call.get("error") or tool_call.get("status") == "error":
                tools_with_errors.append(tool_name)
            
            # Analyze parameter completeness
            parameters = tool_call.get("parameters") or tool_call.get("args", {})
            has_required_params = bool(parameters and len(parameters) > 0)
            parameter_completeness[tool_name] = has_required_params
            
            # Validate response format
            response = tool_call.get("response") or tool_call.get("result")
            response_formats_valid[tool_name] = self._is_valid_response_format(response)
        
        return ToolUsageAnalysis(
            tools_called=list(set(tools_called)),
            tool_call_count=len(tool_calls),
            tools_with_errors=list(set(tools_with_errors)),
            parameter_completeness=parameter_completeness,
            response_formats_valid=response_formats_valid
        )
    
    def _is_valid_response_format(self, response: Any) -> bool:
        """Check if tool response has valid format."""
        if response is None:
            return False
        
        # For string responses, check if they're not empty
        if isinstance(response, str):
            return bool(response.strip())
        
        # For dict/list responses, check structure
        if isinstance(response, (dict, list)):
            return True
        
        # For other types, assume valid
        return True
    
    def _validate_expected_tools(
        self,
        analysis: ToolUsageAnalysis,
        step_scenario: StepTestScenario
    ) -> List[ValidationResult]:
        """Validate that expected tools were used."""
        validations = []
        
        expected_behavior = step_scenario.expected_behavior
        if not expected_behavior or not expected_behavior.should_execute_tools:
            return validations
        
        expected_tools = expected_behavior.should_execute_tools
        if isinstance(expected_tools, bool) and expected_tools:
            # If just True, any tool usage is acceptable
            has_tools = len(analysis.tools_called) > 0
            validations.append(ValidationResult(
                rule_description="Any tools should be executed",
                expected="At least one tool called",
                actual=f"{len(analysis.tools_called)} tools called",
                passed=has_tools,
                error_message=None if has_tools else "Expected tool usage but no tools were called"
            ))
        elif isinstance(expected_tools, list):
            # Specific tools expected
            for expected_tool in expected_tools:
                tool_used = expected_tool in analysis.tools_called
                validations.append(ValidationResult(
                    rule_description=f"Tool '{expected_tool}' should be used",
                    expected=f"Tool '{expected_tool}' called",
                    actual=f"Tool '{expected_tool}' {'called' if tool_used else 'not called'}",
                    passed=tool_used,
                    error_message=None if tool_used else f"Expected tool '{expected_tool}' was not used"
                ))
        
        return validations
    
    def _validate_tool_parameters(
        self,
        tool_calls: List[Dict[str, Any]],
        step_scenario: StepTestScenario
    ) -> List[ValidationResult]:
        """Validate tool call parameters."""
        validations = []
        
        for tool_call in tool_calls:
            tool_name = tool_call.get("tool_name") or tool_call.get("name", "unknown")
            parameters = tool_call.get("parameters") or tool_call.get("args", {})
            
            # Basic parameter validation
            has_parameters = bool(parameters)
            validations.append(ValidationResult(
                rule_description=f"Tool '{tool_name}' should have parameters",
                expected="Parameters provided",
                actual=f"Parameters {'provided' if has_parameters else 'missing'}",
                passed=has_parameters,
                error_message=None if has_parameters else f"Tool '{tool_name}' called without parameters"
            ))
            
            # Validate parameter types if they exist
            if has_parameters:
                for param_name, param_value in parameters.items():
                    is_valid_param = self._validate_parameter_value(param_name, param_value)
                    validations.append(ValidationResult(
                        rule_description=f"Parameter '{param_name}' should be valid",
                        expected="Valid parameter value",
                        actual=f"Parameter value: {type(param_value).__name__}",
                        passed=is_valid_param,
                        error_message=None if is_valid_param else f"Invalid parameter '{param_name}' for tool '{tool_name}'"
                    ))
        
        return validations
    
    def _validate_parameter_value(self, param_name: str, param_value: Any) -> bool:
        """Validate individual parameter value."""
        # None values are generally invalid
        if param_value is None:
            return False
        
        # Empty strings are often invalid
        if isinstance(param_value, str) and not param_value.strip():
            return False
        
        # Empty containers are often invalid
        if isinstance(param_value, (list, dict)) and len(param_value) == 0:
            return False
        
        return True
    
    def _apply_validation_rules(
        self,
        output_data: Dict[str, Any],
        step_scenario: StepTestScenario
    ) -> List[ValidationResult]:
        """Apply custom validation rules to tool output."""
        validations = []
        
        if not step_scenario.validation_rules:
            return validations
        
        for rule in step_scenario.validation_rules:
            validation = self._apply_single_validation_rule(output_data, rule)
            validations.append(validation)
        
        return validations
    
    def _apply_single_validation_rule(
        self,
        output_data: Dict[str, Any],
        rule: ValidationRule
    ) -> ValidationResult:
        """Apply single validation rule to tool output."""
        if rule.rule_type == ValidationRuleType.JSON_SCHEMA:
            # Parse JSON schema and validate output
            try:
                schema = json.loads(rule.pattern)
                # Basic schema validation (simplified)
                is_valid = self._validate_against_schema(output_data, schema)
                return ValidationResult(
                    rule_description=rule.description,
                    expected=f"Output matches schema",
                    actual=f"Schema validation {'passed' if is_valid else 'failed'}",
                    passed=is_valid,
                    error_message=None if is_valid else f"Output does not match required JSON schema"
                )
            except json.JSONDecodeError:
                return ValidationResult(
                    rule_description=rule.description,
                    expected="Valid JSON schema",
                    actual="Invalid JSON in validation rule",
                    passed=False,
                    error_message="Validation rule contains invalid JSON schema"
                )
        
        elif rule.rule_type == ValidationRuleType.CONTAINS:
            # Check if output contains pattern
            output_str = json.dumps(output_data) if isinstance(output_data, dict) else str(output_data)
            pattern_found = rule.pattern in output_str
            return ValidationResult(
                rule_description=rule.description,
                expected=f"Output contains: {rule.pattern}",
                actual=f"Pattern {'found' if pattern_found else 'not found'}",
                passed=pattern_found,
                error_message=None if pattern_found else f"Required pattern '{rule.pattern}' not found in output"
            )
        
        elif rule.rule_type == ValidationRuleType.REGEX_MATCH:
            # Apply regex to output
            output_str = json.dumps(output_data) if isinstance(output_data, dict) else str(output_data)
            try:
                pattern_match = bool(re.search(rule.pattern, output_str, re.MULTILINE | re.DOTALL))
                return ValidationResult(
                    rule_description=rule.description,
                    expected=f"Output matches regex: {rule.pattern}",
                    actual=f"Regex {'matches' if pattern_match else 'does not match'}",
                    passed=pattern_match,
                    error_message=None if pattern_match else f"Output does not match required regex pattern: {rule.pattern}"
                )
            except re.error as e:
                return ValidationResult(
                    rule_description=rule.description,
                    expected=f"Valid regex pattern: {rule.pattern}",
                    actual=f"Invalid regex: {str(e)}",
                    passed=False,
                    error_message=f"Invalid regex pattern in validation rule: {str(e)}"
                )
        
        else:
            return ValidationResult(
                rule_description=rule.description,
                expected="Valid rule type",
                actual=f"Unknown rule type: {rule.rule_type}",
                passed=False,
                error_message=f"Unknown validation rule type: {rule.rule_type}"
            )
    
    def _validate_against_schema(self, data: Dict[str, Any], schema: Dict[str, Any]) -> bool:
        """Basic JSON schema validation (simplified implementation)."""
        if not isinstance(schema, dict):
            return False
        
        schema_type = schema.get("type")
        if not schema_type:
            return True  # No type requirement
        
        if schema_type == "object":
            if not isinstance(data, dict):
                return False
            
            # Check required properties
            required = schema.get("required", [])
            for req_field in required:
                if req_field not in data:
                    return False
            
            # Check properties types
            properties = schema.get("properties", {})
            for prop_name, prop_schema in properties.items():
                if prop_name in data:
                    if not self._validate_against_schema(data[prop_name], prop_schema):
                        return False
            
            return True
        
        elif schema_type == "array":
            return isinstance(data, list)
        elif schema_type == "string":
            return isinstance(data, str)
        elif schema_type == "number":
            return isinstance(data, (int, float))
        elif schema_type == "boolean":
            return isinstance(data, bool)
        elif schema_type == "null":
            return data is None
        
        return True  # Unknown type, assume valid
    
    def _determine_step_status(
        self,
        validation_results: List[ValidationResult],
        step_scenario: StepTestScenario
    ) -> StepExecutionStatus:
        """Determine overall step status based on validation results."""
        if not validation_results:
            return StepExecutionStatus.COMPLETED
        
        # Check required validations
        required_validations = [
            v for v in validation_results 
            if self._is_required_validation(v, step_scenario)
        ]
        
        failed_required = [v for v in required_validations if not v.passed]
        if failed_required:
            return StepExecutionStatus.VALIDATION_FAILED
        
        # Check all validations
        failed_any = [v for v in validation_results if not v.passed]
        if failed_any:
            return StepExecutionStatus.VALIDATION_FAILED
        
        return StepExecutionStatus.COMPLETED
    
    def _is_required_validation(
        self,
        validation_result: ValidationResult,
        step_scenario: StepTestScenario
    ) -> bool:
        """Check if validation result corresponds to a required rule."""
        if not step_scenario.validation_rules:
            return True  # All validations are required by default
        
        # Check if this validation corresponds to a required rule
        for rule in step_scenario.validation_rules:
            if rule.description == validation_result.rule_description:
                return rule.required
        
        return True  # Default to required if not explicitly set