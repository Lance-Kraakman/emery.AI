# ACE Context Engineering - Initial Implementation

This document describes the ACE (Agentic Context Engineering) inspired patterns integrated into the Emery Agents system. The implementation adds context curation, strategy accumulation, and conversation history lookup capabilities.

## Overview

The ACE implementation introduces two distinct context sources:

| Context Source | Data Origin | Phase Used | Purpose |
|----------------|-------------|------------|---------|
| **ConversationHistory** | Chat messages (user + assistant) | Planning | Resolve references like "option 1", "your suggestion" |
| **ExecutionContext** | Plan step results | Execution | Distill results into actionable insights |

These are kept separate because they answer different questions:
- **ConversationHistory**: "What did we discuss?"
- **ExecutionContext**: "What did we do?"

---

## Architecture

```
ChatProcessingService
    │
    ├─ conversation_history ─────────────────────────┐
    │                                                │
    ▼                                                ▼
ExecutionCoordinator                    ConversationHistoryLookupAgent
    │                                   (managed agent for planner)
    │                                   Source: chat messages
    │
    ├─ TaskLedger (extended)
    │   ├─ execution_context: ExecutionContext      ← Source: step results
    │   │   ├─ insights: List[ExecutionInsight]
    │   │   └─ full_results_archive: Dict
    │   ├─ strategy_registry: StrategyRegistry
    │   └─ evolution_tracker: ExecutionEvolutionTracker
    │
    ├─ ExecutionContextService
    │   └─ Curates step results into insights
    │
    ├─ StrategyAccumulationService
    │   └─ Records patterns, surfaces to planner
    │
    └─ CoordinatorStateMachine
        └─ AWAITING_RECOVERY phase
```

---

## Components

### 1. Conversation History Lookup (Planning Phase)

Resolves user references to prior conversation during planning.

**Files:**
- `tools/conversation_history_lookup_tool.py` - Tool that searches chat messages
- `agents/conversation_history_lookup_agent.py` - Managed agent for planner
- `prompts/agents/conversation_history_lookup.j2` - Agent instructions

**Usage:**
```python
# In PlanService.generate_plan()
if conversation_history:
    history_lookup_agent = create_conversation_history_lookup_agent(
        model=model,
        conversation_history=conversation_history,
    )
    planner_managed_agents.append(history_lookup_agent)
```

**When to use:**
- User says "option 1", "option 2"
- User references "what you said", "earlier", "above"
- User mentions "your suggestion", "the plan you proposed"

---

### 2. Execution Context (Execution Phase)

Curates step execution results into actionable insights.

**Files:**
- `models/execution_context.py` - InsightType, ExecutionInsight, ExecutionContext
- `services/execution_context_service.py` - LLM-based insight extraction

**Insight Types:**
| Type | Description |
|------|-------------|
| `DISCOVERY` | Found something new (table, pattern, entity) |
| `DECISION` | Made a choice affecting future steps |
| `ARTIFACT` | Created something (table, field, record) |
| `CONSTRAINT` | Learned a limitation or requirement |
| `ERROR_RECOVERY` | How an error was resolved |

**Curation Process:**
```
Every 3 completed steps:
    │
    ├── Archive raw results (full backup)
    ├── Decay relevance of existing insights (factor=0.9)
    ├── LLM extracts new insights via InsightExtractionTool
    ├── Merge similar insights
    └── Take snapshot for recovery
```

**Token-Budgeted Context:**
```python
# Get most relevant insights within token budget
context_str = execution_context.get_relevant_context(max_tokens=500)
```

---

### 3. Execution Evolution Tracking

Monitors context changes and detects degradation.

**Files:**
- `models/execution_evolution.py` - ExecutionDelta, ExecutionSnapshot, ExecutionEvolutionTracker

**Change Types:**
- `ADDITION` - New information added
- `MODIFICATION` - Existing information changed
- `REMOVAL` - Information removed/lost

**Degradation Detection:**
```python
# Returns True if >30% of recent changes are information losses
if evolution_tracker.detect_degradation():
    logger.warning("Context degradation detected")
```

**Recovery:**
```python
# Snapshots taken after each curation (keeps last 5)
recovered_state = evolution_tracker.recover_from_snapshot(snapshot_id)
```

---

### 4. Strategy Accumulation

Records successful execution patterns for future planning guidance.

**Files:**
- `models/strategy_accumulation.py` - ExecutionPattern, StrategyRecord, StrategyRegistry
- `services/strategy_accumulation_service.py` - Service for recording and retrieving

**Recording (after execution):**
```python
strategy_service.record_execution(
    plan=plan,
    outcome=StrategyOutcome.SUCCESS,
    success_factors=["Found correct table", ...],
    failure_patterns=["Permission denied on...", ...],
)
```

**Retrieval (during planning):**
```python
strategies = strategy_service.get_relevant_strategies(
    goal=basic_instructions,
    max_results=3,
    min_confidence=0.3,
)
guidance = strategy_service.format_for_planner(strategies)
```

**Pattern Matching:**
- Patterns indexed by goal keywords
- Confidence = success_rate * usage_count normalization
- Surfaced to planner via `{% if strategy_guidance %}` template block

---

### 5. AWAITING_RECOVERY Phase

State machine phase for blocked execution recovery.

**File:** `services/coordinator_state_machine.py`

**Transitions:**
```
Phase.EXECUTING → Phase.AWAITING_RECOVERY  (execution blocked)
Phase.AWAITING_RECOVERY → Phase.EXECUTING  (user provides input)
Phase.AWAITING_RECOVERY → Phase.IDLE       (user chooses replan/cancel)
```

**User Options:**
| Input | Action |
|-------|--------|
| `"retry"` | Retry failed step as-is |
| `"skip"` | Skip failed step, continue |
| `"replan"` | Abort and start over |
| `"cancel"` | Abort and start over |
| `<other>` | Retry with user input as context |

---

## Data Flow

### Planning Phase

```
User: "Go with option 1"
    │
    ▼
PlanService.generate_plan()
    │
    ├── conversation_history_lookup_agent
    │       └── Searches: "option 1" in assistant messages
    │       └── Returns: "Option 1 = Salesforce integration"
    │
    ├── strategy_service.get_relevant_strategies()
    │       └── Returns: Patterns from similar past goals
    │
    └── render_template(_base_planner.j2)
            ├── {{ strategy_guidance }}
            └── Instructions for conversation_history_lookup
```

### Execution Phase

```
execute_plan()
    │
    ├── ledger.init_execution_tracking()
    │       └── Creates: ExecutionContext, StrategyRegistry, EvolutionTracker
    │
    for each step:
    │   ├── Execute step
    │   ├── evolution_tracker.record_context_change()
    │   │
    │   └── [Every 3 steps]
    │           ├── execution_context_service.curate()
    │           ├── evolution_tracker.take_snapshot()
    │           └── Check degradation
    │
    └── strategy_service.record_execution()
```

---

## TaskLedger Extensions

### New Fields

```python
@dataclass
class TaskLedger:
    # ... existing fields ...

    # ACE execution tracking
    execution_context: Optional[ExecutionContext] = None
    strategy_registry: Optional[StrategyRegistry] = None
    evolution_tracker: Optional[ExecutionEvolutionTracker] = None
```

### Initialization

```python
def init_execution_tracking(self) -> None:
    """Called at start of execute_plan()."""
    self.execution_context = ExecutionContext(task_id=self.task_id)
    self.strategy_registry = StrategyRegistry()
    self.evolution_tracker = ExecutionEvolutionTracker(task_id=self.task_id)
```

### Enhanced Evaluator Input

The `to_toon_summary()` method now includes:

```python
{
    "goal": "...",
    "progress": "3/5",
    "step_results": {...},

    # ACE additions
    "curated_context": "[DISCOVERY] Found customer tables...",
    "context_warning": "Context degradation detected",  # if degrading
    "degradation_warnings": ["Info loss in step_2..."]  # if degrading
}
```

---

## Template Changes

### `_base_planner.j2`

Added conditional sections:

```jinja
{% if strategy_guidance %}
## Strategy Guidance (Proven Patterns)

These patterns have worked well for similar tasks:
{{ strategy_guidance }}
{% endif %}

{% if has_conversation_history_lookup %}
## Conversation History Lookup

The **conversation_history_lookup** agent is available to search prior chat.

**Use when user references:**
- "option 1", "option 2"
- "what you said", "earlier"
- "your suggestion"
{% endif %}
```

---

## File Summary

### New Files

| File | Description |
|------|-------------|
| `models/execution_context.py` | InsightType, ExecutionInsight, ExecutionContext |
| `models/execution_evolution.py` | ExecutionDelta, ExecutionSnapshot, ExecutionEvolutionTracker |
| `models/strategy_accumulation.py` | ExecutionPattern, StrategyRecord, StrategyRegistry |
| `services/execution_context_service.py` | InsightExtractionTool, ExecutionContextService |
| `services/strategy_accumulation_service.py` | StrategyAccumulationService |
| `tools/conversation_history_lookup_tool.py` | ConversationHistoryLookupTool |
| `agents/conversation_history_lookup_agent.py` | create_conversation_history_lookup_agent() |
| `prompts/agents/conversation_history_lookup.j2` | Agent template |

### Modified Files

| File | Changes |
|------|---------|
| `models/task_ledger.py` | Added 3 ACE fields, `init_execution_tracking()`, enhanced `to_toon_summary()` |
| `services/coordinator_state_machine.py` | Added `AWAITING_RECOVERY` phase and handlers |
| `services/execution_coordinator.py` | ACE service initialization, execution hooks |
| `services/plan_service.py` | conversation_history + strategy_service parameters |
| `prompts/planning/_base_planner.j2` | strategy_guidance and conversation_history_lookup sections |

---

## Usage Examples

### Resolving User References

```python
# User says: "Go with option 1"
# Planner delegates to conversation_history_lookup_agent
# Agent searches assistant messages for "option 1"
# Returns: "Option 1 = Use Salesforce integration"
# Planner now knows what to plan
```

### Context Curation

```python
# After step 3 completes:
execution_context_service.curate(
    execution_context=ledger.execution_context,
    raw_step_results=plan_step_executor.step_results,
    recent_step_ids=["step_1", "step_2", "step_3"],
)
# Result: 2 insights extracted
# - [DISCOVERY] Found 3 customer tables
# - [DECISION] Using 'customers' as primary source
```

### Strategy Guidance

```python
# During planning for "Create a customer dashboard":
strategies = strategy_service.get_relevant_strategies("Create a customer dashboard")
# Returns: Pattern from previous "Create sales dashboard" (85% similar, 90% success)
# Planner sees: "Previous similar task used: 1. Query tables, 2. Build schema, 3. Create views"
```

---

## Configuration

### Curation Frequency

```python
# In ExecutionCoordinator.__init__()
self._execution_context_service = create_execution_context_service(
    model_provider=model_provider,
    curate_after_steps=3,  # Run curation every 3 steps
)
```

### Degradation Threshold

```python
# In ExecutionEvolutionTracker
degradation_threshold: float = 0.3  # >30% losses = degradation
```

### Strategy Confidence

```python
# In get_relevant_strategies()
strategies = strategy_service.get_relevant_strategies(
    goal=goal,
    min_confidence=0.3,  # Minimum confidence to surface
    max_results=3,       # Maximum patterns to return
)
```

---

## Future Considerations

1. **Persistence**: Currently in-memory. Could persist strategy_registry to database for cross-session learning.

2. **Recovery Actions**: `AWAITING_RECOVERY` phase handlers not yet wired to chat_processing_service event loop.

3. **Degradation Response**: Currently logs warning. Could auto-trigger recovery or user prompt.

4. **Cross-Task Learning**: Strategies are per-session. Could aggregate across users/organizations.
