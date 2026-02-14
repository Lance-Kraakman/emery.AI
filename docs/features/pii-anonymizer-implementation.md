# System-Wide PII Anonymization Infrastructure

> **Status**: Future Feature
> **Priority**: TBD
> **Created**: 2026-02-15

## Overview

Build a **reversible, role-based PII anonymization system** that:
- Stores data normally, applies masking on retrieval based on permissions
- Uses `pii:view` permission to determine who sees real vs masked data
- Works across tables, memories, chat, audit logs, exports, and API responses
- Leverages existing Presidio PIIFilter for auto-detection, extends with field-level config

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PII TRANSFORMATION LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐           │
│  │ PIIFieldConfig  │   │ PIIPermissions  │   │ PIITokenRegistry│           │
│  │ (field metadata)│   │ pii:view/manage │   │ (reversible)    │           │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘           │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 ▼                                           │
│                    ┌────────────────────────┐                               │
│                    │ PIITransformationService│                              │
│                    │ (central orchestrator)  │                              │
│                    └───────────┬────────────┘                               │
│                                │                                            │
├────────────────────────────────┼────────────────────────────────────────────┤
│                                ▼                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ RowMapper    │  │ MemoryService│  │ ChatMessages │  │ Exports/API  │    │
│  │ (tables)     │  │ (Python)     │  │ (gRPC/SSE)   │  │ (CSV/JSON)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: PII Configuration Model

### Field-Level Config (TypeScript)

**File**: `/src/ddd/domain/pii/value-objects/pii-config.ts` (new)

```typescript
export type PIICategory = 'email' | 'phone' | 'ssn' | 'name' | 'address' | 'credit_card' | 'custom';

export type MaskingStrategy =
  | 'full'           // ****
  | 'partial_email'  // j***@example.com
  | 'partial_phone'  // ***-***-1234
  | 'partial_name'   // J*** D**
  | 'hash'           // Consistent hash for search
  | 'redact';        // [REDACTED]

export interface PIIFieldConfig {
  isPII: boolean;
  piiType: PIICategory;
  maskingStrategy: MaskingStrategy;
  searchable?: boolean;       // Allow hash-based search on masked field
  auditAccess?: boolean;      // Log unmasked access (default: true)
}
```

### Extend TableField Metadata

**File**: `/src/ddd/domain/tables/value-objects/table-field.ts`

Add helper methods:
```typescript
isPIIField(): boolean {
  return this._metadata?.pii?.isPII === true;
}

getPIIConfig(): PIIFieldConfig | undefined {
  return this._metadata?.pii;
}
```

---

## Component 2: PII Permissions

### New RBAC Permissions

**File**: `/src/ddd/domain/shared/value-objects/permission.ts`

Add:
```typescript
static readonly PII_VIEW = new Permission('pii', 'view');     // See unmasked data
static readonly PII_MANAGE = new Permission('pii', 'manage'); // Configure PII fields
static readonly PII_EXPORT = new Permission('pii', 'export'); // Export with PII
```

### Default Role Assignments

| Role | pii:view | pii:manage | pii:export |
|------|----------|------------|------------|
| Owner | all | all | all |
| Admin | all | all | all |
| Lead | team | - | team |
| Member | owned | - | - |
| Viewer | - | - | - |

---

## Component 3: PII Transformation Service (TypeScript)

**File**: `/src/ddd/application/services/pii/pii-transformation-service.ts` (new)

```typescript
export class PIITransformationService {
  constructor(
    private rbacRepository: IRBACRepository,
    private maskingStrategies: Record<MaskingStrategy, MaskFn>
  ) {}

  async transformRowDTO(
    row: RowDTO,
    fieldConfigs: Record<string, PIIFieldConfig>,
    context: { userId: UserId; organizationId: OrganizationId; tableId: number }
  ): Promise<RowDTO> {
    const canViewPII = await this.rbacRepository.hasResourcePermission(
      context.userId,
      Permission.PII_VIEW,
      context.organizationId,
      'table',
      context.tableId
    );

    if (canViewPII) return row; // No transformation needed

    // Mask each PII field
    return {
      ...row,
      fieldValues: row.fieldValues.map(fv => {
        const config = fieldConfigs[fv.fieldId];
        if (config?.isPII) {
          return { ...fv, value: this.mask(fv.value, config) };
        }
        return fv;
      })
    };
  }

  private mask(value: unknown, config: PIIFieldConfig): string {
    return this.maskingStrategies[config.maskingStrategy](String(value), config);
  }
}
```

### Masking Strategy Implementations

```typescript
const MASKING_STRATEGIES = {
  full: () => '****',
  partial_email: (v) => v.replace(/^(.)[^@]*/, '$1***') , // j***@example.com
  partial_phone: (v) => v.replace(/\d(?=\d{4})/g, '*'),   // ***-***-1234
  partial_name: (v) => v.split(' ').map(p => p[0] + '***').join(' '),
  hash: (v) => 'HASH_' + sha256(v).slice(0, 12),
  redact: () => '[REDACTED]'
};
```

---

## Component 4: Table/Row Integration

### RowMapper Integration

**File**: `/src/app/mappers/row-mapper.ts`

```typescript
static async toDTO(
  row: Row,
  options?: { piiContext?: PIITransformContext; fields?: TableField[] }
): Promise<RowDTO> {
  const baseDTO = { /* existing logic */ };

  if (options?.piiContext && options?.fields) {
    const piiService = getPIITransformationService();
    const fieldConfigs = extractPIIConfigs(options.fields);
    return piiService.transformRowDTO(baseDTO, fieldConfigs, options.piiContext);
  }

  return baseDTO;
}
```

### Server Actions Integration

**File**: `/src/app/actions/rows.ts`

Update `getRowsDSG()`:
```typescript
// After fetching rows, apply PII transformation
const piiContext = { userId, organizationId, tableId };
const maskedRows = await piiService.transformRows(rows, fieldConfigs, piiContext);
```

---

## Component 5: Python Agent-Side (Reversible + Irreversible)

### PIIAnonymizer Service

**File**: `/emery-agents/src/emery_agents/services/pii/anonymizer.py` (new)

```python
class PIIScope(Enum):
    AGENT_MEMORY = "agent_memory"     # Irreversible (shared)
    USER_CHAT = "user_chat"           # Reversible (returns to user)
    SKILL_IO = "skill_io"             # Reversible (user-provided)
    WORKSPACE_LOG = "workspace_log"   # Irreversible (shared history)
    STREAMING = "streaming"           # Reversible (real-time to user)

class PIIAnonymizer:
    def __init__(self, token_registry: PIITokenRegistry):
        self._analyzer = AnalyzerEngine()  # Presidio
        self._token_registry = token_registry

    def anonymize(self, text: str, context: PIIContext) -> str:
        if self._should_use_irreversible(context):
            return self._redact(text)  # Existing PIIFilter behavior
        else:
            return self._tokenize(text, context)  # Reversible tokens

    def deanonymize(self, text: str, context: PIIContext) -> str:
        """Expand tokens back to original values (for authorized users)."""
        return self._token_registry.expand_tokens(text, context.session_id)
```

### Policy Rules

| Context | Workspace | Strategy |
|---------|-----------|----------|
| Agent Memory | agents | IRREVERSIBLE |
| Chat Input | any | REVERSIBLE |
| Chat Output | any | REVERSIBLE |
| Skill Input/Output | any | REVERSIBLE |
| Session Logs | agents | IRREVERSIBLE |
| Session Logs | users | REVERSIBLE |
| Streaming Response | any | REVERSIBLE |

### Token Registry

**File**: `/emery-agents/src/emery_agents/services/pii/token_registry.py` (new)

```python
class PIITokenRegistry:
    """In-memory token storage with session-scoped cleanup."""

    def store(self, token_id: str, original: str, session_id: str) -> None:
        self._tokens[token_id] = PIIToken(original, session_id, expires=now()+TTL)

    def retrieve(self, token_id: str) -> str | None:
        token = self._tokens.get(token_id)
        return token.original if token and not token.expired else None

    def cleanup_session(self, session_id: str) -> None:
        """Called when chat session ends."""
        self._tokens = {k: v for k, v in self._tokens.items() if v.session_id != session_id}
```

---

## Component 6: Integration Points

### TypeScript Side

| Location | Integration |
|----------|-------------|
| `/src/app/mappers/row-mapper.ts` | Call `PIITransformationService.transformRowDTO()` |
| `/src/app/actions/rows.ts` | Pass PII context through to mapper |
| `/src/app/api/rows/route.ts` | Extract user context for PII permission check |
| `/src/app/api/rows/export/route.ts` (new) | Check `pii:export` permission |
| `/src/app/api/tables/[id]/route.ts` | Return field PII config in response |

### Python Side

| Location | Integration |
|----------|-------------|
| `/emery-agents/.../memory_service.py` | Use `PIIAnonymizer` for memory storage |
| `/emery-agents/.../chat_processing_service.py` | Tokenize inputs, de-tokenize outputs |
| `/emery-agents/.../task_executor.py` | Anonymize task text, de-anonymize results |
| `/emery-agents/.../shared_filesystem_storage.py` | Anonymize session log entries |
| `/emery-agents/.../dynamic_skill.py` | Anonymize skill inputs/outputs |

---

## Component 7: Database Schema

### PII Tokens Table (Optional - for persistent reversible tokens)

```sql
CREATE TABLE pii_tokens (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  token TEXT NOT NULL UNIQUE,
  encrypted_value TEXT NOT NULL,  -- AES-256-GCM
  pii_type TEXT NOT NULL,
  source_type TEXT NOT NULL,      -- 'field', 'chat', 'memory'
  session_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

### Seed PII Permissions

```sql
-- Add to role_permissions for system roles
INSERT INTO role_permissions (role_id, permission, resource_scope)
VALUES
  (1, 'pii:view', 'all'),    -- Owner
  (1, 'pii:manage', 'all'),
  (1, 'pii:export', 'all'),
  (2, 'pii:view', 'all'),    -- Admin
  (2, 'pii:manage', 'all'),
  (2, 'pii:export', 'all'),
  (3, 'pii:view', 'team'),   -- Lead
  (3, 'pii:export', 'team'),
  (4, 'pii:view', 'owned');  -- Member
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `/src/ddd/domain/pii/` with `PIIFieldConfig`, value objects
2. Add `pii:view`, `pii:manage`, `pii:export` permissions
3. Create `PIITransformationService` with masking strategies
4. Seed role permissions

**Files**:
- `/src/ddd/domain/pii/value-objects/pii-config.ts` (new)
- `/src/ddd/domain/shared/value-objects/permission.ts` (extend)
- `/src/ddd/application/services/pii/pii-transformation-service.ts` (new)

### Phase 2: Table Field Configuration
1. Extend `TableField` metadata with PII config
2. Add `isPIIField()` and `getPIIConfig()` helpers
3. Add PII config UI in field settings modal

**Files**:
- `/src/ddd/domain/tables/value-objects/table-field.ts` (extend)
- Field settings UI component

### Phase 3: Row Mapper Integration
1. Update `RowMapper.toDTO()` to accept PII context
2. Update `getRowsDSG()` to pass user context
3. Update API routes to extract user context

**Files**:
- `/src/app/mappers/row-mapper.ts`
- `/src/app/actions/rows.ts`
- `/src/app/api/rows/route.ts`

### Phase 4: Python Agent Integration
1. Create `/emery-agents/src/emery_agents/services/pii/` module
2. Implement `PIIAnonymizer` with reversible/irreversible paths
3. Implement `PIITokenRegistry` for session-scoped tokens
4. Integrate with `MemoryService`, `ChatProcessingService`

**Files**:
- `/emery-agents/src/emery_agents/services/pii/anonymizer.py` (new)
- `/emery-agents/src/emery_agents/services/pii/token_registry.py` (new)
- `/emery-agents/src/emery_agents/services/memory/memory_service.py`
- `/emery-agents/src/emery_agents/grpc/chat_processing_service.py`

### Phase 5: Exports & Audit
1. Create export endpoint with PII permission check
2. Add PII access audit logging
3. Add visual indicators in UI for masked fields

**Files**:
- `/src/app/api/rows/export/route.ts` (new)
- `/src/app/actions/audit-helpers.ts` (extend)

---

## Verification Plan

1. **Unit Tests**:
   - `PIITransformationService` masking strategies
   - Permission checks for `pii:view`
   - Token registry store/retrieve/cleanup

2. **Integration Tests**:
   - Fetch rows as Owner (sees real data) vs Viewer (sees masked)
   - Export CSV with/without `pii:export` permission
   - Agent memory storage with PII redaction
   - Chat message tokenization round-trip

3. **Manual Testing**:
   - Create table with email/phone fields, mark as PII
   - Add rows with real data
   - View as admin (unmasked) vs viewer (masked)
   - Export as admin (full data) vs member (masked)
   - Chat with agent, verify PII in responses is handled

---

## Critical Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `/src/ddd/domain/pii/value-objects/pii-config.ts` | CREATE | PII config types |
| `/src/ddd/domain/shared/value-objects/permission.ts` | EXTEND | Add PII permissions |
| `/src/ddd/application/services/pii/pii-transformation-service.ts` | CREATE | Central masking service |
| `/src/ddd/domain/tables/value-objects/table-field.ts` | EXTEND | Add isPIIField() helper |
| `/src/app/mappers/row-mapper.ts` | MODIFY | Integrate PII transformation |
| `/src/app/actions/rows.ts` | MODIFY | Pass PII context |
| `/emery-agents/.../services/pii/anonymizer.py` | CREATE | Python PII service |
| `/emery-agents/.../services/pii/token_registry.py` | CREATE | Reversible token storage |
| `/emery-agents/.../services/memory/memory_service.py` | MODIFY | Use new anonymizer |
