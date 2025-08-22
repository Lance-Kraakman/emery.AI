"""
Capability Parser Domain Service

AIDEV-NOTE: Parses agent capabilities dict into structured test scenarios.
Handles both JSON-based capabilities and protobuf-based capability configurations.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass

from ..entities.test_scenario import (
    CapabilityTestScenario, 
    StepTestScenario, 
    StepType, 
    ExpectedStepBehavior,
    ExpectedOutput,
    ValidationRule,
    ValidationRuleType
)
from ...agents.entities.agent import Agent


@dataclass
class ParsedCapability:
    """Parsed capability structure from agent configuration."""
    name: str
    description: str
    steps: List['ParsedStep']
    tools: Optional[List[Dict[str, Any]]] = None
    servers: Optional[List[Dict[str, Any]]] = None


@dataclass 
class ParsedStep:
    """Parsed step structure from capability configuration."""
    id: str
    type: StepType
    instructions: str
    model: Optional[str] = None
    tools: Optional[List[Dict[str, Any]]] = None
    servers: Optional[List[Dict[str, Any]]] = None


class CapabilityParser:
    """Domain service for parsing agent capabilities into testable scenarios."""
    
    def extract_capabilities(self, agent: Agent) -> List[ParsedCapability]:
        """
        Extract structured capabilities from agent.capabilities dict.
        
        AIDEV-NOTE: Handles both array and object formats for capabilities.
        Maps to protobuf CapabilityConfig structure when available.
        """
        if not agent.capabilities:
            return []
        
        capabilities = []
        
        # Handle different capability formats
        if isinstance(agent.capabilities, list):
            # Array format: [CapabilityConfig, ...]
            for cap_data in agent.capabilities:
                parsed_cap = self._parse_capability_object(cap_data)
                if parsed_cap:
                    capabilities.append(parsed_cap)
                    
        elif isinstance(agent.capabilities, dict):
            # Check if it's a single capability object or map of capabilities
            if "name" in agent.capabilities and "steps" in agent.capabilities:
                # Single capability object
                parsed_cap = self._parse_capability_object(agent.capabilities)
                if parsed_cap:
                    capabilities.append(parsed_cap)
            else:
                # Map format: {capability_name: CapabilityConfig, ...}
                for cap_name, cap_data in agent.capabilities.items():
                    if isinstance(cap_data, dict):
                        parsed_cap = self._parse_capability_object(cap_data, default_name=cap_name)
                        if parsed_cap:
                            capabilities.append(parsed_cap)
        
        return capabilities
    
    def _parse_capability_object(self, cap_data: Dict[str, Any], default_name: Optional[str] = None) -> Optional[ParsedCapability]:
        """Parse individual capability object into ParsedCapability."""
        try:
            name = cap_data.get("name", default_name)
            if not name:
                return None
                
            description = cap_data.get("description", f"Capability: {name}")
            steps_data = cap_data.get("steps", [])
            
            steps = []
            for step_data in steps_data:
                parsed_step = self._parse_step_object(step_data)
                if parsed_step:
                    steps.append(parsed_step)
            
            return ParsedCapability(
                name=name,
                description=description,
                steps=steps,
                tools=cap_data.get("tools"),
                servers=cap_data.get("servers")
            )
            
        except Exception as e:
            # Log error but continue processing other capabilities
            print(f"Error parsing capability {cap_data}: {e}")
            return None
    
    def _parse_step_object(self, step_data: Dict[str, Any]) -> Optional[ParsedStep]:
        """Parse individual step object into ParsedStep."""
        try:
            step_id = step_data.get("id")
            step_type_str = step_data.get("type")
            instructions = step_data.get("instructions")
            
            if not all([step_id, step_type_str, instructions]):
                return None
            
            # Map step type string to enum
            step_type = StepType.CODE_STEP if step_type_str == "CODE_STEP" else StepType.TOOL_STEP
            
            return ParsedStep(
                id=step_id,
                type=step_type,
                instructions=instructions,
                model=step_data.get("model"),
                tools=step_data.get("tools"),
                servers=step_data.get("servers")
            )
            
        except Exception as e:
            print(f"Error parsing step {step_data}: {e}")
            return None
    
    def generate_basic_test_scenarios(self, capabilities: List[ParsedCapability]) -> List[CapabilityTestScenario]:
        """
        Generate basic test scenarios for parsed capabilities.
        
        AIDEV-NOTE: Creates default test scenarios with basic validation.
        More sophisticated scenarios should be defined in JSON test files.
        """
        test_scenarios = []
        
        for capability in capabilities:
            # Generate basic input data based on capability steps
            input_data = self._generate_basic_input_data(capability)
            
            # Generate expected outputs
            expected_outputs = self._generate_basic_expected_outputs(capability)
            
            # Generate step test scenarios
            step_tests = []
            for i, step in enumerate(capability.steps):
                step_test = self._generate_basic_step_test(step, i + 1)
                if step_test:
                    step_tests.append(step_test)
            
            test_scenario = CapabilityTestScenario(
                capability_name=capability.name,
                description=f"Basic test for {capability.description}",
                input_data=input_data,
                expected_outputs=expected_outputs,
                step_tests=step_tests,
                timeout_seconds=60,
                tags=["basic", "generated"]
            )
            
            test_scenarios.append(test_scenario)
        
        return test_scenarios
    
    def _generate_basic_input_data(self, capability: ParsedCapability) -> Dict[str, Any]:
        """Generate basic input data for capability based on its structure."""
        input_data = {
            "capability_name": capability.name,
            "test_mode": True
        }
        
        # Analyze step instructions for common input patterns
        instructions_text = " ".join(step.instructions.lower() for step in capability.steps)
        
        # Common input patterns
        if "email" in instructions_text:
            input_data.update({
                "recipient": "test@example.com",
                "subject": "Test Email",
                "body": "This is a test email for capability evaluation."
            })
        
        if "search" in instructions_text:
            input_data.update({
                "query": "test search query",
                "limit": 5
            })
        
        if "analyze" in instructions_text or "data" in instructions_text:
            input_data.update({
                "data": {"test_field": "test_value", "numbers": [1, 2, 3, 4, 5]},
                "analysis_type": "basic"
            })
        
        if "file" in instructions_text:
            input_data.update({
                "file_path": "/tmp/test_file.txt",
                "file_content": "Sample file content for testing."
            })
        
        return input_data
    
    def _generate_basic_expected_outputs(self, capability: ParsedCapability) -> List[ExpectedOutput]:
        """Generate basic expected outputs for capability."""
        return [
            ExpectedOutput(
                output_type="final_result",
                content_pattern=".*success.*|.*complete.*|.*done.*",
                success_criteria=["no_errors", "has_result"],
                validation_rules=[
                    ValidationRule(
                        rule_type=ValidationRuleType.REGEX_MATCH,
                        pattern=".*",
                        description="Any output is acceptable for basic test",
                        required=False
                    )
                ]
            )
        ]
    
    def _generate_basic_step_test(self, step: ParsedStep, execution_order: int) -> Optional[StepTestScenario]:
        """Generate basic step test scenario."""
        expected_behavior = ExpectedStepBehavior(
            execution_order=execution_order
        )
        
        if step.type == StepType.CODE_STEP:
            expected_behavior.should_produce_code = True
            expected_behavior.expected_variables = self._extract_likely_variables(step.instructions)
            
        elif step.type == StepType.TOOL_STEP:
            expected_behavior.should_execute_tools = self._extract_likely_tools(step.instructions, step.tools)
        
        return StepTestScenario(
            step_id=step.id,
            step_type=step.type,
            description=f"Basic test for step: {step.instructions[:50]}...",
            input_context={"step_order": execution_order, "previous_results": {}},
            expected_behavior=expected_behavior,
            validation_rules=[
                ValidationRule(
                    rule_type=ValidationRuleType.CONTAINS,
                    pattern="",  # Will be filled by evaluator
                    description="Basic step execution validation",
                    required=False
                )
            ],
            timeout_seconds=30
        )
    
    def _extract_likely_variables(self, instructions: str) -> List[str]:
        """Extract likely variable names from step instructions."""
        # Simple heuristic to guess variable names from instructions
        common_variables = []
        instructions_lower = instructions.lower()
        
        if "email" in instructions_lower:
            common_variables.extend(["email_data", "recipient", "subject", "body"])
        if "result" in instructions_lower:
            common_variables.append("result")
        if "data" in instructions_lower:
            common_variables.append("data")
        if "response" in instructions_lower:
            common_variables.append("response")
        
        return common_variables
    
    def _extract_likely_tools(self, instructions: str, step_tools: Optional[List[Dict[str, Any]]]) -> List[str]:
        """Extract likely tool names from step instructions and configuration."""
        tools = []
        
        # Extract from step tools configuration
        if step_tools:
            for tool_config in step_tools:
                if isinstance(tool_config, dict) and "name" in tool_config:
                    tools.append(tool_config["name"])
        
        # Extract from instructions text
        instructions_lower = instructions.lower()
        common_tool_patterns = {
            "email": ["gmail", "email"],
            "search": ["search", "web_search", "google"],
            "file": ["file_reader", "file_writer"],
            "api": ["http_client", "api_client"],
            "database": ["database", "sql"]
        }
        
        for pattern, tool_names in common_tool_patterns.items():
            if pattern in instructions_lower:
                tools.extend(tool_names)
        
        return list(set(tools))  # Remove duplicates
    
    def validate_capability_structure(self, capability: ParsedCapability) -> List[str]:
        """Validate parsed capability structure and return any errors."""
        errors = []
        
        if not capability.name:
            errors.append("Capability must have a name")
        
        if not capability.steps:
            errors.append(f"Capability '{capability.name}' must have at least one step")
        
        step_ids = set()
        for step in capability.steps:
            if not step.id:
                errors.append(f"Step in capability '{capability.name}' must have an ID")
            elif step.id in step_ids:
                errors.append(f"Duplicate step ID '{step.id}' in capability '{capability.name}'")
            else:
                step_ids.add(step.id)
            
            if not step.instructions:
                errors.append(f"Step '{step.id}' in capability '{capability.name}' must have instructions")
        
        return errors