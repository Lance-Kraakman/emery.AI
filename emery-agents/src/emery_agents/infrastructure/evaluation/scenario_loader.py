"""
Test Scenario Loader

AIDEV-NOTE: Infrastructure service for loading JSON test scenarios.
Converts JSON configurations into domain entities for evaluation.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from ...domain.evaluation.entities.test_scenario import (
    TestScenario,
    TestSuiteConfig,
    CapabilityTestScenario,
    StepTestScenario,
    StepType,
    ExpectedOutput,
    ExpectedStepBehavior,
    ValidationRule,
    ValidationRuleType
)


class TestScenarioLoader:
    """Infrastructure service for loading test scenarios from JSON files."""
    
    def __init__(self, scenarios_directory: Optional[str] = None):
        """
        Initialize scenario loader with scenarios directory.
        
        Args:
            scenarios_directory: Path to directory containing scenario JSON files.
                                If None, uses default test scenarios directory.
        """
        if scenarios_directory:
            self.scenarios_dir = Path(scenarios_directory)
        else:
            # Default to scenarios directory in tests
            # Navigate from src/emery_agents/infrastructure/evaluation/scenario_loader.py
            # to tests/evaluation/scenarios/
            current_dir = Path(__file__).parent
            project_root = current_dir.parent.parent.parent.parent  # Go up to project root
            self.scenarios_dir = project_root / "tests" / "evaluation" / "scenarios"
    
    def load_scenario_by_name(self, scenario_name: str) -> Optional[TestScenario]:
        """
        Load test scenario by name from JSON file.
        
        Args:
            scenario_name: Name of scenario file (without .json extension)
            
        Returns:
            TestScenario instance or None if not found
        """
        scenario_file = self.scenarios_dir / f"{scenario_name}.json"
        if not scenario_file.exists():
            print(f"[SCENARIO-LOADER] Scenario file not found: {scenario_file}")
            return None
        
        try:
            with open(scenario_file, 'r', encoding='utf-8') as f:
                scenario_data = json.load(f)
            
            return self._parse_scenario_json(scenario_data, scenario_name)
            
        except Exception as e:
            print(f"[SCENARIO-LOADER] Error loading scenario '{scenario_name}': {e}")
            return None
    
    def load_all_scenarios(self) -> List[TestScenario]:
        """
        Load all test scenarios from the scenarios directory.
        
        Returns:
            List of TestScenario instances
        """
        scenarios = []
        
        if not self.scenarios_dir.exists():
            print(f"[SCENARIO-LOADER] Scenarios directory not found: {self.scenarios_dir}")
            return scenarios
        
        for scenario_file in self.scenarios_dir.glob("*.json"):
            scenario_name = scenario_file.stem
            scenario = self.load_scenario_by_name(scenario_name)
            if scenario:
                scenarios.append(scenario)
        
        print(f"[SCENARIO-LOADER] Loaded {len(scenarios)} test scenarios")
        return scenarios
    
    def list_available_scenarios(self) -> List[str]:
        """
        List names of available test scenario files.
        
        Returns:
            List of scenario names (without .json extension)
        """
        if not self.scenarios_dir.exists():
            return []
        
        return [f.stem for f in self.scenarios_dir.glob("*.json")]
    
    def load_scenarios_by_tag(self, tag: str) -> List[TestScenario]:
        """
        Load test scenarios that contain a specific tag.
        
        Args:
            tag: Tag to filter scenarios by
            
        Returns:
            List of TestScenario instances matching the tag
        """
        all_scenarios = self.load_all_scenarios()
        tagged_scenarios = []
        
        for scenario in all_scenarios:
            for capability_scenario in scenario.capability_scenarios:
                if capability_scenario.tags and tag in capability_scenario.tags:
                    tagged_scenarios.append(scenario)
                    break
        
        return tagged_scenarios
    
    def load_scenarios_for_capability(self, capability_name: str) -> List[CapabilityTestScenario]:
        """
        Load all scenarios for a specific capability across all test files.
        
        Args:
            capability_name: Name of capability to find scenarios for
            
        Returns:
            List of CapabilityTestScenario instances for the capability
        """
        capability_scenarios = []
        all_scenarios = self.load_all_scenarios()
        
        for scenario in all_scenarios:
            for capability_scenario in scenario.capability_scenarios:
                if capability_scenario.capability_name == capability_name:
                    capability_scenarios.append(capability_scenario)
        
        return capability_scenarios
    
    def _parse_scenario_json(self, data: Dict[str, Any], scenario_name: str) -> TestScenario:
        """Parse JSON data into TestScenario domain entity."""
        # Parse test suite configuration
        test_suite_data = data.get("test_suite", {})
        suite_config = TestSuiteConfig(
            name=test_suite_data.get("name", scenario_name),
            description=test_suite_data.get("description", f"Test scenario: {scenario_name}"),
            tags=test_suite_data.get("tags")
        )
        
        # Parse capabilities
        capability_scenarios = []
        capabilities_data = data.get("capabilities", [])
        
        for cap_data in capabilities_data:
            capability_scenario = self._parse_capability_scenario(cap_data)
            if capability_scenario:
                capability_scenarios.append(capability_scenario)
        
        # Create test scenario
        return TestScenario.create(suite_config, capability_scenarios)
    
    def _parse_capability_scenario(self, cap_data: Dict[str, Any]) -> Optional[CapabilityTestScenario]:
        """Parse capability scenario data from JSON."""
        try:
            capability_name = cap_data["capability_name"]
            description = cap_data.get("description", f"Test for {capability_name}")
            
            # Parse scenarios (multiple test cases for one capability)
            scenarios_data = cap_data.get("scenarios", [])
            if not scenarios_data:
                print(f"[SCENARIO-LOADER] No scenarios found for capability '{capability_name}'")
                return None
            
            # For now, use the first scenario as the primary test
            # TODO: Support multiple scenarios per capability
            primary_scenario = scenarios_data[0]
            
            # Parse expected outputs
            expected_outputs = []
            for output_data in primary_scenario.get("expected_outputs", []):
                expected_output = self._parse_expected_output(output_data)
                if expected_output:
                    expected_outputs.append(expected_output)
            
            # Parse step tests
            step_tests = []
            for step_data in primary_scenario.get("step_tests", []):
                step_test = self._parse_step_test_scenario(step_data)
                if step_test:
                    step_tests.append(step_test)
            
            return CapabilityTestScenario(
                capability_name=capability_name,
                description=description,
                input_data=primary_scenario.get("input_data", {}),
                expected_outputs=expected_outputs,
                step_tests=step_tests,
                timeout_seconds=cap_data.get("timeout_seconds", 60),
                tags=cap_data.get("tags"),
                prerequisites=cap_data.get("prerequisites")
            )
            
        except KeyError as e:
            print(f"[SCENARIO-LOADER] Missing required field in capability scenario: {e}")
            return None
        except Exception as e:
            print(f"[SCENARIO-LOADER] Error parsing capability scenario: {e}")
            return None
    
    def _parse_expected_output(self, output_data: Dict[str, Any]) -> Optional[ExpectedOutput]:
        """Parse expected output data from JSON."""
        try:
            validation_rules = None
            if output_data.get("validation_rules"):
                validation_rules = []
                for rule_data in output_data["validation_rules"]:
                    validation_rule = self._parse_validation_rule(rule_data)
                    if validation_rule:
                        validation_rules.append(validation_rule)
            
            return ExpectedOutput(
                output_type=output_data["output_type"],
                content_pattern=output_data["content_pattern"],
                success_criteria=output_data.get("success_criteria", []),
                validation_rules=validation_rules
            )
            
        except KeyError as e:
            print(f"[SCENARIO-LOADER] Missing required field in expected output: {e}")
            return None
    
    def _parse_step_test_scenario(self, step_data: Dict[str, Any]) -> Optional[StepTestScenario]:
        """Parse step test scenario data from JSON."""
        try:
            # Parse step type
            step_type_str = step_data["step_type"]
            step_type = StepType.CODE_STEP if step_type_str == "CODE_STEP" else StepType.TOOL_STEP
            
            # Parse expected behavior
            expected_behavior_data = step_data.get("expected_behavior", {})
            expected_behavior = ExpectedStepBehavior(
                should_execute_tools=expected_behavior_data.get("should_execute_tools"),
                should_produce_code=expected_behavior_data.get("should_produce_code", False),
                expected_variables=expected_behavior_data.get("expected_variables"),
                expected_outputs=expected_behavior_data.get("expected_outputs"),
                execution_order=expected_behavior_data.get("execution_order"),
                max_execution_time_ms=expected_behavior_data.get("max_execution_time_ms")
            )
            
            # Parse validation rules
            validation_rules = None
            if step_data.get("validation_rules"):
                validation_rules = []
                for rule_data in step_data["validation_rules"]:
                    validation_rule = self._parse_validation_rule(rule_data)
                    if validation_rule:
                        validation_rules.append(validation_rule)
            
            return StepTestScenario(
                step_id=step_data["step_id"],
                step_type=step_type,
                description=step_data.get("description", f"Step: {step_data['step_id']}"),
                input_context=step_data.get("input_context", {}),
                expected_behavior=expected_behavior,
                validation_rules=validation_rules,
                timeout_seconds=step_data.get("timeout_seconds", 30)
            )
            
        except KeyError as e:
            print(f"[SCENARIO-LOADER] Missing required field in step test scenario: {e}")
            return None
    
    def _parse_validation_rule(self, rule_data: Dict[str, Any]) -> Optional[ValidationRule]:
        """Parse validation rule data from JSON."""
        try:
            rule_type_str = rule_data["rule_type"]
            rule_type = ValidationRuleType(rule_type_str)
            
            return ValidationRule(
                rule_type=rule_type,
                pattern=rule_data["pattern"],
                description=rule_data.get("description", "Validation rule"),
                required=rule_data.get("required", True)
            )
            
        except (KeyError, ValueError) as e:
            print(f"[SCENARIO-LOADER] Error parsing validation rule: {e}")
            return None
    
    def validate_scenario_file(self, scenario_name: str) -> List[str]:
        """
        Validate a scenario file and return any structural errors.
        
        Args:
            scenario_name: Name of scenario file to validate
            
        Returns:
            List of error messages, empty if valid
        """
        errors = []
        
        scenario_file = self.scenarios_dir / f"{scenario_name}.json"
        if not scenario_file.exists():
            errors.append(f"Scenario file not found: {scenario_file}")
            return errors
        
        try:
            with open(scenario_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Basic structure validation
            if "capabilities" not in data:
                errors.append("Missing 'capabilities' section in scenario file")
                return errors
            
            if not isinstance(data["capabilities"], list):
                errors.append("'capabilities' must be a list")
                return errors
            
            # Validate each capability
            for i, cap_data in enumerate(data["capabilities"]):
                cap_errors = self._validate_capability_data(cap_data, i)
                errors.extend(cap_errors)
            
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON format: {e}")
        except Exception as e:
            errors.append(f"Error validating scenario file: {e}")
        
        return errors
    
    def _validate_capability_data(self, cap_data: Dict[str, Any], index: int) -> List[str]:
        """Validate individual capability data structure."""
        errors = []
        prefix = f"Capability {index}"
        
        required_fields = ["capability_name", "description"]
        for field in required_fields:
            if field not in cap_data:
                errors.append(f"{prefix}: Missing required field '{field}'")
        
        if "scenarios" not in cap_data or not cap_data["scenarios"]:
            errors.append(f"{prefix}: Must have at least one scenario")
            return errors
        
        # Validate first scenario structure
        scenario = cap_data["scenarios"][0]
        scenario_required = ["name", "input_data", "expected_outputs"]
        for field in scenario_required:
            if field not in scenario:
                errors.append(f"{prefix} scenario: Missing required field '{field}'")
        
        return errors