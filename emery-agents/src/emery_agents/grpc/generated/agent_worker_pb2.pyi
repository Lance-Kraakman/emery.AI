from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

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
    CODE_STEP: _ClassVar[StepType]
    TOOL_STEP: _ClassVar[StepType]
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
CODE_STEP: StepType
TOOL_STEP: StepType

class TaskRequest(_message.Message):
    __slots__ = ("task_id", "agent_id", "capability_name", "instruction_config", "agent_config", "trigger_data", "organization_id", "owner_id", "timeout_seconds", "name")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    AGENT_ID_FIELD_NUMBER: _ClassVar[int]
    CAPABILITY_NAME_FIELD_NUMBER: _ClassVar[int]
    INSTRUCTION_CONFIG_FIELD_NUMBER: _ClassVar[int]
    AGENT_CONFIG_FIELD_NUMBER: _ClassVar[int]
    TRIGGER_DATA_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    OWNER_ID_FIELD_NUMBER: _ClassVar[int]
    TIMEOUT_SECONDS_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    agent_id: int
    capability_name: str
    instruction_config: InstructionConfig
    agent_config: AgentConfig
    trigger_data: TriggerData
    organization_id: str
    owner_id: str
    timeout_seconds: int
    name: str
    def __init__(self, task_id: _Optional[str] = ..., agent_id: _Optional[int] = ..., capability_name: _Optional[str] = ..., instruction_config: _Optional[_Union[InstructionConfig, _Mapping]] = ..., agent_config: _Optional[_Union[AgentConfig, _Mapping]] = ..., trigger_data: _Optional[_Union[TriggerData, _Mapping]] = ..., organization_id: _Optional[str] = ..., owner_id: _Optional[str] = ..., timeout_seconds: _Optional[int] = ..., name: _Optional[str] = ...) -> None: ...

class TaskProgress(_message.Message):
    __slots__ = ("task_id", "status", "step_id", "step_type", "output_json", "error_message", "timestamp_ms", "progress_percent")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    STEP_ID_FIELD_NUMBER: _ClassVar[int]
    STEP_TYPE_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_JSON_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_MS_FIELD_NUMBER: _ClassVar[int]
    PROGRESS_PERCENT_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    status: TaskStatus
    step_id: str
    step_type: str
    output_json: str
    error_message: str
    timestamp_ms: int
    progress_percent: float
    def __init__(self, task_id: _Optional[str] = ..., status: _Optional[_Union[TaskStatus, str]] = ..., step_id: _Optional[str] = ..., step_type: _Optional[str] = ..., output_json: _Optional[str] = ..., error_message: _Optional[str] = ..., timestamp_ms: _Optional[int] = ..., progress_percent: _Optional[float] = ...) -> None: ...

class CancelTaskRequest(_message.Message):
    __slots__ = ("task_id", "reason")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    reason: str
    def __init__(self, task_id: _Optional[str] = ..., reason: _Optional[str] = ...) -> None: ...

class CancelTaskResponse(_message.Message):
    __slots__ = ("success", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    def __init__(self, success: bool = ..., message: _Optional[str] = ...) -> None: ...

class WorkerInfo(_message.Message):
    __slots__ = ("worker_id", "version", "organization_id", "status", "capabilities", "active_tasks", "max_concurrent_tasks", "uptime_seconds", "supported_tools")
    WORKER_ID_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    CAPABILITIES_FIELD_NUMBER: _ClassVar[int]
    ACTIVE_TASKS_FIELD_NUMBER: _ClassVar[int]
    MAX_CONCURRENT_TASKS_FIELD_NUMBER: _ClassVar[int]
    UPTIME_SECONDS_FIELD_NUMBER: _ClassVar[int]
    SUPPORTED_TOOLS_FIELD_NUMBER: _ClassVar[int]
    worker_id: str
    version: str
    organization_id: str
    status: WorkerStatus
    capabilities: _containers.RepeatedScalarFieldContainer[str]
    active_tasks: int
    max_concurrent_tasks: int
    uptime_seconds: int
    supported_tools: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, worker_id: _Optional[str] = ..., version: _Optional[str] = ..., organization_id: _Optional[str] = ..., status: _Optional[_Union[WorkerStatus, str]] = ..., capabilities: _Optional[_Iterable[str]] = ..., active_tasks: _Optional[int] = ..., max_concurrent_tasks: _Optional[int] = ..., uptime_seconds: _Optional[int] = ..., supported_tools: _Optional[_Iterable[str]] = ...) -> None: ...

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
    def __init__(self, code: _Optional[str] = ..., message: _Optional[str] = ..., details: _Optional[str] = ...) -> None: ...

class AgentConfig(_message.Message):
    __slots__ = ("name", "role", "description", "persona", "tools", "servers", "capabilities")
    NAME_FIELD_NUMBER: _ClassVar[int]
    ROLE_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    PERSONA_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    SERVERS_FIELD_NUMBER: _ClassVar[int]
    CAPABILITIES_FIELD_NUMBER: _ClassVar[int]
    name: str
    role: str
    description: str
    persona: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    servers: _containers.RepeatedCompositeFieldContainer[ServerConfig]
    capabilities: _containers.RepeatedCompositeFieldContainer[CapabilityConfig]
    def __init__(self, name: _Optional[str] = ..., role: _Optional[str] = ..., description: _Optional[str] = ..., persona: _Optional[str] = ..., tools: _Optional[_Iterable[_Union[ToolConfig, _Mapping]]] = ..., servers: _Optional[_Iterable[_Union[ServerConfig, _Mapping]]] = ..., capabilities: _Optional[_Iterable[_Union[CapabilityConfig, _Mapping]]] = ...) -> None: ...

class CapabilityConfig(_message.Message):
    __slots__ = ("name", "description", "steps")
    NAME_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    STEPS_FIELD_NUMBER: _ClassVar[int]
    name: str
    description: str
    steps: _containers.RepeatedCompositeFieldContainer[StepConfig]
    def __init__(self, name: _Optional[str] = ..., description: _Optional[str] = ..., steps: _Optional[_Iterable[_Union[StepConfig, _Mapping]]] = ...) -> None: ...

class StepConfig(_message.Message):
    __slots__ = ("id", "type", "instructions", "model", "tools", "servers")
    ID_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    INSTRUCTIONS_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    SERVERS_FIELD_NUMBER: _ClassVar[int]
    id: str
    type: StepType
    instructions: str
    model: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    servers: _containers.RepeatedCompositeFieldContainer[ServerConfig]
    def __init__(self, id: _Optional[str] = ..., type: _Optional[_Union[StepType, str]] = ..., instructions: _Optional[str] = ..., model: _Optional[str] = ..., tools: _Optional[_Iterable[_Union[ToolConfig, _Mapping]]] = ..., servers: _Optional[_Iterable[_Union[ServerConfig, _Mapping]]] = ...) -> None: ...

class ToolConfig(_message.Message):
    __slots__ = ("name", "version", "config")
    class ConfigEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    NAME_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    name: str
    version: str
    config: _containers.ScalarMap[str, str]
    def __init__(self, name: _Optional[str] = ..., version: _Optional[str] = ..., config: _Optional[_Mapping[str, str]] = ...) -> None: ...

class ServerConfig(_message.Message):
    __slots__ = ("name", "endpoint", "config")
    class ConfigEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    NAME_FIELD_NUMBER: _ClassVar[int]
    ENDPOINT_FIELD_NUMBER: _ClassVar[int]
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    name: str
    endpoint: str
    config: _containers.ScalarMap[str, str]
    def __init__(self, name: _Optional[str] = ..., endpoint: _Optional[str] = ..., config: _Optional[_Mapping[str, str]] = ...) -> None: ...

class TriggerData(_message.Message):
    __slots__ = ("payload",)
    class PayloadEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    payload: _containers.ScalarMap[str, str]
    def __init__(self, payload: _Optional[_Mapping[str, str]] = ...) -> None: ...

class InstructionConfig(_message.Message):
    __slots__ = ("instructions", "tools", "servers")
    INSTRUCTIONS_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    SERVERS_FIELD_NUMBER: _ClassVar[int]
    instructions: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    servers: _containers.RepeatedCompositeFieldContainer[ServerConfig]
    def __init__(self, instructions: _Optional[str] = ..., tools: _Optional[_Iterable[_Union[ToolConfig, _Mapping]]] = ..., servers: _Optional[_Iterable[_Union[ServerConfig, _Mapping]]] = ...) -> None: ...
