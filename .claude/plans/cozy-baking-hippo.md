# Fix Field Creation - ID 0 and Agent Delegation Issues

## Status: Investigation Complete

## Two Issues Identified

### Issue 1: Field ID Always Returns 0

**Root Cause Found**: In `table-application-service.ts:createField()`, after saving the table, the code retrieves the field from the **original table object** instead of the **returned saved table** which has the updated IDs.

**Flow Trace**:
```
createField()
  ├─ TableField.create() → Field with ID 0 (FieldId.newEntity() returns 0)
  ├─ table.addField(field)
  ├─ saveResult = dynamicTableService.saveTable(table)
  │   └─ repository.update() → Returns reloaded table with correct IDs
  │
  ├─ table.getField() → Still has ID 0 ❌ (uses original table)
  └─ return field with ID 0
```

**The Fix**: Use `saveResult.data` instead of the original `table` to get the field with the correct ID.

### Issue 2: Agent Delegation

**Finding**: The system IS using specialized agents correctly:
- **TableBuilderAgent**: Simple operations (add column, delete field) - autonomous, no approval
- **SchemaBuilderAgent**: Complex schema design - requires HITL approval

The routing is based on LLM classification in `TaskClassifier`. The field_crud tools are used BY these agents, not instead of them.

## Files to Modify

| File | Change |
|------|--------|
| `src/ddd/application/services/tables/table-application-service.ts` | Fix `createField()` to use returned table from save |

## Implementation

### Fix createField() (lines 376-390)

**Before**:
```typescript
// Line 377
const saveResult = await this.dynamicTableService.saveTable(table);
if (!saveResult.success) {
  return ResultHelpers.failure(saveResult.error || 'Failed to save table with new field');
}

// Line 383 - BUG: Uses original table with ID 0
const newField = table.getField(command.name);
```

**After**:
```typescript
const saveResult = await this.dynamicTableService.saveTable(table);
if (!saveResult.success) {
  return ResultHelpers.failure(saveResult.error || 'Failed to save table with new field');
}

// Use the returned table which has updated field IDs from persistence
const savedTable = saveResult.data;
if (!savedTable) {
  return ResultHelpers.failure('Table saved but could not be retrieved');
}

const newField = savedTable.getField(command.name);
```

### Same Fix Needed for updateField() (lines 453-469)

The `updateField()` method has the same issue - it uses `table.getField()` instead of `saveResult.data.getField()`.

## Verification

After fix:
1. Run `pnpm typecheck`
2. Call `POST /api/fields?format=llm` with a new field
3. Expected response: `field:created,123,fieldname,text` (actual ID, not 0)

## Additional Context

The "field already exists" errors in the logs are likely because:
1. Agent creates field → gets back ID 0
2. Agent thinks creation failed or tries to verify
3. Agent attempts to create again → actual field exists in DB → error
