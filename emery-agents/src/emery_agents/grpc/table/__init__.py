"""
Table Package

Data-centric library for table schema management, transformations, and validation.
"""

from .field_utils import (
    field_id_to_column_name,
    field_to_column_name,
)
from .field_validation import (
    get_field_operation_description,
    get_type_change_error_message,
    is_metadata_only_change,
    validate_field_type_change,
)
from .operations import (
    apply_aggregations,
    apply_field_additions,
    apply_field_updates,
    apply_filters_in_memory,
    apply_like_ilike_filters,
    prepare_create_rows,
    prepare_query_rows,
    prepare_table_stats,
    prepare_update_rows,
    write_with_schema_evolution,
)
from .schema import (
    arrow_to_polars_type,
    build_schema_from_table_fields,
    convert_protobuf_field_to_arrow,
    create_dataframe_with_schema,
    create_enhanced_schema,
    evolve_schema,
    get_delta_schema_as_pyarrow,
    migrate_column_type,
    validate_schema_compatibility,
)
from .transform import (
    build_pyarrow_predicate,
    convert_dataframe_to_arrow,
    convert_protobuf_to_dataframe,
    create_empty_arrow_table,
    normalize_arrow_table_to_large_string,
)
from .type_conversion import (
    cast_value_to_column_type,
)
from .validate import (
    detect_data_anomalies,
    validate_field_mappings,
    validate_row_data,
    validate_s3_path,
    validate_sort_columns,
)

__all__ = [
    # Field utilities
    "field_id_to_column_name",
    "field_to_column_name",
    # Schema functions
    "convert_protobuf_field_to_arrow",
    "arrow_to_polars_type",
    "build_schema_from_table_fields",
    "get_delta_schema_as_pyarrow",
    "create_enhanced_schema",
    "evolve_schema",
    "validate_schema_compatibility",
    "migrate_column_type",
    "create_dataframe_with_schema",
    # Transform functions
    "normalize_arrow_table_to_large_string",
    "cast_value_to_column_type",
    "build_pyarrow_predicate",
    "convert_protobuf_to_dataframe",
    "convert_dataframe_to_arrow",
    "create_empty_arrow_table",
    # Field validation functions
    "validate_field_type_change",
    "is_metadata_only_change",
    "get_type_change_error_message",
    "get_field_operation_description",
    # Validate functions
    "validate_s3_path",
    "validate_field_mappings",
    "validate_row_data",
    "validate_sort_columns",
    "detect_data_anomalies",
    # Operations functions
    "prepare_create_rows",
    "prepare_update_rows",
    "prepare_query_rows",
    "apply_field_additions",
    "apply_field_updates",
    "apply_filters_in_memory",
    "apply_like_ilike_filters",
    "apply_aggregations",
    "write_with_schema_evolution",
    "prepare_table_stats",
]
