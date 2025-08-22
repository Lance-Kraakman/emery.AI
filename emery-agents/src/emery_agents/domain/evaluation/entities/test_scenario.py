"""
Test Scenario Domain Entities

AIDEV-NOTE: Entities for defining capability and step-level test scenarios.
Maps to agent capability structure with CapabilityConfig and StepConfig.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from enum import Enum


class StepType(Enum):
    """Step execution types matching gRPC protobuf definitions."""
    CODE_STEP = "CODE_STEP"
    TOOL_STEP = "TOOL_STEP"


class ValidationRuleType(Enum):
    """Types of validation rules for step execution."""
    REGEX_MATCH = "regex_match"
    EXACT_MATCH = "exact_match"
    CONTAINS = "contains"
    JSON_SCHEMA = "json_schema"
    CUSTOM_FUNCTION = "custom_function"


@dataclass
class ValidationRule:
    """Rule for validating step or capability execution results."""
    rule_type: ValidationRuleType
    pattern: str
    description: str
    required: bool = True


@dataclass
class ExpectedOutput:
    """Expected output for capability execution."""
    output_type: str  # "final_result", "intermediate_step", "tool_call", "code_output"
    content_pattern: str  # Regex or exact match pattern
    success_criteria: List[str]
    validation_rules: Optional[List[ValidationRule]] = None


@dataclass
class ExpectedStepBehavior:
    """Expected behavior for individual step execution."""
    should_execute_tools: Optional[List[str]] = None  # Tool names that should be called
    should_produce_code: bool = False  # For CODE_STEP validation
    expected_variables: Optional[List[str]] = None  # Variables that should be created
    expected_outputs: Optional[List[str]] = None  # Output patterns expected
    execution_order: Optional[int] = None
    max_execution_time_ms: Optional[int] = None


@dataclass
class StepTestScenario:
    """Test scenario for individual capability step."""
    step_id: str
    step_type: StepType
    description: str
    input_context: Dict[str, Any]
    expected_behavior: ExpectedStepBehavior
    validation_rules: Optional[List[ValidationRule]] = None
    timeout_seconds: int = 30


@dataclass
class CapabilityTestScenario:
    """Test scenario for specific agent capability."""
    capability_name: str
    description: str
    input_data: Dict[str, Any]
    expected_outputs: List[ExpectedOutput]
    step_tests: List[StepTestScenario]
    timeout_seconds: int = 60
    tags: Optional[List[str]] = None  # For categorizing tests (e.g., "oauth", "integration")
    prerequisites: Optional[Dict[str, Any]] = None  # Required environment/setup


@dataclass
class TestSuiteConfig:
    """Configuration for creating test scenarios."""
    name: str
    description: str
    agent_id: Optional[int] = None
    capabilities: Optional[List[str]] = None  # Specific capabilities to test
    tags: Optional[List[str]] = None
    parallel_execution: bool = False
    created_at: Optional[datetime] = None


class TestScenario:
    """Test scenario entity with business logic."""
    
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        test_suite_name: str,
        capability_scenarios: List[CapabilityTestScenario],
        created_at: Optional[datetime] = None
    ):
        self.id = id
        self.name = name
        self.description = description
        self.test_suite_name = test_suite_name
        self.capability_scenarios = capability_scenarios
        self.created_at = created_at or datetime.utcnow()
    
    @classmethod
    def create(cls, config: TestSuiteConfig, capability_scenarios: List[CapabilityTestScenario]) -> "TestScenario":
        """Create new test scenario instance."""
        import uuid
        
        return cls(
            id=str(uuid.uuid4()),
            name=config.name,
            description=config.description,
            test_suite_name=config.name,
            capability_scenarios=capability_scenarios,
            created_at=config.created_at or datetime.utcnow()
        )
    
    @classmethod
    def from_persistence(cls, data: Dict[str, Any]) -> "TestScenario":
        """Create test scenario from persistence data."""
        capability_scenarios = []
        for cap_data in data.get("capability_scenarios", []):
            step_tests = []
            for step_data in cap_data.get("step_tests", []):
                expected_behavior = ExpectedStepBehavior(**step_data.get("expected_behavior", {}))
                validation_rules = None
                if step_data.get("validation_rules"):
                    validation_rules = [ValidationRule(**rule) for rule in step_data["validation_rules"]]
                
                step_tests.append(StepTestScenario(
                    step_id=step_data["step_id"],
                    step_type=StepType(step_data["step_type"]),
                    description=step_data["description"],
                    input_context=step_data["input_context"],
                    expected_behavior=expected_behavior,
                    validation_rules=validation_rules,
                    timeout_seconds=step_data.get("timeout_seconds", 30)
                ))
            
            expected_outputs = []
            for output_data in cap_data.get("expected_outputs", []):
                validation_rules = None
                if output_data.get("validation_rules"):
                    validation_rules = [ValidationRule(**rule) for rule in output_data["validation_rules"]]
                
                expected_outputs.append(ExpectedOutput(
                    output_type=output_data["output_type"],
                    content_pattern=output_data["content_pattern"],
                    success_criteria=output_data["success_criteria"],
                    validation_rules=validation_rules
                ))
            
            capability_scenarios.append(CapabilityTestScenario(
                capability_name=cap_data["capability_name"],
                description=cap_data["description"],
                input_data=cap_data["input_data"],
                expected_outputs=expected_outputs,
                step_tests=step_tests,
                timeout_seconds=cap_data.get("timeout_seconds", 60),
                tags=cap_data.get("tags"),
                prerequisites=cap_data.get("prerequisites")
            ))
        
        return cls(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            test_suite_name=data["test_suite_name"],
            capability_scenarios=capability_scenarios,
            created_at=data.get("created_at")
        )
    
    # Business logic methods
    @property
    def total_capabilities(self) -> int:
        """Get total number of capabilities being tested."""
        return len(self.capability_scenarios)
    
    @property
    def total_steps(self) -> int:
        """Get total number of steps across all capabilities."""
        return sum(len(cap.step_tests) for cap in self.capability_scenarios)
    
    def get_capability_scenario(self, capability_name: str) -> Optional[CapabilityTestScenario]:
        """Get specific capability test scenario by name."""
        for scenario in self.capability_scenarios:
            if scenario.capability_name == capability_name:
                return scenario
        return None
    
    def get_scenarios_by_tag(self, tag: str) -> List[CapabilityTestScenario]:
        """Get capability scenarios that have a specific tag."""
        return [scenario for scenario in self.capability_scenarios 
                if scenario.tags and tag in scenario.tags]
    
    @property
    def estimated_duration_seconds(self) -> int:
        """Estimate total execution time for all scenarios."""
        return sum(scenario.timeout_seconds for scenario in self.capability_scenarios)
    
    def validate_scenario_structure(self) -> List[str]:
        """Validate test scenario structure and return any errors."""
        errors = []
        
        if not self.capability_scenarios:
            errors.append("Test scenario must have at least one capability scenario")
        
        capability_names = set()
        for scenario in self.capability_scenarios:
            if scenario.capability_name in capability_names:
                errors.append(f"Duplicate capability name: {scenario.capability_name}")
            capability_names.add(scenario.capability_name)
            
            # Validate step IDs are unique within capability
            step_ids = set()
            for step in scenario.step_tests:
                if step.step_id in step_ids:
                    errors.append(f"Duplicate step ID '{step.step_id}' in capability '{scenario.capability_name}'")
                step_ids.add(step.step_id)
        
        return errors