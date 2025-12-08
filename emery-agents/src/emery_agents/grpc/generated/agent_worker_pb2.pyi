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
    __slots__ = ("task_id", "agent_id", "skill_name", "instruction_config", "agent_config", "trigger_data", "organization_id", "owner_id", "timeout_seconds", "name", "agent_model", "organization_model", "input_content")
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
    def __init__(self, task_id: _Optional[str] = ..., agent_id: _Optional[int] = ..., skill_name: _Optional[str] = ..., instruction_config: _Optional[_Union[InstructionConfig, _Mapping]] = ..., agent_config: _Optional[_Union[AgentConfig, _Mapping]] = ..., trigger_data: _Optional[_Union[TriggerData, _Mapping]] = ..., organization_id: _Optional[str] = ..., owner_id: _Optional[str] = ..., timeout_seconds: _Optional[int] = ..., name: _Optional[str] = ..., agent_model: _Optional[str] = ..., organization_model: _Optional[str] = ..., input_content: _Optional[_Iterable[_Union[MessagePart, _Mapping]]] = ...) -> None: ...

class TaskProgress(_message.Message):
    __slots__ = ("task_id", "status", "output_json", "error_message", "timestamp_ms", "progress_percent", "token_usage")
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
    def __init__(self, task_id: _Optional[str] = ..., status: _Optional[_Union[TaskStatus, str]] = ..., output_json: _Optional[str] = ..., error_message: _Optional[str] = ..., timestamp_ms: _Optional[int] = ..., progress_percent: _Optional[float] = ..., token_usage: _Optional[_Union[TokenUsage, _Mapping]] = ...) -> None: ...

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
    __slots__ = ("worker_id", "version", "organization_id", "status", "skills", "active_tasks", "max_concurrent_tasks", "uptime_seconds", "supported_tools")
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
    def __init__(self, worker_id: _Optional[str] = ..., version: _Optional[str] = ..., organization_id: _Optional[str] = ..., status: _Optional[_Union[WorkerStatus, str]] = ..., skills: _Optional[_Iterable[str]] = ..., active_tasks: _Optional[int] = ..., max_concurrent_tasks: _Optional[int] = ..., uptime_seconds: _Optional[int] = ..., supported_tools: _Optional[_Iterable[str]] = ...) -> None: ...

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

class TokenUsage(_message.Message):
    __slots__ = ("model_name", "input_tokens", "output_tokens", "total_tokens", "cost_usd")
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
    def __init__(self, model_name: _Optional[str] = ..., input_tokens: _Optional[int] = ..., output_tokens: _Optional[int] = ..., total_tokens: _Optional[int] = ..., cost_usd: _Optional[float] = ...) -> None: ...

class AgentConfig(_message.Message):
    __slots__ = ("name", "role", "description", "persona", "tools", "servers", "skills", "default_model")
    NAME_FIELD_NUMBER: _ClassVar[int]
    ROLE_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    PERSONA_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    SERVERS_FIELD_NUMBER: _ClassVar[int]
    SKILLS_FIELD_NUMBER: _ClassVar[int]
    DEFAULT_MODEL_FIELD_NUMBER: _ClassVar[int]
    name: str
    role: str
    description: str
    persona: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    servers: _containers.RepeatedCompositeFieldContainer[ServerConfig]
    skills: _containers.RepeatedCompositeFieldContainer[SkillConfig]
    default_model: str
    def __init__(self, name: _Optional[str] = ..., role: _Optional[str] = ..., description: _Optional[str] = ..., persona: _Optional[str] = ..., tools: _Optional[_Iterable[_Union[ToolConfig, _Mapping]]] = ..., servers: _Optional[_Iterable[_Union[ServerConfig, _Mapping]]] = ..., skills: _Optional[_Iterable[_Union[SkillConfig, _Mapping]]] = ..., default_model: _Optional[str] = ...) -> None: ...

class SkillConfig(_message.Message):
    __slots__ = ("id", "name", "description", "inputs", "outputs", "instructions", "tools", "model", "content")
    ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    INPUTS_FIELD_NUMBER: _ClassVar[int]
    OUTPUTS_FIELD_NUMBER: _ClassVar[int]
    INSTRUCTIONS_FIELD_NUMBER: _ClassVar[int]
    TOOLS_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    id: int
    name: str
    description: str
    inputs: _containers.RepeatedCompositeFieldContainer[SkillInput]
    outputs: _containers.RepeatedCompositeFieldContainer[SkillOutput]
    instructions: str
    tools: _containers.RepeatedCompositeFieldContainer[ToolConfig]
    model: str
    content: _containers.RepeatedCompositeFieldContainer[MessagePart]
    def __init__(self, id: _Optional[int] = ..., name: _Optional[str] = ..., description: _Optional[str] = ..., inputs: _Optional[_Iterable[_Union[SkillInput, _Mapping]]] = ..., outputs: _Optional[_Iterable[_Union[SkillOutput, _Mapping]]] = ..., instructions: _Optional[str] = ..., tools: _Optional[_Iterable[_Union[ToolConfig, _Mapping]]] = ..., model: _Optional[str] = ..., content: _Optional[_Iterable[_Union[MessagePart, _Mapping]]] = ...) -> None: ...

class SkillInput(_message.Message):
    __slots__ = ("name", "required", "type", "file_config")
    NAME_FIELD_NUMBER: _ClassVar[int]
    REQUIRED_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    FILE_CONFIG_FIELD_NUMBER: _ClassVar[int]
    name: str
    required: bool
    type: str
    file_config: SkillInputFileConfig
    def __init__(self, name: _Optional[str] = ..., required: bool = ..., type: _Optional[str] = ..., file_config: _Optional[_Union[SkillInputFileConfig, _Mapping]] = ...) -> None: ...

class SkillInputFileConfig(_message.Message):
    __slots__ = ("allowed_mime_types", "max_size_bytes", "multiple")
    ALLOWED_MIME_TYPES_FIELD_NUMBER: _ClassVar[int]
    MAX_SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    MULTIPLE_FIELD_NUMBER: _ClassVar[int]
    allowed_mime_types: _containers.RepeatedScalarFieldContainer[str]
    max_size_bytes: int
    multiple: bool
    def __init__(self, allowed_mime_types: _Optional[_Iterable[str]] = ..., max_size_bytes: _Optional[int] = ..., multiple: bool = ...) -> None: ...

class SkillOutput(_message.Message):
    __slots__ = ("name", "type")
    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: str
    def __init__(self, name: _Optional[str] = ..., type: _Optional[str] = ...) -> None: ...

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
    def __init__(self, task: _Optional[str] = ..., images: _Optional[_Iterable[_Union[ImageAttachment, _Mapping]]] = ..., attachments: _Optional[_Iterable[_Union[FileAttachment, _Mapping]]] = ..., tools: _Optional[_Iterable[_Union[ToolConfig, _Mapping]]] = ..., servers: _Optional[_Iterable[_Union[ServerConfig, _Mapping]]] = ..., model: _Optional[str] = ...) -> None: ...

class ImageAttachment(_message.Message):
    __slots__ = ("url", "s3_key")
    URL_FIELD_NUMBER: _ClassVar[int]
    S3_KEY_FIELD_NUMBER: _ClassVar[int]
    url: str
    s3_key: str
    def __init__(self, url: _Optional[str] = ..., s3_key: _Optional[str] = ...) -> None: ...

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
    def __init__(self, type: _Optional[str] = ..., url: _Optional[str] = ..., filename: _Optional[str] = ..., mime_type: _Optional[str] = ...) -> None: ...

class ProcessMessageRequest(_message.Message):
    __slots__ = ("message_parts", "user_id", "organization_id", "context", "conversation_history", "agent_config", "model", "message_id", "session_id", "user_api_key")
    MESSAGE_PARTS_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    CONVERSATION_HISTORY_FIELD_NUMBER: _ClassVar[int]
    AGENT_CONFIG_FIELD_NUMBER: _ClassVar[int]
    MODEL_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    USER_API_KEY_FIELD_NUMBER: _ClassVar[int]
    message_parts: _containers.RepeatedCompositeFieldContainer[MessagePart]
    user_id: str
    organization_id: int
    context: ChatContext
    conversation_history: _containers.RepeatedCompositeFieldContainer[HistoryMessage]
    agent_config: AgentConfig
    model: str
    message_id: str
    session_id: str
    user_api_key: str
    def __init__(self, message_parts: _Optional[_Iterable[_Union[MessagePart, _Mapping]]] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[int] = ..., context: _Optional[_Union[ChatContext, _Mapping]] = ..., conversation_history: _Optional[_Iterable[_Union[HistoryMessage, _Mapping]]] = ..., agent_config: _Optional[_Union[AgentConfig, _Mapping]] = ..., model: _Optional[str] = ..., message_id: _Optional[str] = ..., session_id: _Optional[str] = ..., user_api_key: _Optional[str] = ...) -> None: ...

class ProcessMessageResponse(_message.Message):
    __slots__ = ("content_chunk", "rag_context", "complete", "error", "step_progress", "timestamp")
    CONTENT_CHUNK_FIELD_NUMBER: _ClassVar[int]
    RAG_CONTEXT_FIELD_NUMBER: _ClassVar[int]
    COMPLETE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    STEP_PROGRESS_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    content_chunk: ContentChunk
    rag_context: RagContext
    complete: ProcessingComplete
    error: ProcessingError
    step_progress: StepProgress
    timestamp: int
    def __init__(self, content_chunk: _Optional[_Union[ContentChunk, _Mapping]] = ..., rag_context: _Optional[_Union[RagContext, _Mapping]] = ..., complete: _Optional[_Union[ProcessingComplete, _Mapping]] = ..., error: _Optional[_Union[ProcessingError, _Mapping]] = ..., step_progress: _Optional[_Union[StepProgress, _Mapping]] = ..., timestamp: _Optional[int] = ...) -> None: ...

class MessagePart(_message.Message):
    __slots__ = ("text", "image_url", "file")
    TEXT_FIELD_NUMBER: _ClassVar[int]
    IMAGE_URL_FIELD_NUMBER: _ClassVar[int]
    FILE_FIELD_NUMBER: _ClassVar[int]
    text: TextPart
    image_url: ImageUrlPart
    file: FilePart
    def __init__(self, text: _Optional[_Union[TextPart, _Mapping]] = ..., image_url: _Optional[_Union[ImageUrlPart, _Mapping]] = ..., file: _Optional[_Union[FilePart, _Mapping]] = ...) -> None: ...

class TextPart(_message.Message):
    __slots__ = ("text",)
    TEXT_FIELD_NUMBER: _ClassVar[int]
    text: str
    def __init__(self, text: _Optional[str] = ...) -> None: ...

class ImageUrlPart(_message.Message):
    __slots__ = ("url",)
    URL_FIELD_NUMBER: _ClassVar[int]
    url: str
    def __init__(self, url: _Optional[str] = ...) -> None: ...

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
    def __init__(self, url: _Optional[str] = ..., mime_type: _Optional[str] = ..., filename: _Optional[str] = ..., size: _Optional[int] = ...) -> None: ...

class HistoryMessage(_message.Message):
    __slots__ = ("role", "content_parts", "timestamp")
    ROLE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_PARTS_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    role: str
    content_parts: _containers.RepeatedCompositeFieldContainer[MessagePart]
    timestamp: int
    def __init__(self, role: _Optional[str] = ..., content_parts: _Optional[_Iterable[_Union[MessagePart, _Mapping]]] = ..., timestamp: _Optional[int] = ...) -> None: ...

class ContentChunk(_message.Message):
    __slots__ = ("content", "sequence")
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    SEQUENCE_FIELD_NUMBER: _ClassVar[int]
    content: str
    sequence: int
    def __init__(self, content: _Optional[str] = ..., sequence: _Optional[int] = ...) -> None: ...

class RagContext(_message.Message):
    __slots__ = ("sources", "context_summary", "total_sources")
    SOURCES_FIELD_NUMBER: _ClassVar[int]
    CONTEXT_SUMMARY_FIELD_NUMBER: _ClassVar[int]
    TOTAL_SOURCES_FIELD_NUMBER: _ClassVar[int]
    sources: _containers.RepeatedCompositeFieldContainer[RagSource]
    context_summary: str
    total_sources: int
    def __init__(self, sources: _Optional[_Iterable[_Union[RagSource, _Mapping]]] = ..., context_summary: _Optional[str] = ..., total_sources: _Optional[int] = ...) -> None: ...

class RagSource(_message.Message):
    __slots__ = ("document_id", "title", "similarity", "domain_type", "excerpt")
    DOCUMENT_ID_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    SIMILARITY_FIELD_NUMBER: _ClassVar[int]
    DOMAIN_TYPE_FIELD_NUMBER: _ClassVar[int]
    EXCERPT_FIELD_NUMBER: _ClassVar[int]
    document_id: str
    title: str
    similarity: float
    domain_type: str
    excerpt: str
    def __init__(self, document_id: _Optional[str] = ..., title: _Optional[str] = ..., similarity: _Optional[float] = ..., domain_type: _Optional[str] = ..., excerpt: _Optional[str] = ...) -> None: ...

class ProcessingComplete(_message.Message):
    __slots__ = ("model_used", "total_tokens", "processing_time_ms", "metadata", "token_usage")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
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
    def __init__(self, model_used: _Optional[str] = ..., total_tokens: _Optional[int] = ..., processing_time_ms: _Optional[int] = ..., metadata: _Optional[_Mapping[str, str]] = ..., token_usage: _Optional[_Union[TokenUsage, _Mapping]] = ...) -> None: ...

class ProcessingError(_message.Message):
    __slots__ = ("error_code", "error_message", "error_details", "hint", "can_retry", "auto_retry", "session_reset")
    class ErrorDetailsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    ERROR_CODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    ERROR_DETAILS_FIELD_NUMBER: _ClassVar[int]
    HINT_FIELD_NUMBER: _ClassVar[int]
    CAN_RETRY_FIELD_NUMBER: _ClassVar[int]
    AUTO_RETRY_FIELD_NUMBER: _ClassVar[int]
    SESSION_RESET_FIELD_NUMBER: _ClassVar[int]
    error_code: str
    error_message: str
    error_details: _containers.ScalarMap[str, str]
    hint: str
    can_retry: bool
    auto_retry: bool
    session_reset: bool
    def __init__(self, error_code: _Optional[str] = ..., error_message: _Optional[str] = ..., error_details: _Optional[_Mapping[str, str]] = ..., hint: _Optional[str] = ..., can_retry: bool = ..., auto_retry: bool = ..., session_reset: bool = ...) -> None: ...

class StepProgress(_message.Message):
    __slots__ = ("step_type", "step_name", "content", "metadata", "step_index")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
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
    def __init__(self, step_type: _Optional[_Union[StepType, str]] = ..., step_name: _Optional[str] = ..., content: _Optional[str] = ..., metadata: _Optional[_Mapping[str, str]] = ..., step_index: _Optional[int] = ...) -> None: ...

class CancelMessageRequest(_message.Message):
    __slots__ = ("message_id", "user_id", "organization_id")
    MESSAGE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    message_id: str
    user_id: str
    organization_id: int
    def __init__(self, message_id: _Optional[str] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[int] = ...) -> None: ...

class CancelMessageResponse(_message.Message):
    __slots__ = ("success", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    def __init__(self, success: bool = ..., message: _Optional[str] = ...) -> None: ...

class ChatContext(_message.Message):
    __slots__ = ("domain_type", "domain_id")
    DOMAIN_TYPE_FIELD_NUMBER: _ClassVar[int]
    DOMAIN_ID_FIELD_NUMBER: _ClassVar[int]
    domain_type: str
    domain_id: int
    def __init__(self, domain_type: _Optional[str] = ..., domain_id: _Optional[int] = ...) -> None: ...
