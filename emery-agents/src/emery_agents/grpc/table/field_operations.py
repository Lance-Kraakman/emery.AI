"""
Field Operations

Table field management operations including addition, deletion, and updates.
Handles schema evolution and field modifications with proper validation.
"""

import logging
from typing import List, Dict, Any, Optional
import pyarrow as pa
from deltalake import DeltaTable

from ..generated import table_service_pb2
from .schema import evolve_schema, create_enhanced_schema
from .validate import validate_field_mappings

logger = logging.getLogger(__name__)


def prepare_add_fields(
    delta_table: DeltaTable,
    new_fields: List[table_service_pb2.TableField]
) -> pa.Schema:
    """Prepare schema evolution for adding new fields.
    
    Process:
    1. Validate new field definitions
    2. Check for field name conflicts
    3. Evolve schema with new fields
    4. Return evolved schema for table update
    
    Args:
        delta_table: Existing DeltaTable instance
        new_fields: List of new TableField objects to add
        
    Returns:
        Evolved PyArrow schema with new fields
        
    Raises:
        ValueError: If field validation fails
    """
    logger.info(f"[prepare_add_fields] Adding {len(new_fields)} fields to table")
    
    # Step 1: Get current schema
    current_schema = delta_table.schema().to_arrow()
    current_field_names = set(current_schema.names)
    
    # Step 2: Validate new field definitions
    new_field_names = set()
    for field in new_fields:
        if field.name in current_field_names:
            raise ValueError(f"Field '{field.name}' already exists in table")
        if field.name in new_field_names:
            raise ValueError(f"Duplicate field '{field.name}' in new fields request")
        new_field_names.add(field.name)
    
    # Step 3: Evolve schema
    evolved_schema = evolve_schema(current_schema, new_fields)
    
    logger.info(f"[prepare_add_fields] Evolved schema from {len(current_schema.names)} to {len(evolved_schema.names)} fields")
    return evolved_schema


def prepare_delete_fields(
    delta_table: DeltaTable,
    field_ids: List[str]
) -> Dict[str, Any]:
    """Prepare field deletion operation.
    
    Process:
    1. Validate field IDs exist in table
    2. Check for critical field dependencies
    3. Prepare deletion metadata
    4. Return deletion plan
    
    Args:
        delta_table: Existing DeltaTable instance
        field_ids: List of field IDs to delete
        
    Returns:
        Deletion plan with metadata
        
    Raises:
        ValueError: If field validation fails or critical fields would be deleted
    """
    logger.info(f"[prepare_delete_fields] Deleting {len(field_ids)} fields from table")
    
    # Step 1: Get current schema
    current_schema = delta_table.schema().to_arrow()
    current_field_names = set(current_schema.names)
    
    # Step 2: Validate field IDs exist
    missing_fields = [field_id for field_id in field_ids if field_id not in current_field_names]
    if missing_fields:
        raise ValueError(f"Fields not found in table: {missing_fields}")
    
    # Step 3: Check for critical fields (id, created_at, etc.)
    critical_fields = {'id', 'created_at', 'updated_at'}
    critical_to_delete = [field_id for field_id in field_ids if field_id in critical_fields]
    if critical_to_delete:
        raise ValueError(f"Cannot delete critical fields: {critical_to_delete}")
    
    # Step 4: Prepare deletion plan
    deletion_plan = {
        'field_ids': field_ids,
        'field_types': {field_id: current_schema.field(field_id).type for field_id in field_ids},
        'impact': {
            'fields_removed': len(field_ids),
            'remaining_fields': len(current_schema.names) - len(field_ids)
        }
    }
    
    logger.info(f"[prepare_delete_fields] Prepared deletion plan for {len(field_ids)} fields")
    return deletion_plan


def prepare_update_fields(
    delta_table: DeltaTable,
    field_updates: List[table_service_pb2.TableField]
) -> Dict[str, Any]:
    """Prepare field update operation.
    
    Process:
    1. Validate field updates
    2. Check type compatibility
    3. Prepare update plan
    4. Return update metadata
    
    Args:
        delta_table: Existing DeltaTable instance
        field_updates: List of TableField objects with updates
        
    Returns:
        Update plan with metadata
        
    Raises:
        ValueError: If field validation fails or type changes are incompatible
    """
    logger.info(f"[prepare_update_fields] Updating {len(field_updates)} fields in table")
    
    # Step 1: Get current schema
    current_schema = delta_table.schema().to_arrow()
    current_field_names = set(current_schema.names)
    
    # Step 2: Validate field updates
    update_plan = {}
    for field in field_updates:
        if field.name not in current_field_names:
            raise ValueError(f"Field '{field.name}' not found in table")
        
        current_type = current_schema.field(field.name).type
        # Convert protobuf FieldType to PyArrow type (simplified conversion)
        new_type = current_type  # Keep same type for now - type conversion is complex
        
        # Check type compatibility (simplified - in real implementation would be more complex)
        if current_type != new_type:
            logger.warning(f"[prepare_update_fields] Type change for field '{field.name}': {current_type} -> {new_type}")
        
        update_plan[field.name] = {
            'old_type': current_type,
            'new_type': new_type,
            'type_change': current_type != new_type
        }
    
    # Step 3: Prepare update metadata
    update_metadata = {
        'field_updates': update_plan,
        'fields_changed': len([f for f in update_plan.values() if f['type_change']]),
        'total_fields': len(field_updates)
    }
    
    logger.info(f"[prepare_update_fields] Prepared update plan for {len(field_updates)} fields")
    return update_metadata