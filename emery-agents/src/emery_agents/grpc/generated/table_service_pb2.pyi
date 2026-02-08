from collections.abc import Iterable as _Iterable
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar

from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper

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
    FIELD_TYPE_EMBEDDING: _ClassVar[FieldType]
    FIELD_TYPE_SINGLE_SELECT: _ClassVar[FieldType]
    FIELD_TYPE_MULTI_SELECT: _ClassVar[FieldType]
    FIELD_TYPE_AUTONUMBER: _ClassVar[FieldType]
    FIELD_TYPE_LAST_UPDATED: _ClassVar[FieldType]
    FIELD_TYPE_CREATED_AT: _ClassVar[FieldType]
    FIELD_TYPE_EMAIL: _ClassVar[FieldType]
    FIELD_TYPE_PHONE: _ClassVar[FieldType]
    FIELD_TYPE_JSON: _ClassVar[FieldType]

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

class AggregationType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    AGG_TYPE_UNSPECIFIED: _ClassVar[AggregationType]
    AGG_TYPE_SUM: _ClassVar[AggregationType]
    AGG_TYPE_AVG: _ClassVar[AggregationType]
    AGG_TYPE_COUNT: _ClassVar[AggregationType]
    AGG_TYPE_MIN: _ClassVar[AggregationType]
    AGG_TYPE_MAX: _ClassVar[AggregationType]
    AGG_TYPE_COUNT_DISTINCT: _ClassVar[AggregationType]
    AGG_TYPE_COUNT_EMPTY: _ClassVar[AggregationType]
    AGG_TYPE_COUNT_NOT_EMPTY: _ClassVar[AggregationType]

FIELD_TYPE_UNSPECIFIED: FieldType
FIELD_TYPE_TEXT: FieldType
FIELD_TYPE_NUMBER: FieldType
FIELD_TYPE_BOOLEAN: FieldType
FIELD_TYPE_DATE: FieldType
FIELD_TYPE_FILE: FieldType
FIELD_TYPE_RELATION: FieldType
FIELD_TYPE_DOCUMENT: FieldType
FIELD_TYPE_EMBEDDING: FieldType
FIELD_TYPE_SINGLE_SELECT: FieldType
FIELD_TYPE_MULTI_SELECT: FieldType
FIELD_TYPE_AUTONUMBER: FieldType
FIELD_TYPE_LAST_UPDATED: FieldType
FIELD_TYPE_CREATED_AT: FieldType
FIELD_TYPE_EMAIL: FieldType
FIELD_TYPE_PHONE: FieldType
FIELD_TYPE_JSON: FieldType
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
AGG_TYPE_UNSPECIFIED: AggregationType
AGG_TYPE_SUM: AggregationType
AGG_TYPE_AVG: AggregationType
AGG_TYPE_COUNT: AggregationType
AGG_TYPE_MIN: AggregationType
AGG_TYPE_MAX: AggregationType
AGG_TYPE_COUNT_DISTINCT: AggregationType
AGG_TYPE_COUNT_EMPTY: AggregationType
AGG_TYPE_COUNT_NOT_EMPTY: AggregationType

class TableField(_message.Message):
    __slots__ = ("name", "type", "required", "metadata", "field_id")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    REQUIRED_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    FIELD_ID_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: FieldType
    required: bool
    metadata: _containers.ScalarMap[str, str]
    field_id: int
    def __init__(
        self,
        name: str | None = ...,
        type: FieldType | str | None = ...,
        required: bool = ...,
        metadata: _Mapping[str, str] | None = ...,
        field_id: int | None = ...,
    ) -> None: ...

class TableSchema(_message.Message):
    __slots__ = ("schema_id", "name", "version", "fields", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

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
    def __init__(
        self,
        schema_id: str | None = ...,
        name: str | None = ...,
        version: str | None = ...,
        fields: _Iterable[TableField | _Mapping] | None = ...,
        metadata: _Mapping[str, str] | None = ...,
    ) -> None: ...

class Table(_message.Message):
    __slots__ = (
        "table_id",
        "name",
        "schema",
        "description",
        "created_by",
        "updated_by",
        "created_at_ms",
        "updated_at_ms",
        "organization_id",
        "metadata",
        "is_deleted",
        "s3_path",
    )
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

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
    def __init__(
        self,
        table_id: str | None = ...,
        name: str | None = ...,
        schema: TableSchema | _Mapping | None = ...,
        description: str | None = ...,
        created_by: str | None = ...,
        updated_by: str | None = ...,
        created_at_ms: int | None = ...,
        updated_at_ms: int | None = ...,
        organization_id: str | None = ...,
        metadata: _Mapping[str, str] | None = ...,
        is_deleted: bool = ...,
        s3_path: str | None = ...,
    ) -> None: ...

class Row(_message.Message):
    __slots__ = (
        "row_id",
        "table_id",
        "row_data",
        "created_by",
        "updated_by",
        "created_at_ms",
        "updated_at_ms",
        "organization_id",
        "is_deleted",
    )
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
    def __init__(
        self,
        row_id: str | None = ...,
        table_id: str | None = ...,
        row_data: RowData | _Mapping | None = ...,
        created_by: str | None = ...,
        updated_by: str | None = ...,
        created_at_ms: int | None = ...,
        updated_at_ms: int | None = ...,
        organization_id: str | None = ...,
        is_deleted: bool = ...,
    ) -> None: ...

class CreateTableRequest(_message.Message):
    __slots__ = (
        "name",
        "schema",
        "description",
        "user_id",
        "organization_id",
        "metadata",
        "s3_path",
    )
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

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
    def __init__(
        self,
        name: str | None = ...,
        schema: TableSchema | _Mapping | None = ...,
        description: str | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        metadata: _Mapping[str, str] | None = ...,
        s3_path: str | None = ...,
    ) -> None: ...

class GetTableRequest(_message.Message):
    __slots__ = ("table_id", "user_id", "organization_id")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    user_id: str
    organization_id: str
    def __init__(
        self,
        table_id: str | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
    ) -> None: ...

class UpdateTableRequest(_message.Message):
    __slots__ = (
        "table_id",
        "name",
        "schema",
        "description",
        "user_id",
        "organization_id",
        "metadata",
        "s3_path",
    )
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: str | None = ..., value: str | None = ...) -> None: ...

    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    SCHEMA_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    name: str
    schema: TableSchema
    description: str
    user_id: str
    organization_id: str
    metadata: _containers.ScalarMap[str, str]
    s3_path: str
    def __init__(
        self,
        table_id: str | None = ...,
        name: str | None = ...,
        schema: TableSchema | _Mapping | None = ...,
        description: str | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        metadata: _Mapping[str, str] | None = ...,
        s3_path: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        table_id: str | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        soft_delete: bool = ...,
    ) -> None: ...

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
    def __init__(
        self,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        limit: int | None = ...,
        offset: int | None = ...,
        search_term: str | None = ...,
    ) -> None: ...

class CreateRowsRequest(_message.Message):
    __slots__ = (
        "table_id",
        "rows_data",
        "user_id",
        "organization_id",
        "s3_path",
        "mode",
    )
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
    def __init__(
        self,
        table_id: str | None = ...,
        rows_data: _Iterable[RowData | _Mapping] | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        s3_path: str | None = ...,
        mode: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        table_id: str | None = ...,
        row_ids: _Iterable[str] | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        table_id: str | None = ...,
        rows_data: _Iterable[RowData | _Mapping] | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        s3_path: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        table_id: str | None = ...,
        row_ids: _Iterable[str] | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        s3_path: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        field: str | None = ...,
        operator: FilterOperator | str | None = ...,
        value: RowDataValue | _Mapping | None = ...,
        values: _Iterable[RowDataValue | _Mapping] | None = ...,
    ) -> None: ...

class AggregationFunction(_message.Message):
    __slots__ = ("field_id", "type", "alias", "format_type")
    FIELD_ID_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    ALIAS_FIELD_NUMBER: _ClassVar[int]
    FORMAT_TYPE_FIELD_NUMBER: _ClassVar[int]
    field_id: str
    type: AggregationType
    alias: str
    format_type: str
    def __init__(
        self,
        field_id: str | None = ...,
        type: AggregationType | str | None = ...,
        alias: str | None = ...,
        format_type: str | None = ...,
    ) -> None: ...

class AggregationConfig(_message.Message):
    __slots__ = ("group_by_fields", "aggregations")
    GROUP_BY_FIELDS_FIELD_NUMBER: _ClassVar[int]
    AGGREGATIONS_FIELD_NUMBER: _ClassVar[int]
    group_by_fields: _containers.RepeatedScalarFieldContainer[str]
    aggregations: _containers.RepeatedCompositeFieldContainer[AggregationFunction]
    def __init__(
        self,
        group_by_fields: _Iterable[str] | None = ...,
        aggregations: _Iterable[AggregationFunction | _Mapping] | None = ...,
    ) -> None: ...

class QueryRowsRequest(_message.Message):
    __slots__ = (
        "table_id",
        "s3_path",
        "filters",
        "order_by",
        "order_direction",
        "limit",
        "offset",
        "user_id",
        "organization_id",
        "aggregation",
    )
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    FILTERS_FIELD_NUMBER: _ClassVar[int]
    ORDER_BY_FIELD_NUMBER: _ClassVar[int]
    ORDER_DIRECTION_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    AGGREGATION_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    s3_path: str
    filters: _containers.RepeatedCompositeFieldContainer[RowFilter]
    order_by: str
    order_direction: str
    limit: int
    offset: int
    user_id: str
    organization_id: str
    aggregation: AggregationConfig
    def __init__(
        self,
        table_id: str | None = ...,
        s3_path: str | None = ...,
        filters: _Iterable[RowFilter | _Mapping] | None = ...,
        order_by: str | None = ...,
        order_direction: str | None = ...,
        limit: int | None = ...,
        offset: int | None = ...,
        user_id: str | None = ...,
        organization_id: str | None = ...,
        aggregation: AggregationConfig | _Mapping | None = ...,
    ) -> None: ...

class TableResponse(_message.Message):
    __slots__ = ("success", "table", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    TABLE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    table: Table
    message: str
    def __init__(
        self,
        success: bool = ...,
        table: Table | _Mapping | None = ...,
        message: str | None = ...,
    ) -> None: ...

class DeleteTableResponse(_message.Message):
    __slots__ = ("success", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    def __init__(self, success: bool = ..., message: str | None = ...) -> None: ...

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
    def __init__(
        self,
        success: bool = ...,
        tables: _Iterable[Table | _Mapping] | None = ...,
        total_count: int | None = ...,
        message: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        success: bool = ...,
        rows: _Iterable[Row | _Mapping] | None = ...,
        rows_created: int | None = ...,
        message: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        success: bool = ...,
        rows: _Iterable[Row | _Mapping] | None = ...,
        total_count: int | None = ...,
        message: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        success: bool = ...,
        rows: _Iterable[Row | _Mapping] | None = ...,
        rows_updated: int | None = ...,
        message: str | None = ...,
    ) -> None: ...

class DeleteRowsResponse(_message.Message):
    __slots__ = ("success", "rows_deleted", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ROWS_DELETED_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    rows_deleted: int
    message: str
    def __init__(
        self,
        success: bool = ...,
        rows_deleted: int | None = ...,
        message: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        success: bool = ...,
        arrow_ipc_stream: bytes | None = ...,
        total_count: int | None = ...,
        message: str | None = ...,
    ) -> None: ...

class FloatArray(_message.Message):
    __slots__ = ("values",)
    VALUES_FIELD_NUMBER: _ClassVar[int]
    values: _containers.RepeatedScalarFieldContainer[float]
    def __init__(self, values: _Iterable[float] | None = ...) -> None: ...

class RowDataValue(_message.Message):
    __slots__ = (
        "text_value",
        "number_value",
        "boolean_value",
        "date_value",
        "json_value",
        "embedding_value",
    )
    TEXT_VALUE_FIELD_NUMBER: _ClassVar[int]
    NUMBER_VALUE_FIELD_NUMBER: _ClassVar[int]
    BOOLEAN_VALUE_FIELD_NUMBER: _ClassVar[int]
    DATE_VALUE_FIELD_NUMBER: _ClassVar[int]
    JSON_VALUE_FIELD_NUMBER: _ClassVar[int]
    EMBEDDING_VALUE_FIELD_NUMBER: _ClassVar[int]
    text_value: str
    number_value: float
    boolean_value: bool
    date_value: int
    json_value: str
    embedding_value: FloatArray
    def __init__(
        self,
        text_value: str | None = ...,
        number_value: float | None = ...,
        boolean_value: bool = ...,
        date_value: int | None = ...,
        json_value: str | None = ...,
        embedding_value: FloatArray | _Mapping | None = ...,
    ) -> None: ...

class RowData(_message.Message):
    __slots__ = ("id", "data")
    class DataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: RowDataValue
        def __init__(
            self, key: str | None = ..., value: RowDataValue | _Mapping | None = ...
        ) -> None: ...

    ID_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    id: str
    data: _containers.MessageMap[str, RowDataValue]
    def __init__(
        self, id: str | None = ..., data: _Mapping[str, RowDataValue] | None = ...
    ) -> None: ...

class GetTableStatsRequest(_message.Message):
    __slots__ = ("table_id", "s3_path", "organization_id")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    s3_path: str
    organization_id: str
    def __init__(
        self,
        table_id: str | None = ...,
        s3_path: str | None = ...,
        organization_id: str | None = ...,
    ) -> None: ...

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
    def __init__(
        self,
        success: bool = ...,
        row_count: int | None = ...,
        size_bytes: int | None = ...,
        message: str | None = ...,
    ) -> None: ...

class AddFieldRequest(_message.Message):
    __slots__ = ("table_id", "field", "organization_id", "s3_path")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    FIELD_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    field: TableField
    organization_id: str
    s3_path: str
    def __init__(
        self,
        table_id: str | None = ...,
        field: TableField | _Mapping | None = ...,
        organization_id: str | None = ...,
        s3_path: str | None = ...,
    ) -> None: ...

class UpdateFieldRequest(_message.Message):
    __slots__ = (
        "table_id",
        "field_id",
        "updated_field",
        "organization_id",
        "s3_path",
        "migrate_data",
    )
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    FIELD_ID_FIELD_NUMBER: _ClassVar[int]
    UPDATED_FIELD_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    MIGRATE_DATA_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    field_id: int
    updated_field: TableField
    organization_id: str
    s3_path: str
    migrate_data: bool
    def __init__(
        self,
        table_id: str | None = ...,
        field_id: int | None = ...,
        updated_field: TableField | _Mapping | None = ...,
        organization_id: str | None = ...,
        s3_path: str | None = ...,
        migrate_data: bool = ...,
    ) -> None: ...

class DeleteFieldRequest(_message.Message):
    __slots__ = ("table_id", "field_id", "organization_id", "s3_path", "backup_data")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    FIELD_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    S3_PATH_FIELD_NUMBER: _ClassVar[int]
    BACKUP_DATA_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    field_id: int
    organization_id: str
    s3_path: str
    backup_data: bool
    def __init__(
        self,
        table_id: str | None = ...,
        field_id: int | None = ...,
        organization_id: str | None = ...,
        s3_path: str | None = ...,
        backup_data: bool = ...,
    ) -> None: ...

class GetFieldsRequest(_message.Message):
    __slots__ = ("table_id", "organization_id")
    TABLE_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANIZATION_ID_FIELD_NUMBER: _ClassVar[int]
    table_id: str
    organization_id: str
    def __init__(
        self, table_id: str | None = ..., organization_id: str | None = ...
    ) -> None: ...

class FieldResponse(_message.Message):
    __slots__ = ("success", "field", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    FIELD_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    field: TableField
    message: str
    def __init__(
        self,
        success: bool = ...,
        field: TableField | _Mapping | None = ...,
        message: str | None = ...,
    ) -> None: ...

class DeleteFieldResponse(_message.Message):
    __slots__ = ("success", "message", "backup_location")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    BACKUP_LOCATION_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    backup_location: str
    def __init__(
        self,
        success: bool = ...,
        message: str | None = ...,
        backup_location: str | None = ...,
    ) -> None: ...

class GetFieldsResponse(_message.Message):
    __slots__ = ("success", "fields", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    FIELDS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    fields: _containers.RepeatedCompositeFieldContainer[TableField]
    message: str
    def __init__(
        self,
        success: bool = ...,
        fields: _Iterable[TableField | _Mapping] | None = ...,
        message: str | None = ...,
    ) -> None: ...
