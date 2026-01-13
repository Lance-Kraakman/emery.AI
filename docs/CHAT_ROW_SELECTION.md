# Chat Row Selection Integration

## Medium Priority Implementation Plan

### Overview

When a user mentions a skill in chat that has table-mapped inputs with `source_row` row source, we need to prompt them to select which row to use before executing the skill.

```
User: "Run @skill:extract-data on the companies table"
            ↓
   RowPicker dialog appears
            ↓
   User selects row #5 (or "Run on All Rows")
            ↓
   Skill executes with row context
```

---

## Current State

### Completed Components

1. **`RowPicker.tsx`** - Dialog for selecting rows
   - Fetches rows from table
   - Search/filter functionality
   - Single row selection
   - "Run on All Rows" batch mode option

2. **`skill-row-utils.ts`** - Utilities
   - `getSkillTableMappings()` - Get inputs requiring row selection
   - `skillRequiresRowSelection()` - Check if skill needs picker
   - `SkillRowContext` type

3. **`skill_tool.py`** - Backend checks for `__row_id__`
   - Already checks `context.get('__row_id__')` for row-specific execution

### Missing Integration

The connection between:
- User selecting `@skill:name` in chat
- Detecting the skill needs row selection
- Showing RowPicker
- Passing row context to backend

---

## Implementation Plan

### Phase 1: Skill Detection in Chat

**File: `src/components/shared/UnifiedChatInput.tsx`**

When user types `@skill:skill-name` and tries to send:

```typescript
// Add imports
import { RowPicker } from '@/components/chat/RowPicker';
import { skillRequiresRowSelection, getTablesRequiringRowSelection } from '@/lib/utils/skill-row-utils';
import type { SkillRowContext } from '@/lib/utils/skill-row-utils';

// Add state
const [rowPickerOpen, setRowPickerOpen] = useState(false);
const [pendingSkill, setPendingSkill] = useState<{
  skillId: number;
  skillName: string;
  tableId: number;
  tableName?: string;
  message: string;
} | null>(null);
const [rowContext, setRowContext] = useState<SkillRowContext | null>(null);

// In handleSendMessage:
const handleSendMessage = async () => {
  if (inputValue.trim() && !disabled && onSendMessage) {
    const message = inputValue.trim();
    const { mappedMessage } = toolResolverService.mapReferencesToTools(message);

    // Check if message mentions a skill that needs row selection
    const skillMatch = message.match(/@skill:(\d+)/);
    if (skillMatch) {
      const skillId = parseInt(skillMatch[1]);
      const skill = await fetchSkillInputs(skillId);

      if (skill && skillRequiresRowSelection(skill.inputs)) {
        const tableIds = getTablesRequiringRowSelection(skill.inputs);
        if (tableIds.length > 0) {
          // Show row picker before sending
          setPendingSkill({
            skillId,
            skillName: skill.name,
            tableId: tableIds[0],  // Use first table (could extend for multiple)
            message: mappedMessage,
          });
          setRowPickerOpen(true);
          return;  // Don't send yet
        }
      }
    }

    // No row selection needed - send normally
    onSendMessage(mappedMessage);
    setInputValue('');
  }
};

// Handle row selection
const handleRowSelect = (context: SkillRowContext) => {
  if (pendingSkill) {
    // Add row context to message metadata
    const messageWithContext = {
      text: pendingSkill.message,
      metadata: {
        rowContext: context,
        skillId: pendingSkill.skillId,
      },
    };

    // Send with context
    onSendMessage(JSON.stringify(messageWithContext));
    setRowPickerOpen(false);
    setPendingSkill(null);
    setInputValue('');
  }
};

// Render RowPicker
{pendingSkill && (
  <RowPicker
    open={rowPickerOpen}
    onOpenChange={setRowPickerOpen}
    skillName={pendingSkill.skillName}
    tableId={pendingSkill.tableId}
    tableName={pendingSkill.tableName}
    onSelect={handleRowSelect}
    onCancel={() => {
      setRowPickerOpen(false);
      setPendingSkill(null);
    }}
  />
)}
```

### Phase 2: Message Parsing in Backend

**File: `emery-agents/src/emery_agents/grpc/chat_processing_service.py`**

Parse row context from message metadata:

```python
async def process_chat_message(
    self,
    request: ChatRequest,
    # ...
) -> AsyncIterator[ChatResponse]:
    """Process incoming chat message."""

    message_text = request.message
    row_context = None

    # Check if message has embedded metadata
    if message_text.startswith('{'):
        try:
            parsed = json.loads(message_text)
            if isinstance(parsed, dict) and 'text' in parsed:
                message_text = parsed['text']
                metadata = parsed.get('metadata', {})
                row_context = metadata.get('rowContext')
        except json.JSONDecodeError:
            pass  # Not JSON, use raw message

    # Pass row context to skill execution
    if row_context:
        execution_context = {
            '__row_id__': row_context.get('rowId'),
            '__batch_mode__': row_context.get('batchMode', False),
            '__table_id__': row_context.get('tableId'),
        }
    else:
        execution_context = {}

    # ... continue with message processing ...
```

### Phase 3: Skill Tool Integration

**File: `emery-agents/src/emery_agents/tools/skill_tool.py`**

The skill tool already checks for `__row_id__`:

```python
# Existing code (already implemented)
row_id = context.get('__row_id__')
if row_id:
    # Row-specific execution
    pass
```

Need to ensure execution context is passed through:

```python
class SkillTool:
    def __init__(
        self,
        # ...
        execution_context: Optional[Dict[str, Any]] = None,
    ):
        self.execution_context = execution_context or {}

    def forward(self, **kwargs) -> str:
        # Merge execution context with skill inputs
        runtime_context = {
            **kwargs,
            **self.execution_context,
        }

        # Execute skill with context
        result = self.skill_executor.execute(
            skill_config=self.skill_config,
            runtime_inputs=runtime_context,
            # ...
        )
        return result
```

### Phase 4: Batch Execution (Optional Enhancement)

For "Run on All Rows" mode:

```python
async def execute_skill_batch(
    self,
    skill_config: SkillConfig,
    table_id: int,
    # ...
) -> List[SkillExecutionResult]:
    """Execute skill for all rows in a table."""

    # Fetch all rows
    rows = await self.fetch_table_rows(table_id)

    results = []
    for row in rows:
        # Execute with row context
        result = await self.execute_skill(
            skill_config=skill_config,
            runtime_context={'__row_id__': row['id'], '__table_id__': table_id},
        )
        results.append(result)

    return results
```

---

## Data Flow Diagram

```
UnifiedChatInput                      Backend
─────────────────                     ───────

1. User types "@skill:123 extract data"
         │
         ▼
2. handleSendMessage() detects @skill:123
         │
         ▼
3. fetchSkillInputs(123) → check inputs
         │
         ▼
4. skillRequiresRowSelection(inputs) → true
         │
         ▼
5. Show RowPicker dialog
         │
         ▼
6. User selects row #5
         │
         ▼
7. handleRowSelect({rowId: 5, tableId: 10})
         │
         ▼
8. Send message with metadata:
   {
     "text": "@tool:skill_123 extract data",
     "metadata": {
       "rowContext": {"rowId": 5, "tableId": 10}
     }
   }
         │
         ▼                            9. Parse message JSON
                                      │
                                      ▼
                                      10. Extract rowContext
                                      │
                                      ▼
                                      11. Set __row_id__ = 5 in context
                                      │
                                      ▼
                                      12. skill_tool.forward()
                                      │
                                      ▼
                                      13. Read row #5 from table #10
                                      │
                                      ▼
                                      14. Execute skill with row data
```

---

## File Changes Summary

### Frontend

| File | Changes |
|------|---------|
| `UnifiedChatInput.tsx` | Add RowPicker integration, skill detection, row context handling |
| `RowPicker.tsx` | Already complete |
| `skill-row-utils.ts` | Already complete |

### Backend

| File | Changes |
|------|---------|
| `chat_processing_service.py` | Parse message metadata, extract row context |
| `skill_tool.py` | Pass execution context through to skill executor |
| `skill_executor.py` | Handle `__row_id__` in input mapping resolution |

---

## API Endpoint Needed

**Fetch skill inputs for row selection check:**

```typescript
// New API route: /api/skills/[skillId]/inputs
export async function GET(
  request: Request,
  { params }: { params: { skillId: string } }
) {
  const skill = await getSkillById(parseInt(params.skillId));
  return Response.json({
    inputs: skill.inputs,
    name: skill.name,
  });
}
```

Or use existing skill fetch and filter to just inputs.

---

## Testing Checklist

### Manual Testing

1. **Create skill with source_row input**
   - Add input mapping with rowSource = 'source_row'
   - Save skill

2. **Trigger in chat**
   - Type `@skill:skill-name` in chat
   - Press Enter/Send
   - Verify RowPicker dialog appears

3. **Single row selection**
   - Select a row
   - Click "Use Selected Row"
   - Verify skill executes with that row's data

4. **Batch mode**
   - Click "Run on All Rows"
   - Verify skill executes for each row
   - Verify results are aggregated

5. **Cancel**
   - Click Cancel
   - Verify message is not sent
   - Verify dialog closes

### Edge Cases

- Skill with no inputs needing selection → send normally
- Skill with multiple tables needing selection → TBD (show multiple pickers or first only)
- Empty table → show "No rows" message, disable selection
- API error fetching rows → show error, allow retry

---

## Implementation Order

1. **API endpoint** (15 min)
   - Create `/api/skills/[skillId]/inputs`

2. **UnifiedChatInput changes** (45 min)
   - Add state for RowPicker
   - Add skill detection in handleSendMessage
   - Add RowPicker render

3. **Backend message parsing** (30 min)
   - Update chat_processing_service.py
   - Pass row context to skill execution

4. **Integration testing** (30 min)
   - End-to-end test with real skill

5. **Batch execution** (Optional - 45 min)
   - Implement loop execution for all rows
   - Aggregate results

**Total: ~2 hours** (without batch mode)

---

## Alternative: Props-Based Integration

Instead of modifying UnifiedChatInput directly, we could:

1. Lift skill detection to parent component
2. Pass callbacks as props

```typescript
interface UnifiedChatInputProps {
  // ...existing props...

  // Skill row selection (optional)
  onSkillDetected?: (skillId: number, message: string) => Promise<boolean>;
  // Returns true if should proceed, false if handling externally
}
```

This keeps UnifiedChatInput generic and moves skill-specific logic to chat components.
