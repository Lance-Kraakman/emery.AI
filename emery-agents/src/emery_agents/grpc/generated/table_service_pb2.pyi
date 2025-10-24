from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class FieldType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    FIELD_TYPE_UNSPECIFIED: _ClassVar[FieldType]
    FIELD_TYPE_TEXT: _ClassVar[FieldType]
    FIELD_TYPE_NUMBER: _ClassVar[FieldType]
    FIELD_TYPE_BOOLEAN: _ClassVar[FieldType]
    FIELD_TYPE_DATE: _ClassVar[FieldType]
    FIELD_TYPE_FILE: _ClassVar[FieldType]
    FIELD_TYPE_RELATION: _ClassVar[FieldType]
    FIELD_TYPE_DOCUMENT: _ClassVar[FieldType]

class FilterOperator(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    FILTER_OP_UNSPECIFIED: _ClassVar[FilterOperator]
    FILTER_OP_EQ: _ClassVar[FilterOperator]
    FILTER_OP_NE: _ClassVar[FilterOperator]
    FILTER_OP_GT: _ClassVar[FilterOperator]
    FILTER_OP_GTE: _ClassVar[FilterOperator]
    FILTER_OP_LT: _ClassVar[FilterOperator]
    FILTER_OP_LTE: _ClassVar[FilterOperator]
    FILTER_OP_LIKE: _ClassVar[FilterOperator]
    FILTER_OP_ILIKE: _ClassVar[FilterOperator]
    FILTER_OP_IN: _ClassVar[FilterOperator]
    FILTER_OP_NOT_IN: _ClassVar[FilterOperator]
    FILTER_OP_IS_NULL: _ClassVar[FilterOperator]
    FILTER_OP_IS_NOT_NULL: _ClassVar[FilterOperator]
    FILTER_OP_CONTAINS: _ClassVar[FilterOperator]
    FILTER_OP_CONTAINED_BY: _ClassVar[FilterOperator]
    FILTER_OP_HAS_KEY: _ClassVar[FilterOperator]
FIELD_TYPE_UNSPECIFIED: FieldType
FIELD_TYPE_TEXT: FieldType
FIELD_TYPE_NUMBER: FieldType
FIELD_TYPE_BOOLEAN: FieldType
FIELD_TYPE_DATE: FieldType
FIELD_TYPE_FILE: FieldType
FIELD_TYPE_RELATION: FieldType
FIELD_TYPE_DOCUMENT: FieldType
FILTER_OP_UNSPECIFIED: FilterOperator
FILTER_OP_EQ: FilterOperator
FILTER_OP_NE: FilterOperator
FILTER_OP_GT: FilterOperator
FILTER_OP_GTE: FilterOperator
FILTER_OP_LT: FilterOperator
FILTER_OP_LTE: FilterOperator
FILTER_OP_LIKE: FilterOperator
FILTER_OP_ILIKE: FilterOperator
FILTER_OP_IN: FilterOperator
FILTER_OP_NOT_IN: FilterOperator
FILTER_OP_IS_NULL: FilterOperator
FILTER_OP_IS_NOT_NULL: FilterOperator
FILTER_OP_CONTAINS: FilterOperator
FILTER_OP_CONTAINED_BY: FilterOperator
FILTER_OP_HAS_KEY: FilterOperator

class TableField(_message.Message):
    __slots__ = ("name", "type", "required", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    REQUIRED_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: FieldType
    required: bool
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, name: _Optional[str] = ..., type: _Optional[_Union[FieldType, str]] = ..., required: bool = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class TableSchema(_message.Message):
    __slots__ = ("schema_id", "name", "version", "fields", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    SCHEMA_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    FIELDS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    schema_id: str
    name: str
    version: str
    fields: _containers.RepeatedCompositeFieldContainer[TableField]
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, schema_id: _Optional[str] = ..., name: _Optional[str] = ..., version: _Optional[str] = ..., fields: _Optional[_Iterable[_Union[TableField, _Mapping]]] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class Table(_message.Message):
    __slots__ = ("table_id", "name", "schema", "description", "created_by", "updated_by", "created_at_ms", "updated_at_ms", "organization_id", "metadata", "is_deleted", "s3_path")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    SCHEMA_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    CREATED_BY_FIELD_NUMBER: _ClassVar[int]
    UPDATED_BY_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_MS_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_MS_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    IS_DELETED_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    name: str
    schema: TableSchema
    description: str
    created_by: str
    updated_by: str
    created_at_ms: int
    updated_at_ms: int
    organization_id: str
    metadata: _containers.ScalarMap[str, str]
    is_deleted: bool
    s3_path: str
    def __init__(self, table_id: _Optional[str] = ..., name: _Optional[str] = ..., schema: _Optional[_Union[TableSchema, _Mapping]] = ..., description: _Optional[str] = ..., created_by: _Optional[str] = ..., updated_by: _Optional[str] = ..., created_at_ms: _Optional[int] = ..., updated_at_ms: _Optional[int] = ..., organization_id: _Optional[str] = ..., metadata: _Optional[_Mapping[str, str]] = ..., is_deleted: bool = ..., s3_path: _Optional[str] = ...) -> None: ...

class Row(_message.Message):
    __slots__ = ("row_id", "table_id", "row_data", "created_by", "updated_by", "created_at_ms", "updated_at_ms", "organization_id", "is_deleted")
    ROW_ID_FIELD_NUMBER: _ClassVar[int]
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    ROW_DATA_FIELD_NUMBER: _ClassVar[int]
    CREATED_BY_FIELD_NUMBER: _ClassVar[int]
    UPDATED_BY_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_MS_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_MS_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    IS_DELETED_FIELD_NUMBER: _ClassVar[int]
    row_id: str
    table_id: str
    row_data: RowData
    created_by: str
    updated_by: str
    created_at_ms: int
    updated_at_ms: int
    organization_id: str
    is_deleted: bool
    def __init__(self, row_id: _Optional[str] = ..., table_id: _Optional[str] = ..., row_data: _Optional[_Union[RowData, _Mapping]] = ..., created_by: _Optional[str] = ..., updated_by: _Optional[str] = ..., created_at_ms: _Optional[int] = ..., updated_at_ms: _Optional[int] = ..., organization_id: _Optional[str] = ..., is_deleted: bool = ...) -> None: ...

class CreateTableRequest(_message.Message):
    __slots__ = ("name", "schema", "description", "user_id", "organization_id", "metadata", "s3_path")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    NAME_FIELD_NUMBER: _ClassVar[int]
    SCHEMA_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    name: str
    schema: TableSchema
    description: str
    user_id: str
    organization_id: str
    metadata: _containers.ScalarMap[str, str]
    s3_path: str
    def __init__(self, name: _Optional[str] = ..., schema: _Optional[_Union[TableSchema, _Mapping]] = ..., description: _Optional[str] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ..., metadata: _Optional[_Mapping[str, str]] = ..., s3_path: _Optional[str] = ...) -> None: ...

class GetTableRequest(_message.Message):
    __slots__ = ("table_id", "user_id", "organization_id")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    user_id: str
    organization_id: str
    def __init__(self, table_id: _Optional[str] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ...) -> None: ...

class UpdateTableRequest(_message.Message):
    __slots__ = ("table_id", "name", "schema", "description", "user_id", "organization_id", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    SCHEMA_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    name: str
    schema: TableSchema
    description: str
    user_id: str
    organization_id: str
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, table_id: _Optional[str] = ..., name: _Optional[str] = ..., schema: _Optional[_Union[TableSchema, _Mapping]] = ..., description: _Optional[str] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class DeleteTableRequest(_message.Message):
    __slots__ = ("table_id", "user_id", "organization_id", "soft_delete")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    SOFT_DELETE_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    user_id: str
    organization_id: str
    soft_delete: bool
    def __init__(self, table_id: _Optional[str] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ..., soft_delete: bool = ...) -> None: ...

class ListTablesRequest(_message.Message):
    __slots__ = ("user_id", "organization_id", "limit", "offset", "search_term")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    SEARCH_TERM_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    organization_id: str
    limit: int
    offset: int
    search_term: str
    def __init__(self, user_id: _Optional[str] = ..., organization_id: _Optional[str] = ..., limit: _Optional[int] = ..., offset: _Optional[int] = ..., search_term: _Optional[str] = ...) -> None: ...

class CreateRowsRequest(_message.Message):
    __slots__ = ("table_id", "rows_data", "user_id", "organization_id", "s3_path", "mode")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    ROWS_DATA_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    rows_data: _containers.RepeatedCompositeFieldContainer[RowData]
    user_id: str
    organization_id: str
    s3_path: str
    mode: str
    def __init__(self, table_id: _Optional[str] = ..., rows_data: _Optional[_Iterable[_Union[RowData, _Mapping]]] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ..., s3_path: _Optional[str] = ..., mode: _Optional[str] = ...) -> None: ...

class GetRowsRequest(_message.Message):
    __slots__ = ("table_id", "row_ids", "user_id", "organization_id")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    ROW_IDS_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    row_ids: _containers.RepeatedScalarFieldContainer[str]
    user_id: str
    organization_id: str
    def __init__(self, table_id: _Optional[str] = ..., row_ids: _Optional[_Iterable[str]] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ...) -> None: ...

class UpdateRowsRequest(_message.Message):
    __slots__ = ("table_id", "rows_data", "user_id", "organization_id", "s3_path")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    ROWS_DATA_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    rows_data: _containers.RepeatedCompositeFieldContainer[RowData]
    user_id: str
    organization_id: str
    s3_path: str
    def __init__(self, table_id: _Optional[str] = ..., rows_data: _Optional[_Iterable[_Union[RowData, _Mapping]]] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ..., s3_path: _Optional[str] = ...) -> None: ...

class DeleteRowsRequest(_message.Message):
    __slots__ = ("table_id", "row_ids", "user_id", "organization_id", "s3_path")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    ROW_IDS_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    row_ids: _containers.RepeatedScalarFieldContainer[str]
    user_id: str
    organization_id: str
    s3_path: str
    def __init__(self, table_id: _Optional[str] = ..., row_ids: _Optional[_Iterable[str]] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ..., s3_path: _Optional[str] = ...) -> None: ...

class RowFilter(_message.Message):
    __slots__ = ("field", "operator", "value", "values")
    FIELD_FIELD_NUMBER: _ClassVar[int]
    OPERATOR_FIELD_NUMBER: _ClassVar[int]
    VALUE_FIELD_NUMBER: _ClassVar[int]
    VALUES_FIELD_NUMBER: _ClassVar[int]
    field: str
    operator: FilterOperator
    value: RowDataValue
    values: _containers.RepeatedCompositeFieldContainer[RowDataValue]
    def __init__(self, field: _Optional[str] = ..., operator: _Optional[_Union[FilterOperator, str]] = ..., value: _Optional[_Union[RowDataValue, _Mapping]] = ..., values: _Optional[_Iterable[_Union[RowDataValue, _Mapping]]] = ...) -> None: ...

class QueryRowsRequest(_message.Message):
    __slots__ = ("table_id", "s3_path", "filters", "order_by", "order_direction", "limit", "offset", "user_id", "organization_id")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    FILTERS_FIELD_NUMBER: _ClassVar[int]
    ORDER_BY_FIELD_NUMBER: _ClassVar[int]
    ORDER_DIRECTION_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    s3_path: str
    filters: _containers.RepeatedCompositeFieldContainer[RowFilter]
    order_by: str
    order_direction: str
    limit: int
    offset: int
    user_id: str
    organization_id: str
    def __init__(self, table_id: _Optional[str] = ..., s3_path: _Optional[str] = ..., filters: _Optional[_Iterable[_Union[RowFilter, _Mapping]]] = ..., order_by: _Optional[str] = ..., order_direction: _Optional[str] = ..., limit: _Optional[int] = ..., offset: _Optional[int] = ..., user_id: _Optional[str] = ..., organization_id: _Optional[str] = ...) -> None: ...

class TableResponse(_message.Message):
    __slots__ = ("success", "table", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    TABLE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    table: Table
    message: str
    def __init__(self, success: bool = ..., table: _Optional[_Union[Table, _Mapping]] = ..., message: _Optional[str] = ...) -> None: ...

class DeleteTableResponse(_message.Message):
    __slots__ = ("success", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    def __init__(self, success: bool = ..., message: _Optional[str] = ...) -> None: ...

class ListTablesResponse(_message.Message):
    __slots__ = ("success", "tables", "total_count", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    TABLES_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    tables: _containers.RepeatedCompositeFieldContainer[Table]
    total_count: int
    message: str
    def __init__(self, success: bool = ..., tables: _Optional[_Iterable[_Union[Table, _Mapping]]] = ..., total_count: _Optional[int] = ..., message: _Optional[str] = ...) -> None: ...

class CreateRowsResponse(_message.Message):
    __slots__ = ("success", "rows", "rows_created", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ROWS_FIELD_NUMBER: _ClassVar[int]
    ROWS_CREATED_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    rows: _containers.RepeatedCompositeFieldContainer[Row]
    rows_created: int
    message: str
    def __init__(self, success: bool = ..., rows: _Optional[_Iterable[_Union[Row, _Mapping]]] = ..., rows_created: _Optional[int] = ..., message: _Optional[str] = ...) -> None: ...

class GetRowsResponse(_message.Message):
    __slots__ = ("success", "rows", "total_count", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ROWS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    rows: _containers.RepeatedCompositeFieldContainer[Row]
    total_count: int
    message: str
    def __init__(self, success: bool = ..., rows: _Optional[_Iterable[_Union[Row, _Mapping]]] = ..., total_count: _Optional[int] = ..., message: _Optional[str] = ...) -> None: ...

class UpdateRowsResponse(_message.Message):
    __slots__ = ("success", "rows", "rows_updated", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ROWS_FIELD_NUMBER: _ClassVar[int]
    ROWS_UPDATED_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    rows: _containers.RepeatedCompositeFieldContainer[Row]
    rows_updated: int
    message: str
    def __init__(self, success: bool = ..., rows: _Optional[_Iterable[_Union[Row, _Mapping]]] = ..., rows_updated: _Optional[int] = ..., message: _Optional[str] = ...) -> None: ...

class DeleteRowsResponse(_message.Message):
    __slots__ = ("success", "rows_deleted", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ROWS_DELETED_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    rows_deleted: int
    message: str
    def __init__(self, success: bool = ..., rows_deleted: _Optional[int] = ..., message: _Optional[str] = ...) -> None: ...

class QueryRowsResponse(_message.Message):
    __slots__ = ("success", "arrow_ipc_stream", "total_count", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ARROW_IPC_STREAM_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    arrow_ipc_stream: bytes
    total_count: int
    message: str
    def __init__(self, success: bool = ..., arrow_ipc_stream: _Optional[bytes] = ..., total_count: _Optional[int] = ..., message: _Optional[str] = ...) -> None: ...

class RowDataValue(_message.Message):
    __slots__ = ("text_value", "number_value", "boolean_value", "date_value", "json_value")
    TEXT_VALUE_FIELD_NUMBER: _ClassVar[int]
    NUMBER_VALUE_FIELD_NUMBER: _ClassVar[int]
    BOOLEAN_VALUE_FIELD_NUMBER: _ClassVar[int]
    DATE_VALUE_FIELD_NUMBER: _ClassVar[int]
    JSON_VALUE_FIELD_NUMBER: _ClassVar[int]
    text_value: str
    number_value: float
    boolean_value: bool
    date_value: int
    json_value: str
    def __init__(self, text_value: _Optional[str] = ..., number_value: _Optional[float] = ..., boolean_value: bool = ..., date_value: _Optional[int] = ..., json_value: _Optional[str] = ...) -> None: ...

class RowData(_message.Message):
    __slots__ = ("id", "data")
    class DataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: RowDataValue
        def __init__(self, key: _Optional[str] = ..., value: _Optional[_Union[RowDataValue, _Mapping]] = ...) -> None: ...
    ID_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    id: str
    data: _containers.MessageMap[str, RowDataValue]
    def __init__(self, id: _Optional[str] = ..., data: _Optional[_Mapping[str, RowDataValue]] = ...) -> None: ...

class GetTableStatsRequest(_message.Message):
    __slots__ = ("table_id", "s3_path", "organization_id")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    s3_path: str
    organization_id: str
    def __init__(self, table_id: _Optional[str] = ..., s3_path: _Optional[str] = ..., organization_id: _Optional[str] = ...) -> None: ...

class GetTableStatsResponse(_message.Message):
    __slots__ = ("success", "row_count", "size_bytes", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ROW_COUNT_FIELD_NUMBER: _ClassVar[int]
    SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    row_count: int
    size_bytes: int
    message: str
    def __init__(self, success: bool = ..., row_count: _Optional[int] = ..., size_bytes: _Optional[int] = ..., message: _Optional[str] = ...) -> None: ...
