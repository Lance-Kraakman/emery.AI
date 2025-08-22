"""
Code Step Evaluator

AIDEV-NOTE: Domain service for evaluating CODE_STEP execution results.
Validates code generation, variable creation, and execution success.
"""

import re
import ast
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from ..entities.test_scenario import StepTestScenario, ValidationRule, ValidationRuleType
from ..entities.evaluation_result import StepExecutionResult, StepExecutionStatus, ValidationResult


@dataclass
class CodeAnalysisResult:
    """Result of code analysis for CODE_STEP."""
    has_code: bool
    variables_defined: List[str]
    functions_defined: List[str]
    imports_used: List[str]
    syntax_valid: bool
    estimated_complexity: int
    code_length: int


class CodeStepEvaluator:
    """Domain service for evaluating CODE_STEP execution results."""
    
    def evaluate_code_step(
        self, 
        step_result: StepExecutionResult,
        step_scenario: StepTestScenario
    ) -> StepExecutionResult:
        """
        Evaluate CODE_STEP execution against test scenario expectations.
        
        Args:
            step_result: Actual execution result from agent
            step_scenario: Test scenario with expected behavior
            
        Returns:
            Updated StepExecutionResult with validation results
        """
        validation_results = []
        
        # 1. Validate code was generated
        code_validation = self._validate_code_generation(step_result, step_scenario)
        validation_results.extend(code_validation)
        
        # 2. Analyze generated code
        if step_result.generated_code:
            analysis = self._analyze_code(step_result.generated_code)
            
            # 3. Validate expected variables
            variable_validation = self._validate_expected_variables(
                analysis, step_scenario
            )
            validation_results.extend(variable_validation)
            
            # 4. Apply custom validation rules
            rule_validation = self._apply_validation_rules(
                step_result.generated_code, step_scenario
            )
            validation_results.extend(rule_validation)
        
        # 5. Update step result with validation results
        step_result.validation_results = validation_results
        
        # 6. Update overall status based on validation
        step_result.status = self._determine_step_status(validation_results, step_scenario)
        
        return step_result
    
    def _validate_code_generation(
        self, 
        step_result: StepExecutionResult,
        step_scenario: StepTestScenario
    ) -> List[ValidationResult]:
        """Validate that code was generated as expected."""
        validations = []
        
        expected_behavior = step_scenario.expected_behavior
        if not expected_behavior:
            return validations
        
        # Check if code should be generated
        should_produce_code = expected_behavior.should_produce_code
        has_code = bool(step_result.generated_code and step_result.generated_code.strip())
        
        if should_produce_code and not has_code:
            validations.append(ValidationResult(
                rule_description="Should produce code",
                expected="Generated code present",
                actual="No code generated",
                passed=False,
                error_message="Expected code generation but no code was produced"
            ))
        elif not should_produce_code and has_code:
            validations.append(ValidationResult(
                rule_description="Should not produce code",
                expected="No code generated",
                actual="Code generated",
                passed=False,
                error_message="Code was generated when none was expected"
            ))
        else:
            validations.append(ValidationResult(
                rule_description="Code generation expectation",
                expected=f"Should produce code: {should_produce_code}",
                actual=f"Code generated: {has_code}",
                passed=True
            ))
        
        return validations
    
    def _analyze_code(self, code: str) -> CodeAnalysisResult:
        """Analyze generated code structure and content."""
        variables_defined = []
        functions_defined = []
        imports_used = []
        syntax_valid = True
        
        try:
            # Parse AST for detailed analysis
            tree = ast.parse(code)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    # Variable assignments
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            variables_defined.append(target.id)
                elif isinstance(node, ast.FunctionDef):
                    functions_defined.append(node.name)
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        imports_used.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports_used.append(node.module)
        
        except SyntaxError:
            syntax_valid = False
            # Fallback to regex-based analysis for invalid syntax
            variables_defined = self._extract_variables_regex(code)
            functions_defined = self._extract_functions_regex(code)
            imports_used = self._extract_imports_regex(code)
        
        return CodeAnalysisResult(
            has_code=bool(code.strip()),
            variables_defined=variables_defined,
            functions_defined=functions_defined,
            imports_used=imports_used,
            syntax_valid=syntax_valid,
            estimated_complexity=len(code.split('\n')),
            code_length=len(code)
        )
    
    def _extract_variables_regex(self, code: str) -> List[str]:
        """Extract variable names using regex as fallback."""
        pattern = r'(\w+)\s*='
        matches = re.findall(pattern, code)
        return list(set(matches))
    
    def _extract_functions_regex(self, code: str) -> List[str]:
        """Extract function names using regex as fallback."""
        pattern = r'def\s+(\w+)\s*\('
        matches = re.findall(pattern, code)
        return list(set(matches))
    
    def _extract_imports_regex(self, code: str) -> List[str]:
        """Extract import names using regex as fallback."""
        patterns = [
            r'import\s+(\w+)',
            r'from\s+(\w+)',
        ]
        imports = []
        for pattern in patterns:
            matches = re.findall(pattern, code)
            imports.extend(matches)
        return list(set(imports))
    
    def _validate_expected_variables(
        self,
        analysis: CodeAnalysisResult,
        step_scenario: StepTestScenario
    ) -> List[ValidationResult]:
        """Validate that expected variables were defined."""
        validations = []
        
        expected_behavior = step_scenario.expected_behavior
        if not expected_behavior or not expected_behavior.expected_variables:
            return validations
        
        expected_vars = expected_behavior.expected_variables
        defined_vars = analysis.variables_defined
        
        for expected_var in expected_vars:
            is_defined = expected_var in defined_vars
            validations.append(ValidationResult(
                rule_description=f"Variable '{expected_var}' should be defined",
                expected=f"Variable '{expected_var}' present",
                actual=f"Variable '{expected_var}' {'present' if is_defined else 'missing'}",
                passed=is_defined,
                error_message=None if is_defined else f"Expected variable '{expected_var}' not found in generated code"
            ))
        
        return validations
    
    def _apply_validation_rules(
        self,
        code: str,
        step_scenario: StepTestScenario
    ) -> List[ValidationResult]:
        """Apply custom validation rules to generated code."""
        validations = []
        
        if not step_scenario.validation_rules:
            return validations
        
        for rule in step_scenario.validation_rules:
            validation = self._apply_single_validation_rule(code, rule)
            validations.append(validation)
        
        return validations
    
    def _apply_single_validation_rule(
        self,
        code: str,
        rule: ValidationRule
    ) -> ValidationResult:
        """Apply single validation rule to code."""
        if rule.rule_type == ValidationRuleType.CONTAINS:
            pattern_found = rule.pattern in code
            return ValidationResult(
                rule_description=rule.description,
                expected=f"Code contains: {rule.pattern}",
                actual=f"Pattern {'found' if pattern_found else 'not found'}",
                passed=pattern_found,
                error_message=None if pattern_found else f"Required pattern '{rule.pattern}' not found in code"
            )
        
        elif rule.rule_type == ValidationRuleType.REGEX_MATCH:
            try:
                pattern_match = bool(re.search(rule.pattern, code, re.MULTILINE | re.DOTALL))
                return ValidationResult(
                    rule_description=rule.description,
                    expected=f"Code matches regex: {rule.pattern}",
                    actual=f"Regex {'matches' if pattern_match else 'does not match'}",
                    passed=pattern_match,
                    error_message=None if pattern_match else f"Code does not match required regex pattern: {rule.pattern}"
                )
            except re.error as e:
                return ValidationResult(
                    rule_description=rule.description,
                    expected=f"Valid regex pattern: {rule.pattern}",
                    actual=f"Invalid regex: {str(e)}",
                    passed=False,
                    error_message=f"Invalid regex pattern in validation rule: {str(e)}"
                )
        
        elif rule.rule_type == ValidationRuleType.JSON_SCHEMA:
            # For code steps, JSON schema validation doesn't apply
            return ValidationResult(
                rule_description=rule.description,
                expected="JSON schema validation",
                actual="Not applicable for code validation",
                passed=True,
                error_message=None
            )
        
        else:
            return ValidationResult(
                rule_description=rule.description,
                expected="Valid rule type",
                actual=f"Unknown rule type: {rule.rule_type}",
                passed=False,
                error_message=f"Unknown validation rule type: {rule.rule_type}"
            )
    
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