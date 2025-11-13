"""
Table Package

Data-centric library for table schema management, transformations, and validation.
"""

from .field_utils import (
    field_id_to_column_name,
    field_to_column_name,
)

from .schema import (
    convert_protobuf_field_to_arrow,
    arrow_to_polars_type,
    build_schema_from_table_fields,
    get_delta_schema_as_pyarrow,
    create_enhanced_schema,
    evolve_schema,
    validate_schema_compatibility,
    migrate_column_type,
    create_dataframe_with_schema,
)

from .type_conversion import (
    cast_value_to_column_type,
)

from .transform import (
    normalize_arrow_table_to_large_string,
    build_pyarrow_predicate,
    convert_protobuf_to_dataframe,
    convert_dataframe_to_arrow,
    create_empty_arrow_table,
)

from .validate import (
    validate_s3_path,
    validate_field_mappings,
    validate_row_data,
    validate_sort_columns,
    detect_data_anomalies,
)

from .operations import (
    prepare_create_rows,
    prepare_update_rows,
    prepare_query_rows,
    apply_field_additions,
    apply_field_updates,
    apply_filters_in_memory,
    apply_like_ilike_filters,
    apply_aggregations,
    write_with_schema_evolution,
    prepare_table_stats,
)

__all__ = [
    # Field utilities
    'field_id_to_column_name',
    'field_to_column_name',
    
    # Schema functions
    'convert_protobuf_field_to_arrow',
    'arrow_to_polars_type',
    'build_schema_from_table_fields',
    'get_delta_schema_as_pyarrow',
    'create_enhanced_schema',
    'evolve_schema',
    'validate_schema_compatibility',
    'migrate_column_type',
    'create_dataframe_with_schema',
    
    # Transform functions
    'normalize_arrow_table_to_large_string',
    'cast_value_to_column_type',
    'build_pyarrow_predicate',
    'convert_protobuf_to_dataframe',
    'convert_dataframe_to_arrow',
    'create_empty_arrow_table',
    
    # Validate functions
    'validate_s3_path',
    'validate_field_mappings',
    'validate_row_data',
    'validate_sort_columns',
    'detect_data_anomalies',
    
    # Operations functions
    'prepare_create_rows',
    'prepare_update_rows',
    'prepare_query_rows',
    'apply_field_additions',
    'apply_field_updates',
    'apply_filters_in_memory',
    'apply_like_ilike_filters',
    'apply_aggregations',
    'write_with_schema_evolution',
    'prepare_table_stats',
]