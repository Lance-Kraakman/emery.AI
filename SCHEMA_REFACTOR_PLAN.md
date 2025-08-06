# Schema Refactor Plan

## Overview
Refactor agent models to better represent relationships and improve flexibility.

## Changes Proposed

### 1. Agent Table Changes
```sql
-- Remove fields
ALTER TABLE agents DROP COLUMN model;
ALTER TABLE agents DROP COLUMN goals;

-- Change tools and servers from text[] to jsonb for richer metadata
ALTER TABLE agents ALTER COLUMN tools TYPE jsonb USING 
  CASE 
    WHEN tools IS NULL THEN NULL
    ELSE array_to_json(tools)::jsonb 
  END;

ALTER TABLE agents ALTER COLUMN servers TYPE jsonb USING 
  CASE 
    WHEN servers IS NULL THEN NULL
    ELSE array_to_json(servers)::jsonb 
  END;
```

### 2. Tasks Table Enhancement
```sql
-- Add direct agent relationship
ALTER TABLE tasks ADD COLUMN agent_id INTEGER REFERENCES agents(id);

-- Create index for performance
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
```

### 3. Enhanced JSON Structures

#### Tools Format (JSONB)
```json
[
  {
    "name": "python", 
    "version": "3.11",
    "config": {"timeout": 30}
  },
  {
    "name": "calculator",
    "config": {"precision": 10}
  }
]
```

#### Servers Format (JSONB) 
```json
[
  {
    "name": "gmail",
    "endpoint": "https://gmail.googleapis.com",
    "config": {"scopes": ["read", "send"]}
  },
  {
    "name": "slack", 
    "endpoint": "https://slack.com/api",
    "config": {"channels": ["general"]}
  }
]
```

#### Enhanced Capabilities Format (JSONB)
```json
[
  {
    "name": "email_workflow",
    "description": "Complete email management",
    "steps": [
      {
        "id": "analyze_request",
        "type": "TOOL_STEP",
        "instructions": "Analyze email request",
        "model": "claude-3-haiku-20240307", // Per-step model
        "tools": [
          {"name": "email_analyzer", "config": {"language": "auto"}}
        ]
      },
      {
        "id": "compose_response", 
        "type": "CODE_STEP",
        "instructions": "Generate email response",
        "model": "claude-3-sonnet-20240229", // Different model for writing
        "servers": [
          {"name": "gmail", "config": {"template": "professional"}}
        ]
      }
    ]
  }
]
```

## Benefits

### 1. Better Relationships
- Direct agent → tasks relationship
- Clear task ownership and history

### 2. Flexibility  
- Per-step model selection (fast models for analysis, better models for writing)
- Rich tool/server configuration metadata
- Version tracking for tools and APIs

### 3. Simplified Agent Definition
- Remove unused `goals` field
- Move `model` to step level where it's actually used
- Richer tool/server metadata for better integration

### 4. Enhanced Querying
- `SELECT * FROM tasks WHERE agent_id = ?` (direct agent task history)
- JSON querying for complex capability searches
- Better analytics on tool/server usage

## Migration Strategy

### Phase 1: Extend Schema (Backwards Compatible)
1. Add `agent_id` to tasks table
2. Convert tools/servers to JSONB (with fallback parsing)
3. Update capabilities to support per-step models

### Phase 2: Update Application Code
1. Update TypeScript types
2. Update Python models  
3. Update API routes to handle new structures
4. Update UI forms

### Phase 3: Clean Up
1. Remove `model` and `goals` from agents table
2. Update existing data to new format
3. Remove old parsing code

## TypeScript Type Updates

```typescript
interface Agent {
  id: number;
  name: string;
  role?: string;
  description?: string; 
  persona?: string;
  // model removed - now per-step
  // goals removed - not needed
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  capabilities?: Capability[];
  // ... other fields
}

interface ToolConfig {
  name: string;
  version?: string;
  config?: Record<string, any>;
}

interface ServerConfig {
  name: string;
  endpoint?: string; 
  config?: Record<string, any>;
}

interface StepConfig {
  id: string;
  type: 'CODE_STEP' | 'TOOL_STEP';
  instructions: string;
  model?: string; // NEW: Per-step model
  tools?: ToolConfig[];
  servers?: ServerConfig[];
}
```

## Questions to Resolve

1. **Tools/Servers as JSONB**: Should we keep simple arrays or move to rich JSONB objects?
   - Pro JSONB: More metadata, versioning, configuration
   - Pro Arrays: Simpler, less storage

2. **Agent-Task Relationship**: 
   - Should agents have a direct `tasks` array field?
   - Or rely on foreign key relationship in tasks table?

3. **Model Storage**:
   - Per-step models (proposed)
   - Or agent-level default + step-level overrides?

4. **Backward Compatibility**:
   - How to handle existing agents during migration?
   - Should we support both formats during transition?