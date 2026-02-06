"""
Skill Configuration entities for Dynamic Execution.

AIDEV-NOTE: Part of dynamic execution architecture (Jan 2026).
API-driven skill execution via SkillConfig.
Converts camelCase API response to snake_case dataclass.

Step config types (ReadConfig, WriteConfig, etc.) are also defined here
so they can be shared between the entities layer and StepExecutorService.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .models.plan import Plan


# =============================================================================
# Step Config Sub-types (replace Any fields in ReadConfig/WriteConfig/etc.)
# =============================================================================

@dataclass
class RowIdSource:
    """Row ID source configuration for read steps."""
    type: str = ""  # "static", "skill_input", "skill_output"
    static_id: str = ""
    skill_input: str = ""
    skill_output: str = ""
    use_source_row: bool = False

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> RowIdSource:
        return cls(
            type=data.get("type", ""),
            static_id=data.get("staticId", data.get("static_id", "")),
            skill_input=data.get("skillInput", data.get("skill_input", "")),
            skill_output=data.get("skillOutput", data.get("skill_output", "")),
            use_source_row=data.get("useSourceRow", data.get("use_source_row", False)),
        )


@dataclass
class QueryFilter:
    """Query filter for read config."""
    field_id: int = 0
    operator: str = ""
    value_source: Optional[RowIdSource] = None

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> QueryFilter:
        vs_data = data.get("valueSource", data.get("value_source"))
        return cls(
            field_id=data.get("fieldId", data.get("field_id", 0)),
            operator=data.get("operator", ""),
            value_source=RowIdSource.from_api_response(vs_data) if vs_data else None,
        )


@dataclass
class ReadFieldMapping:
    """Field mapping for read config."""
    source_field_id: int = 0
    target_variable: str = ""

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> ReadFieldMapping:
        return cls(
            source_field_id=data.get("sourceFieldId", data.get("source_field_id", 0)),
            target_variable=data.get("targetVariable", data.get("target_variable", "")),
        )


@dataclass
class WriteFieldMapping:
    """Field mapping for write config."""
    skill_input_name: str = ""
    target_field_id: int = 0

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> WriteFieldMapping:
        return cls(
            skill_input_name=data.get("skillInputName", data.get("skill_input_name", "")),
            target_field_id=data.get("targetFieldId", data.get("target_field_id", 0)),
        )


@dataclass
class OutputFieldSource:
    """Typed source for an output field mapping value."""
    type: str = ""       # "skill_output", "skill_input", "table_ref"
    name: str = ""       # For skill_output / skill_input
    order: int = 0       # For table_ref
    field: str = ""      # For table_ref

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> OutputFieldSource:
        return cls(
            type=data.get("type", ""),
            name=data.get("name", ""),
            order=data.get("order", 0),
            field=data.get("field", ""),
        )


@dataclass
class OutputFieldMapping:
    """Maps a source value to a target table field in output mapping."""
    source: OutputFieldSource = field(default_factory=OutputFieldSource)
    target_field_id: int = 0
    append_mode: bool = False

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> OutputFieldMapping:
        source_data = data.get("source", {})
        return cls(
            source=OutputFieldSource.from_api_response(source_data) if source_data else OutputFieldSource(),
            target_field_id=data.get("targetFieldId", data.get("target_field_id", 0)),
            append_mode=data.get("appendMode", data.get("append_mode", False)),
        )


@dataclass
class OutputTableMapping:
    """Ordered write operation for a single table in output mapping."""
    order: int = 1
    target_table_id: int = 0
    row_action: str = "create"
    row_id_source: Optional[RowIdSource] = None
    match_field_ids: Optional[List[int]] = None
    mappings: List[OutputFieldMapping] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> OutputTableMapping:
        rid = data.get("rowIdSource", data.get("row_id_source"))
        return cls(
            order=data.get("order", 1),
            target_table_id=data.get("targetTableId", data.get("target_table_id", 0)),
            row_action=data.get("rowAction", data.get("row_action", "create")),
            row_id_source=RowIdSource.from_api_response(rid) if rid else None,
            match_field_ids=data.get("matchFieldIds", data.get("match_field_ids")) or None,
            mappings=[OutputFieldMapping.from_api_response(m) for m in data.get("mappings", [])],
        )


@dataclass
class OutputMappingConfig:
    """Multi-table output mapping configuration."""
    mode: str = "single_row"
    table_mappings: List[OutputTableMapping] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> OutputMappingConfig:
        return cls(
            mode=data.get("mode", "single_row"),
            table_mappings=[
                OutputTableMapping.from_api_response(tm)
                for tm in data.get("tableMappings", data.get("table_mappings", []))
            ],
        )


@dataclass
class UpdateMatchConfig:
    """Update match config for write steps."""
    skill_input_name: str = ""
    target_field_id: int = 0

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> UpdateMatchConfig:
        return cls(
            skill_input_name=data.get("skillInputName", data.get("skill_input_name", "")),
            target_field_id=data.get("targetFieldId", data.get("target_field_id", 0)),
        )


@dataclass
class ToolInputMapping:
    """Input mapping for tool execution config."""
    tool_param: str = ""
    skill_input_name: str = ""
    static_value: str = ""

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> ToolInputMapping:
        return cls(
            tool_param=data.get("toolParam", data.get("tool_param", "")),
            skill_input_name=data.get("skillInputName", data.get("skill_input_name", "")),
            static_value=data.get("staticValue", data.get("static_value", "")),
        )


# =============================================================================
# Step Config Types (moved from step_executor.py, Any fields replaced)
# =============================================================================

@dataclass
class ErrorConfig:
    """Error handling configuration for a step."""
    continue_on_error: bool = False
    error_output_var: str = "__error__"

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> ErrorConfig:
        return cls(
            continue_on_error=data.get("continueOnError", data.get("continue_on_error", False)),
            error_output_var=data.get("errorOutputVar", data.get("error_output_var", "__error__")),
        )


@dataclass
class RetryConfig:
    """Retry configuration for error recovery."""
    max_attempts: int = 3
    backoff_ms: int = 1000
    backoff_type: str = "exponential"  # "fixed", "exponential", "linear"

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> RetryConfig:
        return cls(
            max_attempts=data.get("maxAttempts", data.get("max_attempts", 3)),
            backoff_ms=data.get("backoffMs", data.get("backoff_ms", 1000)),
            backoff_type=data.get("backoffType", data.get("backoff_type", "exponential")),
        )


@dataclass
class StepOutput:
    """Step output routing - determines which steps to execute based on outcome."""
    type: str = "default"  # "success", "error", "condition", "default"
    condition: str = ""
    next_steps: List[str] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> StepOutput:
        return cls(
            type=data.get("type", "default"),
            condition=data.get("condition", ""),
            next_steps=data.get("nextSteps", data.get("next_steps", [])),
        )


@dataclass
class LoopConfig:
    """Loop configuration for iteration support."""
    type: str = "for_each"  # "for_each", "while", "until"
    items_var: str = ""
    current_item_var: str = "item"
    condition: str = ""
    max_iterations: int = 100

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> LoopConfig:
        return cls(
            type=data.get("type", "for_each"),
            items_var=data.get("itemsVar", data.get("items_var", "")),
            current_item_var=data.get("currentItemVar", data.get("current_item_var", "item")),
            condition=data.get("condition", ""),
            max_iterations=data.get("maxIterations", data.get("max_iterations", 100)),
        )


@dataclass
class ReadConfig:
    """Read configuration for direct table read steps."""
    mode: str = "single_row"
    source_table_id: int = 0
    row_id_source: Optional[RowIdSource] = None
    query_filters: List[QueryFilter] = field(default_factory=list)
    query_limit: int = 100
    field_mappings: List[ReadFieldMapping] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> ReadConfig:
        rid = data.get("rowIdSource", data.get("row_id_source"))
        return cls(
            mode=data.get("mode", "single_row"),
            source_table_id=data.get("sourceTableId", data.get("source_table_id", 0)),
            row_id_source=RowIdSource.from_api_response(rid) if rid else None,
            query_filters=[QueryFilter.from_api_response(qf) for qf in data.get("queryFilters", data.get("query_filters", []))],
            query_limit=data.get("queryLimit", data.get("query_limit", 100)),
            field_mappings=[ReadFieldMapping.from_api_response(fm) for fm in data.get("fieldMappings", data.get("field_mappings", []))],
        )


@dataclass
class WriteConfig:
    """Write configuration for direct table write steps."""
    target_table_id: int = 0
    row_action: str = "create"
    field_mappings: List[WriteFieldMapping] = field(default_factory=list)
    update_match: Optional[UpdateMatchConfig] = None
    match_field_ids: Optional[List[int]] = None  # For upsert: target fields to match on (composite key)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> WriteConfig:
        um = data.get("updateMatch", data.get("update_match"))
        return cls(
            target_table_id=data.get("targetTableId", data.get("target_table_id", 0)),
            row_action=data.get("rowAction", data.get("row_action", "create")),
            field_mappings=[WriteFieldMapping.from_api_response(fm) for fm in data.get("fieldMappings", data.get("field_mappings", []))],
            update_match=UpdateMatchConfig.from_api_response(um) if um else None,
            match_field_ids=data.get("matchFieldIds", data.get("match_field_ids")) or None,
        )


@dataclass
class ToolExecutionConfig:
    """Tool execution configuration for direct tool call steps."""
    tool_id: str = ""
    input_mappings: List[ToolInputMapping] = field(default_factory=list)
    output_table_id: Optional[int] = None

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> ToolExecutionConfig:
        return cls(
            tool_id=data.get("toolId", data.get("tool_id", "")),
            input_mappings=[ToolInputMapping.from_api_response(m) for m in data.get("inputMappings", data.get("input_mappings", []))],
            output_table_id=data.get("outputTableId", data.get("output_table_id")),
        )


@dataclass
class InputDef:
    """Step-level input definition."""
    name: str
    required: bool = False
    type: str = "text"

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> InputDef:
        return cls(
            name=data.get("name", ""),
            required=data.get("required", False),
            type=data.get("type", "text"),
        )


@dataclass
class OutputDef:
    """Step-level output definition."""
    name: str
    type: str = "text"

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> OutputDef:
        return cls(
            name=data.get("name", ""),
            type=data.get("type", "text"),
        )


# =============================================================================
# Agentic Step Config
# =============================================================================

@dataclass
class AgenticStepConfig:
    """Typed config for agentic skill steps.

    Replaces raw Dict[str, Any] with proper typed fields.
    Plan is a fully typed Plan entity from entities/models/plan.py.
    """
    instructions: str = ""
    model: str = ""
    agent_type: str = ""
    tools: List[str] = field(default_factory=list)
    plan: Optional[Plan] = None

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> AgenticStepConfig:
        """Create from API response (camelCase agenticConfig object)."""
        from .models.plan import Plan

        plan_data = data.get("plan")
        return cls(
            instructions=data.get("instructions", ""),
            model=data.get("model", ""),
            agent_type=data.get("agentType", data.get("agent_type", "")),
            tools=data.get("tools", []),
            plan=Plan.from_dict(plan_data) if plan_data else None,
        )


# =============================================================================
# Skill-level Definitions
# =============================================================================

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
    def from_api_response(cls, data: Dict[str, Any]) -> InputDefinition:
        """Create from API response (camelCase)."""
        return cls(
            name=data.get("name", ""),
            type=data.get("type", "string"),
            description=data.get("description", ""),
            required=data.get("required", False),
            default_value=data.get("defaultValue"),
        )


@dataclass
class OutputSource:
    """Output source configuration for mapping node outputs to skill outputs."""
    type: str = ""
    node_id: str = ""
    output_name: str = ""

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> OutputSource:
        return cls(
            type=data.get("type", ""),
            node_id=data.get("nodeId", data.get("node_id", "")),
            output_name=data.get("outputName", data.get("output_name", "")),
        )


@dataclass
class OutputDefinition:
    """Skill output definition."""
    name: str
    type: str = "string"
    description: str = ""
    source: Optional[OutputSource] = None
    output_mapping: Optional[OutputMappingConfig] = None

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> OutputDefinition:
        """Create from API response (camelCase)."""
        source_data = data.get("source")
        source = OutputSource.from_api_response(source_data) if isinstance(source_data, dict) else None
        mapping_data = data.get("outputMapping", data.get("output_mapping"))
        return cls(
            name=data.get("name", ""),
            type=data.get("type", "string"),
            description=data.get("description", ""),
            source=source,
            output_mapping=OutputMappingConfig.from_api_response(mapping_data) if mapping_data else None,
        )


@dataclass
class StepToolConfig:
    """Tool configuration for skill execution."""
    name: str
    tool_type: str = "pipedream"
    config: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> StepToolConfig:
        """Create from API response (camelCase)."""
        return cls(
            name=data.get("name", ""),
            tool_type=data.get("toolType", data.get("tool_type", "pipedream")),
            config=data.get("config", {}),
        )


# =============================================================================
# Step DTO (feature-complete)
# =============================================================================

@dataclass
class SkillStep:
    """Skill step for workflow execution -- feature-complete DTO.

    All step types (read, write, agentic, tool, etc.)
    are represented via typed config fields.
    """
    id: str
    name: str
    step_type: str = "agentic"
    instruction: str = ""
    skill_id: int = 0
    tools: List[str] = field(default_factory=list)
    inputs: Dict[str, str] = field(default_factory=dict)
    outputs: Dict[str, str] = field(default_factory=dict)
    condition: str = ""
    input_defs: List[InputDef] = field(default_factory=list)
    output_defs: List[OutputDef] = field(default_factory=list)
    error_config: Optional[ErrorConfig] = None
    retry_config: Optional[RetryConfig] = None
    step_outputs: List[StepOutput] = field(default_factory=list)
    parallel_group: str = ""
    loop_config: Optional[LoopConfig] = None
    read_config: Optional[ReadConfig] = None
    write_config: Optional[WriteConfig] = None
    tool_execution_config: Optional[ToolExecutionConfig] = None
    agentic_config: Optional[AgenticStepConfig] = None
    is_disabled: bool = False
    dependencies: List[str] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> SkillStep:
        """Create from API response (camelCase)."""
        agentic_data = data.get("agenticConfig", data.get("agentic_config"))
        read_data = data.get("readConfig", data.get("read_config"))
        write_data = data.get("writeConfig", data.get("write_config"))
        tool_exec_data = data.get("toolExecutionConfig", data.get("tool_execution_config"))
        error_data = data.get("errorConfig", data.get("error_config"))
        retry_data = data.get("retryConfig", data.get("retry_config"))
        loop_data = data.get("loopConfig", data.get("loop_config"))

        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            step_type=data.get("stepType", data.get("step_type", "agentic")),
            instruction=data.get("instruction", ""),
            skill_id=data.get("skillId", data.get("skill_id", 0)),
            tools=data.get("tools", []),
            inputs=data.get("inputs", {}),
            outputs=data.get("outputs", {}),
            condition=data.get("condition", ""),
            input_defs=[InputDef.from_api_response(d) for d in data.get("inputDefs", data.get("input_defs", []))],
            output_defs=[OutputDef.from_api_response(d) for d in data.get("outputDefs", data.get("output_defs", []))],
            error_config=ErrorConfig.from_api_response(error_data) if error_data else None,
            retry_config=RetryConfig.from_api_response(retry_data) if retry_data else None,
            step_outputs=[StepOutput.from_api_response(o) for o in data.get("stepOutputs", data.get("step_outputs", []))],
            parallel_group=data.get("parallelGroup", data.get("parallel_group", "")),
            loop_config=LoopConfig.from_api_response(loop_data) if loop_data else None,
            read_config=ReadConfig.from_api_response(read_data) if read_data else None,
            write_config=WriteConfig.from_api_response(write_data) if write_data else None,
            tool_execution_config=ToolExecutionConfig.from_api_response(tool_exec_data) if tool_exec_data else None,
            agentic_config=AgenticStepConfig.from_api_response(agentic_data) if isinstance(agentic_data, dict) else None,
            is_disabled=data.get("isDisabled", data.get("is_disabled", False)),
            dependencies=data.get("dependencies", []),
        )


# =============================================================================
# Human Skill Config
# =============================================================================

@dataclass
class HumanSkillConfig:
    """Configuration for human-executed skills.

    AIDEV-NOTE: Human skills pause execution and wait for a human to complete
    the work. The assignee receives the inputs and must provide the outputs.
    """
    instructions: str = ""
    assignee_type: str = "owner"  # "owner" | "specific_user" | "role"
    assignee_id: Optional[str] = None  # User ID if specific_user
    assignee_role: Optional[str] = None  # Role name if role-based
    timeout_behavior: str = "wait_forever"  # "wait_forever" | "fail" | "skip_with_default"
    timeout_hours: Optional[int] = None
    default_outputs: Optional[Dict[str, Any]] = None

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> HumanSkillConfig:
        return cls(
            instructions=data.get("instructions", ""),
            assignee_type=data.get("assigneeType", data.get("assignee_type", "owner")),
            assignee_id=data.get("assigneeId", data.get("assignee_id")),
            assignee_role=data.get("assigneeRole", data.get("assignee_role")),
            timeout_behavior=data.get("timeoutBehavior", data.get("timeout_behavior", "wait_forever")),
            timeout_hours=data.get("timeoutHours", data.get("timeout_hours")),
            default_outputs=data.get("defaultOutputs", data.get("default_outputs")),
        )


# =============================================================================
# Skill Config DTO
# =============================================================================

@dataclass
class SkillConfig:
    """
    Skill configuration for execution.

    Created from API response (from_api_response).
    Used by SkillExecutorService.execute_skill().
    """
    id: int
    name: str
    description: str = ""
    instructions: str = ""
    execution_type: str = "agentic"  # "agentic" | "workflow" | "human"
    model: Optional[str] = None
    agent_type: Optional[str] = None
    inputs: List[InputDefinition] = field(default_factory=list)
    outputs: List[OutputDefinition] = field(default_factory=list)
    tools: List[StepToolConfig] = field(default_factory=list)
    steps: List[SkillStep] = field(default_factory=list)
    content: List[Any] = field(default_factory=list)
    allow_network: bool = False  # Whether bash tool should have network access (for git/code skills)
    human_skill_config: Optional[HumanSkillConfig] = None  # Config for human-executed skills

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> SkillConfig:
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
            StepToolConfig.from_api_response(t) if isinstance(t, dict)
            else StepToolConfig(name=t) if isinstance(t, str)
            else t
            for t in data.get("tools", [])
        ]
        steps = [
            SkillStep.from_api_response(s) if isinstance(s, dict) else s
            for s in data.get("steps", [])
        ]

        # Parse human skill config if present
        human_config_data = data.get("humanSkillConfig", data.get("human_skill_config"))
        human_skill_config = (
            HumanSkillConfig.from_api_response(human_config_data)
            if human_config_data else None
        )

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
            allow_network=data.get("allowNetwork", data.get("allow_network", False)),
            human_skill_config=human_skill_config,
        )

    def is_workflow(self) -> bool:
        """Check if this is a workflow skill with steps."""
        return self.execution_type == "workflow" and len(self.steps) > 0

    def is_agentic(self) -> bool:
        """Check if this is an agentic skill."""
        return self.execution_type in ("agentic", "", None) or not self.execution_type

    def is_human_skill(self) -> bool:
        """Check if this is a human-executed skill."""
        return self.execution_type == "human"
