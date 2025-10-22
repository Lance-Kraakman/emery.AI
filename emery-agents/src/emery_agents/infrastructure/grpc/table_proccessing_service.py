"""
Delta Lake Table Service

This service handles all table and row operations using Delta Lake for storage.
It provides high-performance, ACID-compliant operations on data stored in S3.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

import polars as pl
import pyarrow as pa
from deltalake import write_deltalake, DeltaTable
from google.protobuf.json_format import Parse, MessageToJson
from google.protobuf.struct_pb2 import ListValue
from ...grpc.generated import table_service_pb2, table_service_pb2_grpc

logger = logging.getLogger(__name__)

class TableService(table_service_pb2_grpc.TableServiceServicer):
    """
    Delta Lake Table Service implementation.
    
    This service manages tables and rows using Delta Lake format stored in S3.
    It provides efficient append-only writes and ACID transaction support.
    """
    
    def _build_schema_from_table_fields(self, table_fields: List[table_service_pb2.TableField]) -> pa.Schema:
        """Convert protobuf TableField messages to PyArrow schema for Delta Lake."""
        try:
            # Map protobuf field types to PyArrow types
            type_mapping = {
                table_service_pb2.FIELD_TYPE_TEXT: pa.string(),
                table_service_pb2.FIELD_TYPE_NUMBER: pa.float64(),
                table_service_pb2.FIELD_TYPE_BOOLEAN: pa.bool_(),
                table_service_pb2.FIELD_TYPE_DATE: pa.timestamp('us'),
                table_service_pb2.FIELD_TYPE_FILE: pa.string(),    # Store as JSON
                table_service_pb2.FIELD_TYPE_RELATION: pa.string(), # Store as JSON
                table_service_pb2.FIELD_TYPE_DOCUMENT: pa.string(), # Store as JSON
            }
            
            arrow_fields = []
            for field in table_fields:
                dtype = type_mapping.get(field.type, pa.string())
                arrow_fields.append(pa.field(field.name, dtype, nullable=not field.required))
            
            return pa.Schema(arrow_fields)
        except Exception as e:
            logger.error(f"Error building schema from table fields: {e}")
            raise ValueError(f"Invalid table fields: {e}")

    def _row_data_to_dataframe(self, rows_data: List[table_service_pb2.RowData], schema: pa.Schema) -> pl.DataFrame:
        """Convert protobuf RowData messages to Polars DataFrame."""
        try:
            data = []
            for row_data in rows_data:
                record = {'id': row_data.id}
                
                # Convert protobuf RowDataValue to Python types
                for key, value in row_data.data.items():
                    if value.HasField('text_value'):
                        record[key] = value.text_value
                    elif value.HasField('number_value'):
                        record[key] = value.number_value
                    elif value.HasField('boolean_value'):
                        record[key] = value.boolean_value
                    elif value.HasField('date_value'):
                        record[key] = value.date_value
                    elif value.HasField('json_value'):
                        record[key] = value.json_value
                    else:
                        record[key] = None  # Default for unset values
                
                data.append(record)
            
            return pl.DataFrame(data, schema=schema)
        except Exception as e:
            logger.error(f"Error converting row data to DataFrame: {e}")
            raise ValueError(f"Invalid row data: {e}")

    def _json_to_row_data(self, row_json: str) -> Dict[str, Any]:
        """Convert JSON string to row data dictionary."""
        try:
            return json.loads(row_json)
        except Exception as e:
            logger.error(f"Error parsing row JSON: {e}")
            raise ValueError(f"Invalid row JSON: {e}")

    def _protobuf_value_from_python(self, value: Any) -> table_service_pb2.RowDataValue:
        """Convert Python value to protobuf RowDataValue."""
        result = table_service_pb2.RowDataValue()
        if value is None:
            # For None, we don't set any field - let it be unset
            pass
        elif isinstance(value, str):
            result.text_value = value
        elif isinstance(value, (int, float)):
            result.number_value = float(value)
        elif isinstance(value, bool):
            result.boolean_value = value
        elif isinstance(value, list):
            # Convert list to JSON string for now
            import json
            result.json_value = json.dumps(value)
        else:
            # Convert complex objects to JSON string
            import json
            result.json_value = json.dumps(value)
        return result

    def CreateTable(self, request: table_service_pb2.CreateTableRequest, context) -> table_service_pb2.TableResponse:
        """Create a new Delta table with the specified schema."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[CreateTable] Request received:")
            logger.info(f"  - name: '{request.name}'")
            logger.info(f"  - description: '{request.description}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - Request fields: {dir(request)}")
            logger.info(f"  - Has s3_path field: {hasattr(request, 's3_path')}")
            
            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[CreateTable] s3_path field is missing from request!")
                return table_service_pb2.TableResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )
            
            if not request.s3_path:
                logger.error("[CreateTable] s3_path is empty!")
                return table_service_pb2.TableResponse(
                    success=False,
                    message="s3_path is required but empty"
                )
            
            logger.info(f"Creating table: {request.name} at {request.s3_path}")
            
            # Build schema from structured table fields
            schema = self._build_schema_from_table_fields(request.schema.fields)
            
            # Create empty DataFrame with the schema
            empty_df = pl.DataFrame(schema=schema)
            
            # Write to S3 as Delta Lake table
            write_deltalake(
                request.s3_path,
                empty_df,
                mode="overwrite",
                engine='rust'
            )
            
            # Create table response
            table = table_service_pb2.Table(
                table_id=request.name,  # Use name as ID for now
                name=request.name,
                schema=request.schema,  # Use structured schema
                description=request.description,
                created_by=request.user_id,
                updated_by=request.user_id,
                created_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                organization_id=request.organization_id,
                metadata=dict(request.metadata),
                s3_path=request.s3_path
            )
            
            logger.info(f"Successfully created table: {request.name} at {request.s3_path}")
            return table_service_pb2.TableResponse(
                success=True,
                table=table,
                message="Table created successfully"
            )
            
        except Exception as e:
            logger.error(f"Error creating table {request.name}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return table_service_pb2.TableResponse(
                success=False,
                message=f"Failed to create table: {str(e)}"
            )

    def CreateRows(self, request: table_service_pb2.CreateRowsRequest, context) -> table_service_pb2.CreateRowsResponse:
        """Efficiently create multiple rows in a Delta table."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[CreateRows] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - rows_data count: {len(request.rows_data)}")
            logger.info(f"  - Request fields: {dir(request)}")
            logger.info(f"  - Has s3_path field: {hasattr(request, 's3_path')}")
            
            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[CreateRows] s3_path field is missing from request!")
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )
            
            if not request.s3_path:
                logger.error("[CreateRows] s3_path is empty!")
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message="s3_path is required but empty"
                )
            
            logger.info(f"Creating {len(request.rows_data)} rows in table: {request.table_id} at {request.s3_path}")
            
            # Read existing table schema
            delta_table = DeltaTable(request.s3_path)
            schema = delta_table.schema().to_pyarrow()
            
            # Convert to DataFrame
            df = self._row_data_to_dataframe(request.rows_data, schema)
            
            # Append to Delta table
            write_deltalake(
                request.s3_path,
                df,
                mode="append",
                engine='rust'
            )
            
            # Create row entities for response
            rows = []
            for row_data in request.rows_data:
                row = table_service_pb2.Row(
                    row_id=row_data.id,
                    table_id=request.table_id,
                    row_data=row_data,
                    created_by=request.user_id,
                    updated_by=request.user_id,
                    created_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                    updated_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                    organization_id=request.organization_id,
                    is_deleted=False
                )
                rows.append(row)
            
            logger.info(f"Successfully created {len(df)} rows in table: {request.table_id}")
            return table_service_pb2.CreateRowsResponse(
                success=True,
                rows=rows,
                rows_created=len(df),
                message=f"Successfully created {len(df)} rows"
            )
            
        except Exception as e:
            logger.error(f"Error creating rows in table {request.table_id}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return table_service_pb2.CreateRowsResponse(
                success=False,
                message=f"Failed to create rows: {str(e)}"
            )

    # Placeholder implementations for other required methods
    def GetTable(self, request: table_service_pb2.GetTableRequest, context) -> table_service_pb2.TableResponse:
        """Get table metadata."""
        return table_service_pb2.TableResponse(
            success=False,
            message="GetTable not yet implemented"
        )

    def UpdateTable(self, request: table_service_pb2.UpdateTableRequest, context) -> table_service_pb2.TableResponse:
        """Update table metadata."""
        return table_service_pb2.TableResponse(
            success=False,
            message="UpdateTable not yet implemented"
        )

    def DeleteTable(self, request: table_service_pb2.DeleteTableRequest, context) -> table_service_pb2.DeleteTableResponse:
        """Delete a table."""
        return table_service_pb2.DeleteTableResponse(
            success=False,
            message="DeleteTable not yet implemented"
        )

    def ListTables(self, request: table_service_pb2.ListTablesRequest, context) -> table_service_pb2.ListTablesResponse:
        """List tables for an organization."""
        return table_service_pb2.ListTablesResponse(
            success=False,
            message="ListTables not yet implemented"
        )

    def GetRows(self, request: table_service_pb2.GetRowsRequest, context) -> table_service_pb2.GetRowsResponse:
        """Get multiple rows by IDs."""
        return table_service_pb2.GetRowsResponse(
            success=False,
            message="GetRows not yet implemented"
        )

    def UpdateRows(self, request: table_service_pb2.UpdateRowsRequest, context) -> table_service_pb2.UpdateRowsResponse:
        """Update multiple rows."""
        return table_service_pb2.UpdateRowsResponse(
            success=False,
            message="UpdateRows not yet implemented"
        )

    def DeleteRows(self, request: table_service_pb2.DeleteRowsRequest, context) -> table_service_pb2.DeleteRowsResponse:
        """Delete multiple rows."""
        return table_service_pb2.DeleteRowsResponse(
            success=False,
            message="DeleteRows not yet implemented"
        )

    def QueryRows(self, request: table_service_pb2.QueryRowsRequest, context) -> table_service_pb2.QueryRowsResponse:
        """Query rows with filters and pagination."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[QueryRows] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - order_by: '{request.order_by}'")
            logger.info(f"  - order_direction: '{request.order_direction}'")
            logger.info(f"  - limit: {request.limit}")
            logger.info(f"  - offset: {request.offset}")
            logger.info(f"  - filters count: {len(request.filters)}")
            logger.info(f"  - Request fields: {dir(request)}")
            logger.info(f"  - Has s3_path field: {hasattr(request, 's3_path')}")
            
            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[QueryRows] s3_path field is missing from request!")
                return table_service_pb2.QueryRowsResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )
            
            if not request.s3_path:
                logger.error("[QueryRows] s3_path is empty!")
                return table_service_pb2.QueryRowsResponse(
                    success=False,
                    message="s3_path is required but empty"
                )
            
            logger.info(f"Querying table: {request.table_id} at {request.s3_path} with filters: {dict(request.filters)}")
            
            # Read Delta table
            delta_table = DeltaTable(request.s3_path)
            df = delta_table.to_polars()
            
            # Apply filters
            for key, value in request.filters.items():
                if value.HasField('text_value'):
                    df = df.filter(pl.col(key) == value.text_value)
                elif value.HasField('number_value'):
                    df = df.filter(pl.col(key) == value.number_value)
                elif value.HasField('boolean_value'):
                    df = df.filter(pl.col(key) == value.boolean_value)
            
            # Apply ordering
            if request.order_by:
                if request.order_direction.upper() == 'DESC':
                    df = df.sort(request.order_by, descending=True)
                else:
                    df = df.sort(request.order_by, descending=False)
            
            # Get total count before pagination
            total_count = len(df)
            
            # Apply pagination
            if request.offset > 0:
                df = df.slice(request.offset)
            if request.limit > 0:
                df = df.slice(0, request.limit)
            
            # Convert to protobuf RowData format
            rows_data = []
            for row in df.to_dicts():
                row_data = table_service_pb2.RowData()
                row_data.id = str(row.get('id', ''))
                
                for key, value in row.items():
                    if key != 'id':
                        row_data.data[key].CopyFrom(self._protobuf_value_from_python(value))
                
                rows_data.append(row_data)
            
            logger.info(f"Successfully queried table: {request.table_id}, returned {len(rows_data)} rows")
            return table_service_pb2.QueryRowsResponse(
                success=True,
                rows=rows_data,
                total_count=total_count,
                message=f"Successfully queried {len(rows_data)} rows"
            )
            
        except Exception as e:
            logger.error(f"Error querying table {request.table_id}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return table_service_pb2.QueryRowsResponse(
                success=False,
                message=f"Failed to query table: {str(e)}"
            )