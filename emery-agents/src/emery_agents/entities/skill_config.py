"""
Skill Configuration DTO for Dynamic Execution.

AIDEV-NOTE: Part of dynamic execution architecture (Jan 2026).
Replaces proto SkillConfig for API-driven skill execution.
Converts camelCase API response to snake_case dataclass.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class InputDefinition:
    """Skill input definition."""
    name: str
    type: str = "string"
    description: str = ""
    required: bool = False
    default_value: Optional[Any] = None
    input_mapping: Optional[Dict[str, Any]] = None

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> "InputDefinition":
        """Create from API response (camelCase)."""
        return cls(
            name=data.get("name", ""),
            type=data.get("type", "string"),
            description=data.get("description", ""),
            required=data.get("required", False),
            default_value=data.get("defaultValue"),
        )

    @classmethod
    def from_proto(cls, proto: Any) -> "InputDefinition":
        """Create from proto InputDefinition."""
        input_def = cls(
            name=proto.name,
            type=proto.type,
            required=proto.required,
        )
        if proto.HasField('input_mapping'):
            source = proto.input_mapping.source
            mapping: Dict[str, Any] = {
                "source": {
                    "table_id": source.table_id,
                    "field_id": source.field_id,
                }
            }
            if source.HasField('row_source'):
                rs = source.row_source
                mapping["source"]["row_source"] = {
                    "static_id": rs.static_id,
                    "skill_input": rs.skill_input,
                    "skill_output": rs.skill_output,
                    "use_source_row": rs.use_source_row,
                }
            input_def.input_mapping = mapping
        return input_def


@dataclass
class OutputSourceDTO:
    """Output source configuration for mapping node outputs to skill outputs."""
    type: str = ""
    node_id: str = ""
    output_name: str = ""


@dataclass
class OutputDefinition:
    """Skill output definition."""
    name: str
    type: str = "string"
    description: str = ""
    source: Optional[OutputSourceDTO] = None
    output_mapping: Optional[Dict[str, Any]] = None

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> "OutputDefinition":
        """Create from API response (camelCase)."""
        source_data = data.get("source")
        source = OutputSourceDTO(**source_data) if isinstance(source_data, dict) else None
        return cls(
            name=data.get("name", ""),
            type=data.get("type", "string"),
            description=data.get("description", ""),
            source=source,
        )

    @classmethod
    def from_proto(cls, proto: Any) -> "OutputDefinition":
        """Create from proto OutputDefinition."""
        output_def = cls(
            name=proto.name,
            type=proto.type,
            description=proto.description,
        )
        if proto.HasField('source'):
            output_def.source = OutputSourceDTO(
                type=proto.source.type,
                node_id=proto.source.node_id,
                output_name=proto.source.output_name,
            )
        if proto.HasField('output_mapping'):
            om = proto.output_mapping
            table_mappings = []
            for tm in om.table_mappings:
                fm_list = []
                for fm in tm.mappings:
                    fm_list.append({
                        "source_name": fm.source.skill_output if fm.HasField('source') else "",
                        "field_id": fm.target_field_id,
                    })
                table_mappings.append({
                    "table_id": tm.target_table_id,
                    "row_action": tm.row_action,
                    "field_mappings": fm_list,
                })
            output_def.output_mapping = {
                "mode": om.mode,
                "table_mappings": table_mappings,
            }
        return output_def


@dataclass
class ToolConfigDTO:
    """Tool configuration for skill execution."""
    name: str
    tool_type: str = "pipedream"
    config: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> "ToolConfigDTO":
        """Create from API response (camelCase)."""
        return cls(
            name=data.get("name", ""),
            tool_type=data.get("toolType", data.get("tool_type", "pipedream")),
            config=data.get("config", {}),
        )

    @classmethod
    def from_proto(cls, proto: Any) -> "ToolConfigDTO":
        """Create from proto ToolConfig."""
        return cls(
            name=proto.name,
            tool_type="pipedream",
            config=dict(proto.config) if proto.config else {},
        )


@dataclass
class SkillStepDTO:
    """Skill step for workflow execution."""
    id: str
    name: str
    step_type: str = "agentic"
    config: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> "SkillStepDTO":
        """Create from API response (camelCase)."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            step_type=data.get("stepType", data.get("step_type", "agentic")),
            config=data.get("config", {}),
            dependencies=data.get("dependencies", []),
        )

    @classmethod
    def from_proto(cls, proto: Any) -> "SkillStepDTO":
        """Create from proto SkillStep."""
        step = cls(id=proto.id, name=proto.name)
        if proto.HasField('agentic_config'):
            step.step_type = "agentic"
            step.config = {
                "instructions": proto.agentic_config.instructions,
                "model": proto.agentic_config.model,
                "agent_type": proto.agentic_config.agent_type,
            }
            if proto.agentic_config.HasField('plan') and proto.agentic_config.plan.id:
                plan = proto.agentic_config.plan
                step.config["plan"] = {
                    "id": plan.id,
                    "goal": plan.goal,
                    "basic_instructions": plan.basic_instructions,
                    "context": plan.context,
                    "analysis": plan.analysis,
                    "version": plan.version,
                    "generated_at": plan.generated_at,
                    "approved_at": plan.approved_at,
                    "steps": [
                        {
                            "step_id": ps.step_id,
                            "description": ps.description,
                            "tool_call": ps.tool_call,
                            "parameters": dict(ps.parameters),
                            "context_tables": list(ps.context_tables),
                            "target_agent": ps.target_agent,
                            "prompt_template": ps.prompt_template,
                            "required_context": list(ps.required_context),
                        }
                        for ps in plan.steps
                    ],
                }
        elif proto.HasField('read_config'):
            step.step_type = "read"
        elif proto.HasField('write_config'):
            step.step_type = "write"
        return step


@dataclass
class SkillConfigDTO:
    """
    Skill configuration for execution.

    Created from API response (from_api_response) or proto boundary (from_proto).
    Used by SkillExecutorService.execute_skill().
    """
    id: int
    name: str
    description: str = ""
    instructions: str = ""
    execution_type: str = "agentic"
    model: Optional[str] = None
    agent_type: Optional[str] = None
    inputs: List[InputDefinition] = field(default_factory=list)
    outputs: List[OutputDefinition] = field(default_factory=list)
    tools: List[ToolConfigDTO] = field(default_factory=list)
    steps: List[SkillStepDTO] = field(default_factory=list)
    content: List[Any] = field(default_factory=list)
    # Raw proto steps for passthrough to StepExecutorService (only from from_proto)
    _proto_steps: Optional[List[Any]] = field(default=None, repr=False)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> "SkillConfigDTO":
        """Create from API response (camelCase)."""
        inputs = [
            InputDefinition.from_api_response(i) if isinstance(i, dict) else i
            for i in data.get("inputs", [])
        ]
        outputs = [
            OutputDefinition.from_api_response(o) if isinstance(o, dict) else o
            for o in data.get("outputs", [])
        ]
        tools = [
            ToolConfigDTO.from_api_response(t) if isinstance(t, dict) else t
            for t in data.get("tools", [])
        ]
        steps = [
            SkillStepDTO.from_api_response(s) if isinstance(s, dict) else s
            for s in data.get("steps", [])
        ]

        return cls(
            id=data.get("id", 0),
            name=data.get("name", ""),
            description=data.get("description", ""),
            instructions=data.get("instructions", ""),
            execution_type=data.get("executionType", data.get("execution_type", "agentic")),
            model=data.get("model"),
            agent_type=data.get("agentType", data.get("agent_type")),
            inputs=inputs,
            outputs=outputs,
            tools=tools,
            steps=steps,
        )

    @classmethod
    def from_proto(cls, proto: Any) -> "SkillConfigDTO":
        """Create from proto SkillConfig at boundary."""
        inputs = [InputDefinition.from_proto(inp) for inp in proto.inputs]
        outputs = [OutputDefinition.from_proto(out) for out in proto.outputs]
        tools = [ToolConfigDTO.from_proto(t) for t in proto.tools]
        steps = [SkillStepDTO.from_proto(s) for s in proto.steps]

        return cls(
            id=proto.id,
            name=proto.name,
            description=proto.description,
            instructions=proto.instructions,
            execution_type=proto.execution_type,
            model=proto.model or None,
            agent_type=proto.agent_type or None,
            inputs=inputs,
            outputs=outputs,
            tools=tools,
            steps=steps,
            content=list(proto.content),
            _proto_steps=list(proto.steps) if proto.steps else None,
        )

    def is_workflow(self) -> bool:
        """Check if this is a workflow skill with steps."""
        return self.execution_type == "workflow" and len(self.steps) > 0

    def is_agentic(self) -> bool:
        """Check if this is an agentic skill."""
        return self.execution_type in ("agentic", "", None) or not self.execution_type
