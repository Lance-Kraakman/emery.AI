# AI Model Selection Hierarchy

## Overview

This system implements **context-specific model selection hierarchies** across three independent use cases. Each context has its own priority order for determining which AI model to use.

**Important:** There is **no single global hierarchy**. The model used depends on the context (chat, agent task execution, or skill execution).

---

## The Three Contexts

### 1. Chat System (Mission Control Conversations)

**When:** User chats in Mission Control interface
**Hierarchy:** `Organization → System Default`
**Implementation Status:** ✅ **Complete**

#### Model Selection Flow
```
1. Check organization.defaultModel
   └─ If set → Use organization model
   └─ If null → Use system default
```

#### Implementation Details
- **Database:** `organizations.default_model` (schema.ts:241)
- **Set In UI:** `/settings/usage` page
- **TypeScript:** `/src/app/api/chat/stream-grpc/route.ts:259-264`
- **Python:** `chat_processing_service.py:169-173, 410`

#### Example
```typescript
// Organization has defaultModel = "Qwen/Qwen2.5-Coder-7B-Instruct"
// Chat API fetches org model
const organization = await orgRepository.findById(organizationId);
const defaultModel = organization?.defaultModel || null;

// Passes to gRPC worker
processingOptions.defaultModel = defaultModel; // "Qwen/Qwen2.5-Coder-7B-Instruct"

// Python resolves
model_id = model_provider.resolve_model_selection(org_model=org_model)
// Returns: "Qwen/Qwen2.5-Coder-7B-Instruct"
```

#### Why Chat Doesn't Use Agent Model
Chat is organization-scoped, not agent-scoped. Agent models are for task execution, not conversations.

---

### 2. Agent Task Execution (Running Task Instructions)

**When:** Agent executes task instructions via `/api/agents/{id}/tasks`
**Hierarchy:** `Agent → Organization → System Default`
**Implementation Status:** ⚠️ **Needs Wiring**

#### Model Selection Flow
```
1. Check agent.defaultModel
   └─ If set → Use agent model
   └─ If null ↓
2. Check organization.defaultModel
   └─ If set → Use organization model
   └─ If null → Use system default
```

#### Implementation Details
- **Database:**
  - `agents.default_model` (schema.ts:548)
  - `organizations.default_model` (schema.ts:241)
- **Set In UI:** Agent configuration form
- **TypeScript:** ⚠️ NOT yet wired to task execution
- **Python:** Ready to receive via `agent_model` parameter in `resolve_model_selection()`

#### Current Gap
Agent model exists in schema and entity but is **not passed** to the execution flow. Task execution currently uses only organization model.

#### Required Implementation
1. Fetch agent.defaultModel when creating task
2. Pass agent model through proto/gRPC request
3. Python worker receives and uses in hierarchy

#### Example (Future Implementation)
```typescript
// Agent has defaultModel = "claude-3-opus-20240229"
// Organization has defaultModel = "Qwen/Qwen2.5-Coder-7B-Instruct"

const agent = await agentRepository.findById(agentId);
const organization = await orgRepository.findById(organizationId);

// Should pass both to worker
const taskRequest = {
  agentModel: agent.defaultModel,      // "claude-3-opus-20240229"
  orgModel: organization.defaultModel   // "Qwen/Qwen2.5-Coder-7B-Instruct"
};

// Python resolves
model_id = model_provider.resolve_model_selection(
  agent_model="claude-3-opus-20240229",
  org_model="Qwen/Qwen2.5-Coder-7B-Instruct"
)
// Returns: "claude-3-opus-20240229" (agent override)
```

---

### 3. Skill Execution (Future - Skill Tool)

**When:** Skill tool executes a specific skill
**Hierarchy:** `Skill → Agent → Organization → System Default`
**Implementation Status:** 📋 **Future Implementation**

#### Model Selection Flow
```
1. Check skill.model
   └─ If set → Use skill model
   └─ If null ↓
2. Check agent.defaultModel (of parent agent)
   └─ If set → Use agent model
   └─ If null ↓
3. Check organization.defaultModel
   └─ If set → Use organization model
   └─ If null → Use system default
```

#### Implementation Details
- **Database:**
  - `skills.model` (schema.ts:719) - ✅ Schema exists
  - `agents.default_model` (schema.ts:548)
  - `organizations.default_model` (schema.ts:241)
- **Set In UI:** 📋 Future - Skill configuration form
- **TypeScript:** ❌ NOT mapped to Skill entity yet
- **Python:** Ready - `resolve_model_selection()` accepts `skill_model` parameter

#### Current Status
Schema field exists but:
- NOT mapped to Skill domain entity
- NOT exposed in UI
- NOT wired to execution (skill tool doesn't exist yet)

#### Use Case
Different skills may need different models:
- Writing skills → Claude Opus (better prose)
- Code analysis → GPT-4 (better reasoning)
- Data extraction → Qwen Coder (faster, cheaper)

#### Example (Future Implementation)
```typescript
// Skill has model = "claude-3-opus-20240229"
// Agent has defaultModel = "gpt-4-turbo"
// Organization has defaultModel = "Qwen/Qwen2.5-Coder-7B-Instruct"

const skill = await skillRepository.findById(skillId);
const agent = await agentRepository.findById(skill.agentId);
const organization = await orgRepository.findById(agent.organizationId);

// Pass all to worker
const skillRequest = {
  skillModel: skill.model,              // "claude-3-opus-20240229"
  agentModel: agent.defaultModel,       // "gpt-4-turbo"
  orgModel: organization.defaultModel   // "Qwen/Qwen2.5-Coder-7B-Instruct"
};

// Python resolves
model_id = model_provider.resolve_model_selection(
  skill_model="claude-3-opus-20240229",
  agent_model="gpt-4-turbo",
  org_model="Qwen/Qwen2.5-Coder-7B-Instruct"
)
// Returns: "claude-3-opus-20240229" (skill override wins)
```

---

## Python Model Resolution

The Python `SmolagentsModelProvider.resolve_model_selection()` method implements the hierarchy:

```python
# emery-agents/src/emery_agents/infrastructure/ai/smolagents_model_provider.py:236-268

def resolve_model_selection(
    self,
    skill_model: Optional[str] = None,
    agent_model: Optional[str] = None,
    org_model: Optional[str] = None,
) -> str:
    """
    Resolve model selection using hierarchy: skill > agent > org > default.

    Note: This method is context-agnostic. Different contexts pass different
    combinations of parameters:

    - Chat: Only org_model
    - Agent Task: agent_model + org_model
    - Skill Execution: skill_model + agent_model + org_model
    """
    if skill_model:
        logger.info(f"📌 Using skill model override: {skill_model}")
        return skill_model

    if agent_model:
        logger.info(f"📌 Using agent default model: {agent_model}")
        return agent_model

    if org_model:
        logger.info(f"📌 Using organization default model: {org_model}")
        return org_model

    # Fall back to system default
    default_model = get_default_model_for_tier(ModelTier.FREE)
    logger.info(f"📌 Using system default model: {default_model}")
    return default_model
```

---

## Summary Table

| Context | Hierarchy | Status | Implementation Files |
|---------|-----------|--------|---------------------|
| **Chat** | Org → Default | ✅ Complete | `chat/stream-grpc/route.ts`, `chat_processing_service.py` |
| **Agent Task** | Agent → Org → Default | ⚠️ Schema exists, not wired | Needs: Task execution flow updates |
| **Skill Execution** | Skill → Agent → Org → Default | 📋 Future | Needs: Skill entity mapping, skill tool |

---

## Database Schema

### Organizations Table
```sql
-- src/lib/db/schema.ts:241
organizations {
  default_model TEXT,              -- Organization-wide default (used by chat)
  available_models JSONB,          -- Models available to this organization
  token_quota_monthly INTEGER,     -- Monthly token limit
  ...
}
```

### Agents Table
```sql
-- src/lib/db/schema.ts:548
agents {
  default_model TEXT,              -- Agent-specific default (used by task execution)
  ...
}
```

### Skills Table
```sql
-- src/lib/db/schema.ts:719
skills {
  model TEXT,                      -- Skill-specific override (future: skill tool execution)
  ...
}
```

---

## Common Misconceptions

### ❌ "There's a chat-level model config"
**False.** Chat uses organization model. There is no per-chat model configuration.

### ❌ "Agent model should override org model in chat"
**False.** Chat is organization-scoped. Agent models only apply to task execution, not conversations.

### ❌ "There's one global hierarchy that applies everywhere"
**False.** There are 3 context-specific hierarchies (chat, agent tasks, skill execution).

### ❌ "Task-level model override exists"
**Partially True.** Proto structure exists for `instructionConfig.model` but it's not actively used. Tasks use agent model → org model hierarchy.

---

## Future Work

### Required: Agent Task Execution Wiring
1. Fetch `agent.defaultModel` in task execution flow
2. Pass through proto/gRPC to Python worker
3. Update task execution logs to show which model was selected
4. Add tests for agent model hierarchy

### Future: Skill Execution Implementation
1. Map `skills.model` field to Skill domain entity
2. Expose skill model in UI (skill configuration form)
3. Implement skill tool that respects skill model hierarchy
4. Add validation: skill model must be in organization's `availableModels`

### Optional: Model Selection Visibility
1. Show effective model in UI with hierarchy explanation
2. Add model selection preview before execution
3. Log which level provided the model in execution logs
4. Add token usage tracking per model per level

---

## Testing Strategy

### Unit Tests
- Test `resolve_model_selection()` with all parameter combinations
- Test null/empty string handling
- Test fallback to system default

### Integration Tests
- **Chat:** Test org model selection, test fallback to default
- **Agent Task:** Test agent override, test org fallback, test default fallback
- **Skill:** Test skill override, test agent fallback, test org fallback, test default

### E2E Tests
- Create org with model → Chat uses org model
- Create agent with model override → Task uses agent model
- Create skill with model override → Skill execution uses skill model
- Test model not in `availableModels` → Should reject

---

## Related Documentation

- **Model Registry:** `emery-agents/src/emery_agents/infrastructure/ai/model_registry.py`
- **Model Provider:** `emery-agents/src/emery_agents/infrastructure/ai/smolagents_model_provider.py`
- **Chat Implementation:** `src/app/api/chat/stream-grpc/route.ts`
- **Schema Definitions:** `src/lib/db/schema.ts`

---

**Last Updated:** 2025-01-03
**Status:** Documentation reflects current implementation and planned architecture
