"""
Skill Configuration DTO for Dynamic Execution.

AIDEV-NOTE: Part of dynamic execution architecture (Jan 2026).
Replaces proto SkillConfig for API-driven skill execution.
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
    def from_proto(cls, proto: Any) -> RowIdSource:
        return cls(
            type=getattr(proto, 'type', "") or (
                "static" if getattr(proto, 'static_id', "") else
                "skill_input" if getattr(proto, 'skill_input', "") else
                "skill_output" if getattr(proto, 'skill_output', "") else ""
            ),
            static_id=getattr(proto, 'static_id', "") or "",
            skill_input=getattr(proto, 'skill_input', "") or "",
            skill_output=getattr(proto, 'skill_output', "") or "",
            use_source_row=getattr(proto, 'use_source_row', False),
        )

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
    def from_proto(cls, proto: Any) -> QueryFilter:
        vs = None
        if hasattr(proto, 'value_source') and proto.value_source:
            vs = RowIdSource.from_proto(proto.value_source)
        return cls(
            field_id=proto.field_id,
            operator=getattr(proto, 'operator', "") or "",
            value_source=vs,
        )

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
    def from_proto(cls, proto: Any) -> ReadFieldMapping:
        return cls(source_field_id=proto.source_field_id, target_variable=proto.target_variable)

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
    def from_proto(cls, proto: Any) -> WriteFieldMapping:
        return cls(skill_input_name=proto.skill_input_name, target_field_id=proto.target_field_id)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> WriteFieldMapping:
        return cls(
            skill_input_name=data.get("skillInputName", data.get("skill_input_name", "")),
            target_field_id=data.get("targetFieldId", data.get("target_field_id", 0)),
        )


@dataclass
class UpdateMatchConfig:
    """Update match config for write steps."""
    skill_input_name: str = ""
    target_field_id: int = 0

    @classmethod
    def from_proto(cls, proto: Any) -> UpdateMatchConfig:
        return cls(skill_input_name=proto.skill_input_name, target_field_id=proto.target_field_id)

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
    def from_proto(cls, proto: Any) -> ToolInputMapping:
        return cls(
            tool_param=getattr(proto, 'tool_param', "") or "",
            skill_input_name=getattr(proto, 'skill_input_name', "") or "",
            static_value=getattr(proto, 'static_value', "") or "",
        )

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
    def from_proto(cls, proto: Any) -> ErrorConfig:
        return cls(
            continue_on_error=proto.continue_on_error,
            error_output_var=getattr(proto, 'error_output_var', "") or "__error__",
        )

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
    def from_proto(cls, proto: Any) -> RetryConfig:
        return cls(
            max_attempts=proto.max_attempts,
            backoff_ms=getattr(proto, 'backoff_ms', 0) or 1000,
            backoff_type=getattr(proto, 'backoff_type', "") or "exponential",
        )

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
    def from_proto(cls, proto: Any) -> StepOutput:
        return cls(
            type=getattr(proto, 'type', "") or "default",
            condition=getattr(proto, 'condition', "") or "",
            next_steps=list(proto.next_steps),
        )

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
    def from_proto(cls, proto: Any) -> LoopConfig:
        return cls(
            type=proto.type,
            items_var=getattr(proto, 'items_var', "") or "",
            current_item_var=getattr(proto, 'current_item_var', "") or "item",
            condition=getattr(proto, 'condition', "") or "",
            max_iterations=getattr(proto, 'max_iterations', 0) or 100,
        )

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
    def from_proto(cls, proto: Any) -> ReadConfig:
        return cls(
            mode=getattr(proto, 'mode', "") or "single_row",
            source_table_id=proto.source_table_id,
            row_id_source=RowIdSource.from_proto(proto.row_id_source) if proto.HasField('row_id_source') else None,
            query_filters=[QueryFilter.from_proto(qf) for qf in proto.query_filters],
            query_limit=getattr(proto, 'query_limit', 0) or 100,
            field_mappings=[ReadFieldMapping.from_proto(fm) for fm in proto.field_mappings],
        )

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

    @classmethod
    def from_proto(cls, proto: Any) -> WriteConfig:
        return cls(
            target_table_id=proto.target_table_id,
            row_action=getattr(proto, 'row_action', "") or "create",
            field_mappings=[WriteFieldMapping.from_proto(fm) for fm in proto.field_mappings],
            update_match=UpdateMatchConfig.from_proto(proto.update_match) if proto.HasField('update_match') else None,
        )

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> WriteConfig:
        um = data.get("updateMatch", data.get("update_match"))
        return cls(
            target_table_id=data.get("targetTableId", data.get("target_table_id", 0)),
            row_action=data.get("rowAction", data.get("row_action", "create")),
            field_mappings=[WriteFieldMapping.from_api_response(fm) for fm in data.get("fieldMappings", data.get("field_mappings", []))],
            update_match=UpdateMatchConfig.from_api_response(um) if um else None,
        )


@dataclass
class ToolExecutionConfig:
    """Tool execution configuration for direct tool call steps."""
    tool_id: str = ""
    input_mappings: List[ToolInputMapping] = field(default_factory=list)
    output_table_id: Optional[int] = None

    @classmethod
    def from_proto(cls, proto: Any) -> ToolExecutionConfig:
        return cls(
            tool_id=proto.tool_id,
            input_mappings=[ToolInputMapping.from_proto(m) for m in proto.input_mappings],
            output_table_id=proto.output_table_id if proto.HasField('output_table_id') else None,
        )

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> ToolExecutionConfig:
        return cls(
            tool_id=data.get("toolId", data.get("tool_id", "")),
            input_mappings=[ToolInputMapping.from_api_response(m) for m in data.get("inputMappings", data.get("input_mappings", []))],
            output_table_id=data.get("outputTableId", data.get("output_table_id")),
        )


@dataclass
class TaskModelConfig:
    """Task model configuration for direct inference steps."""
    model_id: str = ""
    task_type: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_proto(cls, proto: Any) -> TaskModelConfig:
        return cls(
            model_id=proto.model_id,
            task_type=getattr(proto, 'task_type', "") or "",
            parameters=dict(proto.parameters),
        )

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> TaskModelConfig:
        return cls(
            model_id=data.get("modelId", data.get("model_id", "")),
            task_type=data.get("taskType", data.get("task_type", "")),
            parameters=data.get("parameters", {}),
        )


@dataclass
class InputDef:
    """Step-level input definition."""
    name: str
    required: bool = False
    type: str = "text"

    @classmethod
    def from_proto(cls, proto: Any) -> InputDef:
        return cls(name=proto.name, required=proto.required, type=getattr(proto, 'type', "") or "text")

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
    def from_proto(cls, proto: Any) -> OutputDef:
        return cls(name=proto.name, type=getattr(proto, 'type', "") or "text")

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

    @classmethod
    def from_proto(cls, proto: Any) -> AgenticStepConfig:
        """Create from proto AgenticStepConfig."""
        from .models.plan import Plan

        plan = None
        if proto.HasField('plan') and proto.plan.id:
            plan = Plan.from_stored_proto(proto.plan)
        return cls(
            instructions=proto.instructions,
            model=proto.model,
            agent_type=proto.agent_type,
            tools=list(proto.tools) if proto.tools else [],
            plan=plan,
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

    @classmethod
    def from_proto(cls, proto: Any) -> InputDefinition:
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
    def from_api_response(cls, data: Dict[str, Any]) -> OutputDefinition:
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
    def from_proto(cls, proto: Any) -> OutputDefinition:
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
    def from_api_response(cls, data: Dict[str, Any]) -> ToolConfigDTO:
        """Create from API response (camelCase)."""
        return cls(
            name=data.get("name", ""),
            tool_type=data.get("toolType", data.get("tool_type", "pipedream")),
            config=data.get("config", {}),
        )

    @classmethod
    def from_proto(cls, proto: Any) -> ToolConfigDTO:
        """Create from proto ToolConfig."""
        return cls(
            name=proto.name,
            tool_type="pipedream",
            config=dict(proto.config) if proto.config else {},
        )


# =============================================================================
# Step DTO (feature-complete)
# =============================================================================

@dataclass
class SkillStepDTO:
    """Skill step for workflow execution -- feature-complete DTO.

    Replaces proto SkillStep. All step types (read, write, agentic, tool, etc.)
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
    task_model_config: Optional[TaskModelConfig] = None
    agentic_config: Optional[AgenticStepConfig] = None
    is_disabled: bool = False
    dependencies: List[str] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> SkillStepDTO:
        """Create from API response (camelCase)."""
        agentic_data = data.get("agenticConfig", data.get("agentic_config"))
        read_data = data.get("readConfig", data.get("read_config"))
        write_data = data.get("writeConfig", data.get("write_config"))
        tool_exec_data = data.get("toolExecutionConfig", data.get("tool_execution_config"))
        task_model_data = data.get("taskModelConfig", data.get("task_model_config"))
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
            task_model_config=TaskModelConfig.from_api_response(task_model_data) if task_model_data else None,
            agentic_config=AgenticStepConfig.from_api_response(agentic_data) if isinstance(agentic_data, dict) else None,
            is_disabled=data.get("isDisabled", data.get("is_disabled", False)),
            dependencies=data.get("dependencies", []),
        )

    @classmethod
    def from_proto(cls, proto: Any) -> SkillStepDTO:
        """Create from proto SkillStep -- full conversion."""
        # Parse inline execution configs
        agentic_config = None
        if proto.HasField('agentic_config'):
            agentic_config = AgenticStepConfig.from_proto(proto.agentic_config)

        read_config = None
        if proto.HasField('read_config') and proto.read_config.source_table_id:
            read_config = ReadConfig.from_proto(proto.read_config)

        write_config = None
        if proto.HasField('write_config') and proto.write_config.target_table_id:
            write_config = WriteConfig.from_proto(proto.write_config)

        tool_execution_config = None
        if proto.HasField('tool_execution_config') and proto.tool_execution_config.tool_id:
            tool_execution_config = ToolExecutionConfig.from_proto(proto.tool_execution_config)

        task_model_config = None
        if proto.HasField('task_model_config') and proto.task_model_config.model_id:
            task_model_config = TaskModelConfig.from_proto(proto.task_model_config)

        error_config = None
        if proto.error_config and proto.error_config.continue_on_error:
            error_config = ErrorConfig.from_proto(proto.error_config)

        retry_config = None
        if proto.retry_config and proto.retry_config.max_attempts > 0:
            retry_config = RetryConfig.from_proto(proto.retry_config)

        loop_config = None
        if proto.loop_config and proto.loop_config.type:
            loop_config = LoopConfig.from_proto(proto.loop_config)

        # Determine step_type from which config is set
        step_type = "agentic"
        if agentic_config:
            step_type = "agentic"
        elif read_config:
            step_type = "read"
        elif write_config:
            step_type = "write"
        elif tool_execution_config:
            step_type = "tool"
        elif task_model_config:
            step_type = "task_model"
        elif proto.instruction:
            step_type = "inline"

        return cls(
            id=proto.id,
            name=proto.name,
            step_type=step_type,
            instruction=proto.instruction or "",
            skill_id=proto.skill_id,
            tools=list(proto.tools),
            inputs=dict(proto.inputs),
            outputs=dict(proto.outputs),
            condition=proto.condition or "",
            input_defs=[InputDef.from_proto(d) for d in proto.input_defs],
            output_defs=[OutputDef.from_proto(d) for d in proto.output_defs],
            error_config=error_config,
            retry_config=retry_config,
            step_outputs=[StepOutput.from_proto(o) for o in proto.step_outputs],
            parallel_group=proto.parallel_group or "",
            loop_config=loop_config,
            read_config=read_config,
            write_config=write_config,
            tool_execution_config=tool_execution_config,
            task_model_config=task_model_config,
            agentic_config=agentic_config,
            is_disabled=proto.is_disabled,
            dependencies=list(proto.dependencies) if hasattr(proto, 'dependencies') else [],
        )


# =============================================================================
# Skill Config DTO
# =============================================================================

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

    @classmethod
    def from_api_response(cls, data: Dict[str, Any]) -> SkillConfigDTO:
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
    def from_proto(cls, proto: Any) -> SkillConfigDTO:
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
        )

    def is_workflow(self) -> bool:
        """Check if this is a workflow skill with steps."""
        return self.execution_type == "workflow" and len(self.steps) > 0

    def is_agentic(self) -> bool:
        """Check if this is an agentic skill."""
        return self.execution_type in ("agentic", "", None) or not self.execution_type
