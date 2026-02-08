from collections.abc import Iterable as _Iterable
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar

from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper

DESCRIPTOR: _descriptor.FileDescriptor

class TaskStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    TASK_PENDING: _ClassVar[TaskStatus]
    TASK_IN_PROGRESS: _ClassVar[TaskStatus]
    TASK_COMPLETED: _ClassVar[TaskStatus]
    TASK_FAILED: _ClassVar[TaskStatus]
    TASK_CANCELLED: _ClassVar[TaskStatus]
    TASK_TIMEOUT: _ClassVar[TaskStatus]

class WorkerStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    WORKER_HEALTHY: _ClassVar[WorkerStatus]
    WORKER_BUSY: _ClassVar[WorkerStatus]
    WORKER_DEGRADED: _ClassVar[WorkerStatus]
    WORKER_UNHEALTHY: _ClassVar[WorkerStatus]
    WORKER_SHUTTING_DOWN: _ClassVar[WorkerStatus]

class StepType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    STEP_PLANNING: _ClassVar[StepType]
    STEP_ACTION: _ClassVar[StepType]
    STEP_REASONING: _ClassVar[StepType]
    STEP_FINAL: _ClassVar[StepType]

TASK_PENDING: TaskStatus
TASK_IN_PROGRESS: TaskStatus
TASK_COMPLETED: TaskStatus
TASK_FAILED: TaskStatus
TASK_CANCELLED: TaskStatus
TASK_TIMEOUT: TaskStatus
WORKER_HEALTHY: WorkerStatus
WORKER_BUSY: WorkerStatus
WORKER_DEGRADED: WorkerStatus
WORKER_UNHEALTHY: WorkerStatus
WORKER_SHUTTING_DOWN: WorkerStatus
STEP_PLANNING: StepType
STEP_ACTION: StepType
STEP_REASONING: StepType
STEP_FINAL: StepType

class TaskRequest(_message.Message):
    __slots__ = (
        "task_id",
        "agent_id",
        "skill_name",
        "instruction_config",
        "agent_config",
        "trigger_data",
        "organization_id",
        "owner_id",
        "timeout_seconds",
        "name",
        "agent_model",
        "organization_model",
        "input_content",
        "resolved_context",
        "skill_id",
        "trigger_type",
        "triggered_by_user_id",
        "triggered_by_user_name",
        "user_api_key",
    )
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    AGENT_ID_FIELD_NUMBER: _ClassVar[int]
    SKILL_NAME_FIELD_NUMBER: _ClassVar[int]
    INSTRUCTION_CONFIG_FIELD_NUMBER: _ClassVar[int]
    AGENT_CONFIG_FIELD_NUMBER: _ClassVar[int]
    TRIGGER_DATA_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    OWNER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMEOUT_SECONDS_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    AGENT_MODEL_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_MODEL_FIELD_NUMBER: _ClassVar[int]
    INPUT_CONTENT_FIELD_NUMBER: _ClassVar[int]
    RESOLVED_CONTEXT_FIELD_NUMBER: _ClassVar[int]
    SKILL_ID_FIELD_NUMBER: _ClassVar[int]
    TRIGGER_TYPE_FIELD_NUMBER: _ClassVar[int]
    TRIGGERED_BY_USER_ID_FIELD_NUMBER: _ClassVar[int]
    TRIGGERED_BY_USER_NAME_FIELD_NUMBER: _ClassVar[int]
    USER_API_KEY_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    agent_id: int
    skill_name: str
    instruction_config: InstructionConfig
    agent_config: AgentConfig
    trigger_data: TriggerData
    organization_id: str
    owner_id: str
    timeout_seconds: int
    name: str
    agent_model: str
    organization_model: str
    input_content: _containers.RepeatedCompositeFieldContainer[MessagePart]
    resolved_context: ResolvedContextProto
    skill_id: int
    trigger_type: str
    triggered_by_user_id: str
    triggered_by_user_name: str
    user_api_key: str
    def __init__(
        self,
        task_id: str | None = ...,
        agent_id: int | None = ...,
        skill_name: str | None = ...,
        instruction_config: InstructionConfig | _Mapping | None = ...,
        agent_config: AgentConfig | _Mapping | None = ...,
        trigger_data: TriggerData | _Mapping | None = ...,
        organization_id: str | None = ...,
        owner_id: str | None = ...,
        timeout_seconds: int | None = ...,
        name: str | None = ...,
        agent_model: str | None = ...,
        organization_model: str | None = ...,
        input_content: _Iterable[MessagePart | _Mapping] | None = ...,
        resolved_context: ResolvedContextProto | _Mapping | None = ...,
        skill_id: int | None = ...,
        trigger_type: str | None = ...,
        triggered_by_user_id: str | None = ...,
        triggered_by_user_name: str | None = ...,
        user_api_key: str | None = ...,
    ) -> None: ...

class TaskProgress(_message.Message):
    __slots__ = (
        "task_id",
        "status",
        "output_json",
        "error_message",
        "timestamp_ms",
        "progress_percent",
        "token_usage",
    )
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_JSON_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_MS_FIELD_NUMBER: _ClassVar[int]
    PROGRESS_PERCENT_FIELD_NUMBER: _ClassVar[int]
    TOKEN_USAGE_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    status: TaskStatus
    output_json: str
    error_message: str
    timestamp_ms: int
    progress_percent: float
    token_usage: TokenUsage
    def __init__(
        self,
        task_id: str | None = ...,
        status: TaskStatus | str | None = ...,
        output_json: str | None = ...,
        error_message: str | None = ...,
        timestamp_ms: int | None = ...,
        progress_percent: float | None = ...,
        token_usage: TokenUsage | _Mapping | None = ...,
    ) -> None: ...

class ChatTaskProgress(_message.Message):
    __slots__ = ("task_id", "step", "total_steps", "step_name", "status", "output_json")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    STEP_FIELD_NUMBER: _ClassVar[int]
    TOTAL_STEPS_FIELD_NUMBER: _ClassVar[int]
    STEP_NAME_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_JSON_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    step: int
    total_steps: int
    step_name: str
    status: str
    output_json: str
    def __init__(
        self,
        task_id: str | None = ...,
        step: int | None = ...,
        total_steps: int | None = ...,
        step_name: str | None = ...,
        status: str | None = ...,
        output_json: str | None = ...,
    ) -> None: ...

class CancelTaskRequest(_message.Message):
    __slots__ = ("task_id", "reason")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    reason: str
    def __init__(self, task_id: str | None = ..., reason: str | None = ...) -> None: ...

class CancelTaskResponse(_message.Message):
    __slots__ = ("success", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    def __init__(self, success: bool = ..., message: str | None = ...) -> None: ...

class WorkerInfo(_message.Message):
    __slots__ = (
        "worker_id",
        "version",
        "organization_id",
        "status",
        "skills",
        "active_tasks",
        "max_concurrent_tasks",
        "uptime_seconds",
        "supported_tools",
    )
    WORKER_ID_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    SKILLS_FIELD_NUMBER: _ClassVar[int]
    ACTIVE_TASKS_FIELD_NUMBER: _ClassVar[int]
    MAX_CONCURRENT_TASKS_FIELD_NUMBER: _ClassVar[int]
    UPTIME_SECONDS_FIELD_NUMBER: _ClassVar[int]
    SUPPORTED_TOOLS_FIELD_NUMBER: _ClassVar[int]
    worker_id: str
    version: str
    organization_id: str
    status: WorkerStatus
    skills: _containers.RepeatedScalarFieldContainer[str]
    active_tasks: int
    max_concurrent_tasks: int
    uptime_seconds: int
    supported_tools: _containers.RepeatedScalarFieldContainer[str]
    def __init__(
        self,
        worker_id: str | None = ...,
        version: str | None = ...,
        organization_id: str | None = ...,
        status: WorkerStatus | str | None = ...,
        skills: _Iterable[str] | None = ...,
        active_tasks: int | None = ...,
        max_concurrent_tasks: int | None = ...,
        uptime_seconds: int | None = ...,
        supported_tools: _Iterable[str] | None = ...,
    ) -> None: ...

class Empty(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ErrorResponse(_message.Message):
    __slots__ = ("code", "message", "details")
    CODE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    DETAILS_FIELD_NUMBER: _ClassVar[int]
    code: str
    message: str
    details: str
    def __init__(
        self,
        code: str | None = ...,
        message: str | None = ...,
        details: str | None = ...,
    ) -> None: ...

class TokenUsage(_message.Message):
    __slots__ = (
        "model_name",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "cost_usd",
    )
    MODEL_NAME_FIELD_NUMBER: _ClassVar[int]
    INPUT_TOKENS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_TOKENS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_TOKENS_FIELD_NUMBER: _ClassVar[int]
    COST_USD_FIELD_NUMBER: _ClassVar[int]
    model_name: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    def __init__(
        self,
        model_name: str | None = ...,
        input_tokens: int | None = ...,
        output_tokens: int | None = ...,
        total_tokens: int | None = ...,
        cost_usd: float | None = ...,
    ) -> None: ...

class AgentConfig(_message.Message):
    __slots__ = (
        "name",
        "role",
        "description",
        "persona",
        "tools",
        "servers",
        "default_model",
        "allow_network",
    )
    NAME_FIELD_NUMBER: _ClassVar[int]
    ROLE_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    PERSONA_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    SERVERS_FIELD_NUMBER: _ClassVar[int]
    DEFAULT_MODEL_FIELD_NUMBER: _ClassVar[int]
    ALLOW_NETWORK_FIELD_NUMBER: _ClassVar[int]
    name: str
    role: str
    description: str
    persona: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    servers: _containers.RepeatedCompositeFieldContainer[ServerConfig]
    default_model: str
    allow_network: bool
    def __init__(
        self,
        name: str | None = ...,
        role: str | None = ...,
        description: str | None = ...,
        persona: str | None = ...,
        tools: _Iterable[ToolConfig | _Mapping] | None = ...,
        servers: _Iterable[ServerConfig | _Mapping] | None = ...,
        default_model: str | None = ...,
        allow_network: bool = ...,
    ) -> None: ...

class SkillConfig(_message.Message):
    __slots__ = (
        "id",
        "name",
        "description",
        "inputs",
        "outputs",
        "instructions",
        "tools",
        "model",
        "content",
        "agent_type",
        "execution_type",
        "steps",
    )
    ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    INPUTS_FIELD_NUMBER: _ClassVar[int]
    OUTPUTS_FIELD_NUMBER: _ClassVar[int]
    INSTRUCTIONS_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    AGENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    EXECUTION_TYPE_FIELD_NUMBER: _ClassVar[int]
    STEPS_FIELD_NUMBER: _ClassVar[int]
    id: int
    name: str
    description: str
    inputs: _containers.RepeatedCompositeFieldContainer[InputDefinition]
    outputs: _containers.RepeatedCompositeFieldContainer[OutputDefinition]
    instructions: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    model: str
    content: _containers.RepeatedCompositeFieldContainer[MessagePart]
    agent_type: str
    execution_type: str
    steps: _containers.RepeatedCompositeFieldContainer[SkillStep]
    def __init__(
        self,
        id: int | None = ...,
        name: str | None = ...,
        description: str | None = ...,
        inputs: _Iterable[InputDefinition | _Mapping] | None = ...,
        outputs: _Iterable[OutputDefinition | _Mapping] | None = ...,
        instructions: str | None = ...,
        tools: _Iterable[ToolConfig | _Mapping] | None = ...,
        model: str | None = ...,
        content: _Iterable[MessagePart | _Mapping] | None = ...,
        agent_type: str | None = ...,
        execution_type: str | None = ...,
        steps: _Iterable[SkillStep | _Mapping] | None = ...,
    ) -> None: ...

class InputFieldSource(_message.Message):
    __slots__ = ("table_id", "field_id", "row_source")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    FIELD_ID_FIELD_NUMBER: _ClassVar[int]
    ROW_SOURCE_FIELD_NUMBER: _ClassVar[int]
    table_id: int
    field_id: int
    row_source: RowIdSource
    def __init__(
        self,
        table_id: int | None = ...,
        field_id: int | None = ...,
        row_source: RowIdSource | _Mapping | None = ...,
    ) -> None: ...

class InputMappingConfig(_message.Message):
    __slots__ = ("source",)
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    source: InputFieldSource
    def __init__(self, source: InputFieldSource | _Mapping | None = ...) -> None: ...

class InputDefinition(_message.Message):
    __slots__ = ("name", "required", "type", "input_mapping")
    NAME_FIELD_NUMBER: _ClassVar[int]
    REQUIRED_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    INPUT_MAPPING_FIELD_NUMBER: _ClassVar[int]
    name: str
    required: bool
    type: str
    input_mapping: InputMappingConfig
    def __init__(
        self,
        name: str | None = ...,
        required: bool = ...,
        type: str | None = ...,
        input_mapping: InputMappingConfig | _Mapping | None = ...,
    ) -> None: ...

class OutputSource(_message.Message):
    __slots__ = ("type", "node_id", "output_name")
    TYPE_FIELD_NUMBER: _ClassVar[int]
    NODE_ID_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_NAME_FIELD_NUMBER: _ClassVar[int]
    type: str
    node_id: str
    output_name: str
    def __init__(
        self,
        type: str | None = ...,
        node_id: str | None = ...,
        output_name: str | None = ...,
    ) -> None: ...

class OutputDefinition(_message.Message):
    __slots__ = ("name", "type", "output_mapping", "description", "source")
    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_MAPPING_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: str
    output_mapping: OutputMappingConfig
    description: str
    source: OutputSource
    def __init__(
        self,
        name: str | None = ...,
        type: str | None = ...,
        output_mapping: OutputMappingConfig | _Mapping | None = ...,
        description: str | None = ...,
        source: OutputSource | _Mapping | None = ...,
    ) -> None: ...

class ErrorConfig(_message.Message):
    __slots__ = ("continue_on_error", "error_output_var")
    CONTINUE_ON_ERROR_FIELD_NUMBER: _ClassVar[int]
    ERROR_OUTPUT_VAR_FIELD_NUMBER: _ClassVar[int]
    continue_on_error: bool
    error_output_var: str
    def __init__(
        self, continue_on_error: bool = ..., error_output_var: str | None = ...
    ) -> None: ...

class RetryConfig(_message.Message):
    __slots__ = ("max_attempts", "backoff_ms", "backoff_type")
    MAX_ATTEMPTS_FIELD_NUMBER: _ClassVar[int]
    BACKOFF_MS_FIELD_NUMBER: _ClassVar[int]
    BACKOFF_TYPE_FIELD_NUMBER: _ClassVar[int]
    max_attempts: int
    backoff_ms: int
    backoff_type: str
    def __init__(
        self,
        max_attempts: int | None = ...,
        backoff_ms: int | None = ...,
        backoff_type: str | None = ...,
    ) -> None: ...

class StepOutput(_message.Message):
    __slots__ = ("type", "condition", "next_steps")
    TYPE_FIELD_NUMBER: _ClassVar[int]
    CONDITION_FIELD_NUMBER: _ClassVar[int]
    NEXT_STEPS_FIELD_NUMBER: _ClassVar[int]
    type: str
    condition: str
    next_steps: _containers.RepeatedScalarFieldContainer[str]
    def __init__(
        self,
        type: str | None = ...,
        condition: str | None = ...,
        next_steps: _Iterable[str] | None = ...,
    ) -> None: ...

class LoopConfig(_message.Message):
    __slots__ = ("type", "items_var", "current_item_var", "condition", "max_iterations")
    TYPE_FIELD_NUMBER: _ClassVar[int]
    ITEMS_VAR_FIELD_NUMBER: _ClassVar[int]
    CURRENT_ITEM_VAR_FIELD_NUMBER: _ClassVar[int]
    CONDITION_FIELD_NUMBER: _ClassVar[int]
    MAX_ITERATIONS_FIELD_NUMBER: _ClassVar[int]
    type: str
    items_var: str
    current_item_var: str
    condition: str
    max_iterations: int
    def __init__(
        self,
        type: str | None = ...,
        items_var: str | None = ...,
        current_item_var: str | None = ...,
        condition: str | None = ...,
        max_iterations: int | None = ...,
    ) -> None: ...

class SkillStep(_message.Message):
    __slots__ = (
        "id",
        "name",
        "instruction",
        "skill_id",
        "tools",
        "inputs",
        "outputs",
        "parallel",
        "condition",
        "input_defs",
        "output_defs",
        "error_config",
        "retry_config",
        "step_outputs",
        "parallel_group",
        "loop_config",
        "is_disabled",
        "agentic_config",
    )
    class InputsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    class OutputsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    INSTRUCTION_FIELD_NUMBER: _ClassVar[int]
    SKILL_ID_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    INPUTS_FIELD_NUMBER: _ClassVar[int]
    OUTPUTS_FIELD_NUMBER: _ClassVar[int]
    PARALLEL_FIELD_NUMBER: _ClassVar[int]
    CONDITION_FIELD_NUMBER: _ClassVar[int]
    INPUT_DEFS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_DEFS_FIELD_NUMBER: _ClassVar[int]
    ERROR_CONFIG_FIELD_NUMBER: _ClassVar[int]
    RETRY_CONFIG_FIELD_NUMBER: _ClassVar[int]
    STEP_OUTPUTS_FIELD_NUMBER: _ClassVar[int]
    PARALLEL_GROUP_FIELD_NUMBER: _ClassVar[int]
    LOOP_CONFIG_FIELD_NUMBER: _ClassVar[int]
    IS_DISABLED_FIELD_NUMBER: _ClassVar[int]
    AGENTIC_CONFIG_FIELD_NUMBER: _ClassVar[int]
    id: str
    name: str
    instruction: str
    skill_id: int
    tools: _containers.RepeatedScalarFieldContainer[str]
    inputs: _containers.ScalarMap[str, str]
    outputs: _containers.ScalarMap[str, str]
    parallel: bool
    condition: str
    input_defs: _containers.RepeatedCompositeFieldContainer[InputDefinition]
    output_defs: _containers.RepeatedCompositeFieldContainer[OutputDefinition]
    error_config: ErrorConfig
    retry_config: RetryConfig
    step_outputs: _containers.RepeatedCompositeFieldContainer[StepOutput]
    parallel_group: str
    loop_config: LoopConfig
    is_disabled: bool
    agentic_config: AgenticStepConfig
    def __init__(
        self,
        id: str | None = ...,
        name: str | None = ...,
        instruction: str | None = ...,
        skill_id: int | None = ...,
        tools: _Iterable[str] | None = ...,
        inputs: _Mapping[str, str] | None = ...,
        outputs: _Mapping[str, str] | None = ...,
        parallel: bool = ...,
        condition: str | None = ...,
        input_defs: _Iterable[InputDefinition | _Mapping] | None = ...,
        output_defs: _Iterable[OutputDefinition | _Mapping] | None = ...,
        error_config: ErrorConfig | _Mapping | None = ...,
        retry_config: RetryConfig | _Mapping | None = ...,
        step_outputs: _Iterable[StepOutput | _Mapping] | None = ...,
        parallel_group: str | None = ...,
        loop_config: LoopConfig | _Mapping | None = ...,
        is_disabled: bool = ...,
        agentic_config: AgenticStepConfig | _Mapping | None = ...,
    ) -> None: ...

class AgenticStepConfig(_message.Message):
    __slots__ = ("instructions", "tools", "agent_type", "model", "plan")
    INSTRUCTIONS_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    AGENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    PLAN_FIELD_NUMBER: _ClassVar[int]
    instructions: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    agent_type: str
    model: str
    plan: StoredPlan
    def __init__(
        self,
        instructions: str | None = ...,
        tools: _Iterable[ToolConfig | _Mapping] | None = ...,
        agent_type: str | None = ...,
        model: str | None = ...,
        plan: StoredPlan | _Mapping | None = ...,
    ) -> None: ...

class StoredPlan(_message.Message):
    __slots__ = (
        "id",
        "goal",
        "basic_instructions",
        "context",
        "analysis",
        "steps",
        "version",
        "generated_at",
        "approved_at",
    )
    ID_FIELD_NUMBER: _ClassVar[int]
    GOAL_FIELD_NUMBER: _ClassVar[int]
    BASIC_INSTRUCTIONS_FIELD_NUMBER: _ClassVar[int]
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    ANALYSIS_FIELD_NUMBER: _ClassVar[int]
    STEPS_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    GENERATED_AT_FIELD_NUMBER: _ClassVar[int]
    APPROVED_AT_FIELD_NUMBER: _ClassVar[int]
    id: str
    goal: str
    basic_instructions: str
    context: str
    analysis: str
    steps: _containers.RepeatedCompositeFieldContainer[StoredPlanStep]
    version: int
    generated_at: str
    approved_at: str
    def __init__(
        self,
        id: str | None = ...,
        goal: str | None = ...,
        basic_instructions: str | None = ...,
        context: str | None = ...,
        analysis: str | None = ...,
        steps: _Iterable[StoredPlanStep | _Mapping] | None = ...,
        version: int | None = ...,
        generated_at: str | None = ...,
        approved_at: str | None = ...,
    ) -> None: ...

class StoredPlanStep(_message.Message):
    __slots__ = (
        "step_id",
        "description",
        "tool_call",
        "parameters",
        "context_tables",
        "target_agent",
        "sub_plan",
        "prompt_template",
        "required_context",
    )
    class ParametersEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    STEP_ID_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    TOOL_CALL_FIELD_NUMBER: _ClassVar[int]
    PARAMETERS_FIELD_NUMBER: _ClassVar[int]
    CONTEXT_TABLES_FIELD_NUMBER: _ClassVar[int]
    TARGET_AGENT_FIELD_NUMBER: _ClassVar[int]
    SUB_PLAN_FIELD_NUMBER: _ClassVar[int]
    PROMPT_TEMPLATE_FIELD_NUMBER: _ClassVar[int]
    REQUIRED_CONTEXT_FIELD_NUMBER: _ClassVar[int]
    step_id: str
    description: str
    tool_call: str
    parameters: _containers.ScalarMap[str, str]
    context_tables: _containers.RepeatedScalarFieldContainer[str]
    target_agent: str
    sub_plan: StoredSubPlan
    prompt_template: str
    required_context: _containers.RepeatedScalarFieldContainer[str]
    def __init__(
        self,
        step_id: str | None = ...,
        description: str | None = ...,
        tool_call: str | None = ...,
        parameters: _Mapping[str, str] | None = ...,
        context_tables: _Iterable[str] | None = ...,
        target_agent: str | None = ...,
        sub_plan: StoredSubPlan | _Mapping | None = ...,
        prompt_template: str | None = ...,
        required_context: _Iterable[str] | None = ...,
    ) -> None: ...

class StoredSubPlan(_message.Message):
    __slots__ = ("agent_name", "goal", "steps", "planning_observations")
    AGENT_NAME_FIELD_NUMBER: _ClassVar[int]
    GOAL_FIELD_NUMBER: _ClassVar[int]
    STEPS_FIELD_NUMBER: _ClassVar[int]
    PLANNING_OBSERVATIONS_FIELD_NUMBER: _ClassVar[int]
    agent_name: str
    goal: str
    steps: _containers.RepeatedCompositeFieldContainer[StoredPlanStep]
    planning_observations: str
    def __init__(
        self,
        agent_name: str | None = ...,
        goal: str | None = ...,
        steps: _Iterable[StoredPlanStep | _Mapping] | None = ...,
        planning_observations: str | None = ...,
    ) -> None: ...

class TargetFieldMetadata(_message.Message):
    __slots__ = ("field_type", "options", "max_selections", "field_name")
    FIELD_TYPE_FIELD_NUMBER: _ClassVar[int]
    OPTIONS_FIELD_NUMBER: _ClassVar[int]
    MAX_SELECTIONS_FIELD_NUMBER: _ClassVar[int]
    FIELD_NAME_FIELD_NUMBER: _ClassVar[int]
    field_type: str
    options: _containers.RepeatedScalarFieldContainer[str]
    max_selections: int
    field_name: str
    def __init__(
        self,
        field_type: str | None = ...,
        options: _Iterable[str] | None = ...,
        max_selections: int | None = ...,
        field_name: str | None = ...,
    ) -> None: ...

class TableReference(_message.Message):
    __slots__ = ("order", "field")
    ORDER_FIELD_NUMBER: _ClassVar[int]
    FIELD_FIELD_NUMBER: _ClassVar[int]
    order: int
    field: str
    def __init__(self, order: int | None = ..., field: str | None = ...) -> None: ...

class FieldSource(_message.Message):
    __slots__ = ("skill_output", "table_ref", "skill_input")
    SKILL_OUTPUT_FIELD_NUMBER: _ClassVar[int]
    TABLE_REF_FIELD_NUMBER: _ClassVar[int]
    SKILL_INPUT_FIELD_NUMBER: _ClassVar[int]
    skill_output: str
    table_ref: TableReference
    skill_input: str
    def __init__(
        self,
        skill_output: str | None = ...,
        table_ref: TableReference | _Mapping | None = ...,
        skill_input: str | None = ...,
    ) -> None: ...

class RowIdSource(_message.Message):
    __slots__ = (
        "static_id",
        "skill_input",
        "skill_output",
        "table_ref",
        "use_source_row",
    )
    STATIC_ID_FIELD_NUMBER: _ClassVar[int]
    SKILL_INPUT_FIELD_NUMBER: _ClassVar[int]
    SKILL_OUTPUT_FIELD_NUMBER: _ClassVar[int]
    TABLE_REF_FIELD_NUMBER: _ClassVar[int]
    USE_SOURCE_ROW_FIELD_NUMBER: _ClassVar[int]
    static_id: str
    skill_input: str
    skill_output: str
    table_ref: TableReference
    use_source_row: bool
    def __init__(
        self,
        static_id: str | None = ...,
        skill_input: str | None = ...,
        skill_output: str | None = ...,
        table_ref: TableReference | _Mapping | None = ...,
        use_source_row: bool = ...,
    ) -> None: ...

class FieldMapping(_message.Message):
    __slots__ = ("source", "target_field_id", "target_field_metadata", "append_mode")
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    TARGET_FIELD_ID_FIELD_NUMBER: _ClassVar[int]
    TARGET_FIELD_METADATA_FIELD_NUMBER: _ClassVar[int]
    APPEND_MODE_FIELD_NUMBER: _ClassVar[int]
    source: FieldSource
    target_field_id: int
    target_field_metadata: TargetFieldMetadata
    append_mode: bool
    def __init__(
        self,
        source: FieldSource | _Mapping | None = ...,
        target_field_id: int | None = ...,
        target_field_metadata: TargetFieldMetadata | _Mapping | None = ...,
        append_mode: bool = ...,
    ) -> None: ...

class TableMapping(_message.Message):
    __slots__ = (
        "order",
        "target_table_id",
        "row_action",
        "row_id_source",
        "mappings",
        "display_field_id",
        "mode",
    )
    ORDER_FIELD_NUMBER: _ClassVar[int]
    TARGET_TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    ROW_ACTION_FIELD_NUMBER: _ClassVar[int]
    ROW_ID_SOURCE_FIELD_NUMBER: _ClassVar[int]
    MAPPINGS_FIELD_NUMBER: _ClassVar[int]
    DISPLAY_FIELD_ID_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    order: int
    target_table_id: int
    row_action: str
    row_id_source: RowIdSource
    mappings: _containers.RepeatedCompositeFieldContainer[FieldMapping]
    display_field_id: int
    mode: str
    def __init__(
        self,
        order: int | None = ...,
        target_table_id: int | None = ...,
        row_action: str | None = ...,
        row_id_source: RowIdSource | _Mapping | None = ...,
        mappings: _Iterable[FieldMapping | _Mapping] | None = ...,
        display_field_id: int | None = ...,
        mode: str | None = ...,
    ) -> None: ...

class OutputMappingConfig(_message.Message):
    __slots__ = ("mode", "table_mappings")
    MODE_FIELD_NUMBER: _ClassVar[int]
    TABLE_MAPPINGS_FIELD_NUMBER: _ClassVar[int]
    mode: str
    table_mappings: _containers.RepeatedCompositeFieldContainer[TableMapping]
    def __init__(
        self,
        mode: str | None = ...,
        table_mappings: _Iterable[TableMapping | _Mapping] | None = ...,
    ) -> None: ...

class ToolConfig(_message.Message):
    __slots__ = ("name", "version", "config")
    class ConfigEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    NAME_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    name: str
    version: str
    config: _containers.ScalarMap[str, str]
    def __init__(
        self,
        name: str | None = ...,
        version: str | None = ...,
        config: _Mapping[str, str] | None = ...,
    ) -> None: ...

class ServerConfig(_message.Message):
    __slots__ = ("name", "endpoint", "config")
    class ConfigEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    NAME_FIELD_NUMBER: _ClassVar[int]
    ENDPOINT_FIELD_NUMBER: _ClassVar[int]
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    name: str
    endpoint: str
    config: _containers.ScalarMap[str, str]
    def __init__(
        self,
        name: str | None = ...,
        endpoint: str | None = ...,
        config: _Mapping[str, str] | None = ...,
    ) -> None: ...

class SkillInputValue(_message.Message):
    __slots__ = (
        "name",
        "type",
        "string_value",
        "number_value",
        "bool_value",
        "json_value",
    )
    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    STRING_VALUE_FIELD_NUMBER: _ClassVar[int]
    NUMBER_VALUE_FIELD_NUMBER: _ClassVar[int]
    BOOL_VALUE_FIELD_NUMBER: _ClassVar[int]
    JSON_VALUE_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: str
    string_value: str
    number_value: float
    bool_value: bool
    json_value: str
    def __init__(
        self,
        name: str | None = ...,
        type: str | None = ...,
        string_value: str | None = ...,
        number_value: float | None = ...,
        bool_value: bool = ...,
        json_value: str | None = ...,
    ) -> None: ...

class TriggerData(_message.Message):
    __slots__ = ("skill_inputs",)
    SKILL_INPUTS_FIELD_NUMBER: _ClassVar[int]
    skill_inputs: _containers.RepeatedCompositeFieldContainer[SkillInputValue]
    def __init__(
        self, skill_inputs: _Iterable[SkillInputValue | _Mapping] | None = ...
    ) -> None: ...

class InstructionConfig(_message.Message):
    __slots__ = ("task", "images", "attachments", "tools", "servers", "model")
    TASK_FIELD_NUMBER: _ClassVar[int]
    IMAGES_FIELD_NUMBER: _ClassVar[int]
    ATTACHMENTS_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    SERVERS_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    task: str
    images: _containers.RepeatedCompositeFieldContainer[ImageAttachment]
    attachments: _containers.RepeatedCompositeFieldContainer[FileAttachment]
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    servers: _containers.RepeatedCompositeFieldContainer[ServerConfig]
    model: str
    def __init__(
        self,
        task: str | None = ...,
        images: _Iterable[ImageAttachment | _Mapping] | None = ...,
        attachments: _Iterable[FileAttachment | _Mapping] | None = ...,
        tools: _Iterable[ToolConfig | _Mapping] | None = ...,
        servers: _Iterable[ServerConfig | _Mapping] | None = ...,
        model: str | None = ...,
    ) -> None: ...

class ImageAttachment(_message.Message):
    __slots__ = ("url", "s3_key")
    URL_FIELD_NUMBER: _ClassVar[int]
    S3_KEY_FIELD_NUMBER: _ClassVar[int]
    url: str
    s3_key: str
    def __init__(self, url: str | None = ..., s3_key: str | None = ...) -> None: ...

class FileAttachment(_message.Message):
    __slots__ = ("type", "url", "filename", "mime_type")
    TYPE_FIELD_NUMBER: _ClassVar[int]
    URL_FIELD_NUMBER: _ClassVar[int]
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    MIME_TYPE_FIELD_NUMBER: _ClassVar[int]
    type: str
    url: str
    filename: str
    mime_type: str
    def __init__(
        self,
        type: str | None = ...,
        url: str | None = ...,
        filename: str | None = ...,
        mime_type: str | None = ...,
    ) -> None: ...

class GeneratePlanRequest(_message.Message):
    __slots__ = (
        "instructions",
        "organization_id",
        "user_id",
        "skill_id",
        "model",
        "user_api_key",
        "timeout_seconds",
        "skill_inputs",
        "previous_plan_json",
        "user_feedback",
        "skill_outputs",
        "session_id",
        "answers",
    )
    INSTRUCTIONS_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    SKILL_ID_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    USER_API_KEY_FIELD_NUMBER: _ClassVar[int]
    TIMEOUT_SECONDS_FIELD_NUMBER: _ClassVar[int]
    SKILL_INPUTS_FIELD_NUMBER: _ClassVar[int]
    PREVIOUS_PLAN_JSON_FIELD_NUMBER: _ClassVar[int]
    USER_FEEDBACK_FIELD_NUMBER: _ClassVar[int]
    SKILL_OUTPUTS_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    ANSWERS_FIELD_NUMBER: _ClassVar[int]
    instructions: str
    organization_id: int
    user_id: str
    skill_id: int
    model: str
    user_api_key: str
    timeout_seconds: int
    skill_inputs: _containers.RepeatedCompositeFieldContainer[InputDefinition]
    previous_plan_json: str
    user_feedback: str
    skill_outputs: _containers.RepeatedCompositeFieldContainer[OutputDefinition]
    session_id: str
    answers: _containers.RepeatedCompositeFieldContainer[ClarificationAnswer]
    def __init__(
        self,
        instructions: str | None = ...,
        organization_id: int | None = ...,
        user_id: str | None = ...,
        skill_id: int | None = ...,
        model: str | None = ...,
        user_api_key: str | None = ...,
        timeout_seconds: int | None = ...,
        skill_inputs: _Iterable[InputDefinition | _Mapping] | None = ...,
        previous_plan_json: str | None = ...,
        user_feedback: str | None = ...,
        skill_outputs: _Iterable[OutputDefinition | _Mapping] | None = ...,
        session_id: str | None = ...,
        answers: _Iterable[ClarificationAnswer | _Mapping] | None = ...,
    ) -> None: ...

class GeneratePlanResponse(_message.Message):
    __slots__ = ("progress", "awaiting_input", "plan_complete", "error", "timestamp")
    PROGRESS_FIELD_NUMBER: _ClassVar[int]
    AWAITING_INPUT_FIELD_NUMBER: _ClassVar[int]
    PLAN_COMPLETE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    progress: PlanProgress
    awaiting_input: AwaitingInput
    plan_complete: PlanComplete
    error: ProcessingError
    timestamp: int
    def __init__(
        self,
        progress: PlanProgress | _Mapping | None = ...,
        awaiting_input: AwaitingInput | _Mapping | None = ...,
        plan_complete: PlanComplete | _Mapping | None = ...,
        error: ProcessingError | _Mapping | None = ...,
        timestamp: int | None = ...,
    ) -> None: ...

class PlanProgress(_message.Message):
    __slots__ = ("message", "phase")
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    PHASE_FIELD_NUMBER: _ClassVar[int]
    message: str
    phase: str
    def __init__(self, message: str | None = ..., phase: str | None = ...) -> None: ...

class PlanComplete(_message.Message):
    __slots__ = ("plan_json", "plan_id", "planning_time_ms", "token_usage")
    PLAN_JSON_FIELD_NUMBER: _ClassVar[int]
    PLAN_ID_FIELD_NUMBER: _ClassVar[int]
    PLANNING_TIME_MS_FIELD_NUMBER: _ClassVar[int]
    TOKEN_USAGE_FIELD_NUMBER: _ClassVar[int]
    plan_json: str
    plan_id: str
    planning_time_ms: int
    token_usage: TokenUsage
    def __init__(
        self,
        plan_json: str | None = ...,
        plan_id: str | None = ...,
        planning_time_ms: int | None = ...,
        token_usage: TokenUsage | _Mapping | None = ...,
    ) -> None: ...

class ClarificationAnswer(_message.Message):
    __slots__ = ("question_id", "answer")
    QUESTION_ID_FIELD_NUMBER: _ClassVar[int]
    ANSWER_FIELD_NUMBER: _ClassVar[int]
    question_id: str
    answer: str
    def __init__(
        self, question_id: str | None = ..., answer: str | None = ...
    ) -> None: ...

class ProcessMessageRequest(_message.Message):
    __slots__ = (
        "message_parts",
        "user_id",
        "organization_id",
        "conversation_history",
        "agent_config",
        "model",
        "message_id",
        "session_id",
        "user_api_key",
        "task_id",
        "user_name",
    )
    MESSAGE_PARTS_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    CONVERSATION_HISTORY_FIELD_NUMBER: _ClassVar[int]
    AGENT_CONFIG_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    USER_API_KEY_FIELD_NUMBER: _ClassVar[int]
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    USER_NAME_FIELD_NUMBER: _ClassVar[int]
    message_parts: _containers.RepeatedCompositeFieldContainer[MessagePart]
    user_id: str
    organization_id: int
    conversation_history: _containers.RepeatedCompositeFieldContainer[HistoryMessage]
    agent_config: AgentConfig
    model: str
    message_id: str
    session_id: str
    user_api_key: str
    task_id: str
    user_name: str
    def __init__(
        self,
        message_parts: _Iterable[MessagePart | _Mapping] | None = ...,
        user_id: str | None = ...,
        organization_id: int | None = ...,
        conversation_history: _Iterable[HistoryMessage | _Mapping] | None = ...,
        agent_config: AgentConfig | _Mapping | None = ...,
        model: str | None = ...,
        message_id: str | None = ...,
        session_id: str | None = ...,
        user_api_key: str | None = ...,
        task_id: str | None = ...,
        user_name: str | None = ...,
    ) -> None: ...

class ProcessMessageResponse(_message.Message):
    __slots__ = (
        "content_chunk",
        "complete",
        "error",
        "step_progress",
        "awaiting_input",
        "timestamp",
        "task_id",
        "task_progress",
    )
    CONTENT_CHUNK_FIELD_NUMBER: _ClassVar[int]
    COMPLETE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    STEP_PROGRESS_FIELD_NUMBER: _ClassVar[int]
    AWAITING_INPUT_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    TASK_PROGRESS_FIELD_NUMBER: _ClassVar[int]
    content_chunk: ContentChunk
    complete: ProcessingComplete
    error: ProcessingError
    step_progress: StepProgress
    awaiting_input: AwaitingInput
    timestamp: int
    task_id: str
    task_progress: ChatTaskProgress
    def __init__(
        self,
        content_chunk: ContentChunk | _Mapping | None = ...,
        complete: ProcessingComplete | _Mapping | None = ...,
        error: ProcessingError | _Mapping | None = ...,
        step_progress: StepProgress | _Mapping | None = ...,
        awaiting_input: AwaitingInput | _Mapping | None = ...,
        timestamp: int | None = ...,
        task_id: str | None = ...,
        task_progress: ChatTaskProgress | _Mapping | None = ...,
    ) -> None: ...

class AwaitingInput(_message.Message):
    __slots__ = ("input_type", "title", "content", "options", "plan_json", "session_id")
    INPUT_TYPE_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    OPTIONS_FIELD_NUMBER: _ClassVar[int]
    PLAN_JSON_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    input_type: str
    title: str
    content: str
    options: _containers.RepeatedCompositeFieldContainer[InputOption]
    plan_json: str
    session_id: str
    def __init__(
        self,
        input_type: str | None = ...,
        title: str | None = ...,
        content: str | None = ...,
        options: _Iterable[InputOption | _Mapping] | None = ...,
        plan_json: str | None = ...,
        session_id: str | None = ...,
    ) -> None: ...

class InputOption(_message.Message):
    __slots__ = ("id", "label", "description")
    ID_FIELD_NUMBER: _ClassVar[int]
    LABEL_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    id: str
    label: str
    description: str
    def __init__(
        self,
        id: str | None = ...,
        label: str | None = ...,
        description: str | None = ...,
    ) -> None: ...

class MessagePart(_message.Message):
    __slots__ = ("text", "image_url", "file")
    TEXT_FIELD_NUMBER: _ClassVar[int]
    IMAGE_URL_FIELD_NUMBER: _ClassVar[int]
    FILE_FIELD_NUMBER: _ClassVar[int]
    text: TextPart
    image_url: ImageUrlPart
    file: FilePart
    def __init__(
        self,
        text: TextPart | _Mapping | None = ...,
        image_url: ImageUrlPart | _Mapping | None = ...,
        file: FilePart | _Mapping | None = ...,
    ) -> None: ...

class TextPart(_message.Message):
    __slots__ = ("text",)
    TEXT_FIELD_NUMBER: _ClassVar[int]
    text: str
    def __init__(self, text: str | None = ...) -> None: ...

class ImageUrlPart(_message.Message):
    __slots__ = ("url",)
    URL_FIELD_NUMBER: _ClassVar[int]
    url: str
    def __init__(self, url: str | None = ...) -> None: ...

class FilePart(_message.Message):
    __slots__ = ("url", "mime_type", "filename", "size")
    URL_FIELD_NUMBER: _ClassVar[int]
    MIME_TYPE_FIELD_NUMBER: _ClassVar[int]
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    url: str
    mime_type: str
    filename: str
    size: int
    def __init__(
        self,
        url: str | None = ...,
        mime_type: str | None = ...,
        filename: str | None = ...,
        size: int | None = ...,
    ) -> None: ...

class HistoryMessage(_message.Message):
    __slots__ = ("role", "content_parts", "timestamp")
    ROLE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_PARTS_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    role: str
    content_parts: _containers.RepeatedCompositeFieldContainer[MessagePart]
    timestamp: int
    def __init__(
        self,
        role: str | None = ...,
        content_parts: _Iterable[MessagePart | _Mapping] | None = ...,
        timestamp: int | None = ...,
    ) -> None: ...

class ContentChunk(_message.Message):
    __slots__ = ("content", "sequence")
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    SEQUENCE_FIELD_NUMBER: _ClassVar[int]
    content: str
    sequence: int
    def __init__(
        self, content: str | None = ..., sequence: int | None = ...
    ) -> None: ...

class ProcessingComplete(_message.Message):
    __slots__ = (
        "model_used",
        "total_tokens",
        "processing_time_ms",
        "metadata",
        "token_usage",
    )
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    MODEL_USED_FIELD_NUMBER: _ClassVar[int]
    TOTAL_TOKENS_FIELD_NUMBER: _ClassVar[int]
    PROCESSING_TIME_MS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    TOKEN_USAGE_FIELD_NUMBER: _ClassVar[int]
    model_used: str
    total_tokens: int
    processing_time_ms: int
    metadata: _containers.ScalarMap[str, str]
    token_usage: TokenUsage
    def __init__(
        self,
        model_used: str | None = ...,
        total_tokens: int | None = ...,
        processing_time_ms: int | None = ...,
        metadata: _Mapping[str, str] | None = ...,
        token_usage: TokenUsage | _Mapping | None = ...,
    ) -> None: ...

class ProcessingError(_message.Message):
    __slots__ = (
        "error_code",
        "error_message",
        "error_details",
        "hint",
        "can_retry",
        "auto_retry",
        "session_reset",
        "token_usage",
    )
    class ErrorDetailsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    ERROR_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    ERROR_DETAILS_FIELD_NUMBER: _ClassVar[int]
    HINT_FIELD_NUMBER: _ClassVar[int]
    CAN_RETRY_FIELD_NUMBER: _ClassVar[int]
    AUTO_RETRY_FIELD_NUMBER: _ClassVar[int]
    SESSION_RESET_FIELD_NUMBER: _ClassVar[int]
    TOKEN_USAGE_FIELD_NUMBER: _ClassVar[int]
    error_code: str
    error_message: str
    error_details: _containers.ScalarMap[str, str]
    hint: str
    can_retry: bool
    auto_retry: bool
    session_reset: bool
    token_usage: TokenUsage
    def __init__(
        self,
        error_code: str | None = ...,
        error_message: str | None = ...,
        error_details: _Mapping[str, str] | None = ...,
        hint: str | None = ...,
        can_retry: bool = ...,
        auto_retry: bool = ...,
        session_reset: bool = ...,
        token_usage: TokenUsage | _Mapping | None = ...,
    ) -> None: ...

class StepProgress(_message.Message):
    __slots__ = ("step_type", "step_name", "content", "metadata", "step_index")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    STEP_TYPE_FIELD_NUMBER: _ClassVar[int]
    STEP_NAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    STEP_INDEX_FIELD_NUMBER: _ClassVar[int]
    step_type: StepType
    step_name: str
    content: str
    metadata: _containers.ScalarMap[str, str]
    step_index: int
    def __init__(
        self,
        step_type: StepType | str | None = ...,
        step_name: str | None = ...,
        content: str | None = ...,
        metadata: _Mapping[str, str] | None = ...,
        step_index: int | None = ...,
    ) -> None: ...

class CancelMessageRequest(_message.Message):
    __slots__ = ("message_id", "user_id", "organization_id")
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    message_id: str
    user_id: str
    organization_id: int
    def __init__(
        self,
        message_id: str | None = ...,
        user_id: str | None = ...,
        organization_id: int | None = ...,
    ) -> None: ...

class CancelMessageResponse(_message.Message):
    __slots__ = ("success", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    def __init__(self, success: bool = ..., message: str | None = ...) -> None: ...

class ContextMappingProto(_message.Message):
    __slots__ = (
        "table_id",
        "table_name",
        "access_mode",
        "sync_mode",
        "target_type",
        "target_id",
    )
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    TABLE_NAME_FIELD_NUMBER: _ClassVar[int]
    ACCESS_MODE_FIELD_NUMBER: _ClassVar[int]
    SYNC_MODE_FIELD_NUMBER: _ClassVar[int]
    TARGET_TYPE_FIELD_NUMBER: _ClassVar[int]
    TARGET_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: int
    table_name: str
    access_mode: str
    sync_mode: str
    target_type: str
    target_id: str
    def __init__(
        self,
        table_id: int | None = ...,
        table_name: str | None = ...,
        access_mode: str | None = ...,
        sync_mode: str | None = ...,
        target_type: str | None = ...,
        target_id: str | None = ...,
    ) -> None: ...

class ResolvedContextProto(_message.Message):
    __slots__ = ("mappings", "agent_mappings", "skill_mappings", "step_mappings")
    MAPPINGS_FIELD_NUMBER: _ClassVar[int]
    AGENT_MAPPINGS_FIELD_NUMBER: _ClassVar[int]
    SKILL_MAPPINGS_FIELD_NUMBER: _ClassVar[int]
    STEP_MAPPINGS_FIELD_NUMBER: _ClassVar[int]
    mappings: _containers.RepeatedCompositeFieldContainer[ContextMappingProto]
    agent_mappings: _containers.RepeatedCompositeFieldContainer[ContextMappingProto]
    skill_mappings: _containers.RepeatedCompositeFieldContainer[ContextMappingProto]
    step_mappings: _containers.RepeatedCompositeFieldContainer[ContextMappingProto]
    def __init__(
        self,
        mappings: _Iterable[ContextMappingProto | _Mapping] | None = ...,
        agent_mappings: _Iterable[ContextMappingProto | _Mapping] | None = ...,
        skill_mappings: _Iterable[ContextMappingProto | _Mapping] | None = ...,
        step_mappings: _Iterable[ContextMappingProto | _Mapping] | None = ...,
    ) -> None: ...
