# System Chat Issues

## Issue: Skill Execution Loop - "go-for-a-walk" (2026-02-12)

### Symptom
User attempts to execute `@skill:go-for-a-walk` (skill ID 30), but system repeatedly asks for clarification about the skill ID, even after user provides "30" multiple times.

---

## Root Cause Analysis

### The Chain of Failures

```
@skill:go-for-a-walk
       ↓
[1] Mention Parser: pre_selected_skill = "go-for-a-walk"  ✅ Works
       ↓
[2] Tool Loader: Creates skill-30 tool
       ↓
[3] DynamicSkillTool: Calls GET /api/skills/30
       ↓
[4] ❌ NETWORK FAILURE: "app-integration:3000" unresolvable
       ↓
[5] Tool created with fallback: name="skill_skill_30", description="error message"
       ↓
[6] Planning: Task enriched with "Look up skill 'go-for-a-walk' using discovery tools"
       ↓
[7] Planner: Calls system_research for "go-for-a-walk"
       ↓
[8] ❌ NETWORK FAILURE: Same issue
       ↓
[9] No results → Planner asks for clarification
       ↓
[10] User provides "30" → Loop repeats because name→ID mapping never works
```

### Key Problems

#### Problem 1: Network Connectivity (BLOCKING)
**Files**: All API calls fail
```
ERROR - [DYNAMIC-SKILL] Error fetching skill metadata: HTTPConnectionPool(host='app-integration', port=3000)
WARNING - Workspace API failed: ERROR: HTTP request failed: [Errno -2] Name or service not known
```

**Impact**:
- No skill metadata (name, description, inputs)
- No workspace context
- Discovery tools return nothing

---

#### Problem 2: Name → ID Mapping Lost
**Files**: `grpc/agent_streaming.py:168-183`, `orchestrators/nodes/planning.py:405-416`

The flow:
```python
# In agent_streaming.py
pre_selected_skill = "go-for-a-walk"  # Parsed from @skill:go-for-a-walk

# In planning.py (line 410-415)
enriched_task = (
    f"{task}\n\n"
    f"[USER DIRECTIVE: The user explicitly selected the 'go-for-a-walk' skill via @skill mention. "
    f"Build a focused plan that uses this skill. Look up the skill by name using discovery tools, ..."
)
```

**Problem**:
- Frontend sends `skill-30` as the tool (with skill_id=30 in config)
- `@skill:go-for-a-walk` is parsed as NAME "go-for-a-walk"
- Planner is told to "look up by name" but discovery is down
- No direct mapping from name → loaded tool

---

#### Problem 3: Configured Tools Not Utilized
**Files**: `services/planning/dspy_plan_generator.py:154`, `orchestrators/nodes/planning.py:597`

`configured_tools` DOES contain `skill-30`:
```json
[{"name": "skill-30", "config": {"skill_id": 30, ...}}]
```

But:
- Planner doesn't know `skill-30` = "go-for-a-walk"
- The directive says "look up by name" → searches → fails
- Planner never checks if the skill is already in configured_tools

---

#### Problem 4: No Fallback When Discovery Fails
**Files**: `orchestrators/nodes/planning.py:410-415`

When `@skill:` is detected, the directive hardcodes:
> "Look up the skill by name using discovery tools"

But when discovery fails:
- No fallback to check configured_tools
- No direct execution path
- Just loops asking for clarification

---

## Proposed Fixes

### Fix 1: Pass Skill ID When Available (HIGH PRIORITY)
**File**: `grpc/agent_streaming.py`

When parsing `@skill:name`, also check if the skill tool is loaded and extract the ID:

```python
# After parsing skill mention
if skill_invocation:
    pre_selected_skill = skill_invocation.skill_name
    # Check if we have a skill tool with matching name or extract ID from loaded tools
    for tool in smolagents_tools:
        if hasattr(tool, 'skill_id'):
            # Frontend already sent the skill ID - use it
            pre_selected_skill_id = tool.skill_id
```

Then pass `pre_selected_skill_id` to planning node.

---

### Fix 2: Update Planning Directive for Pre-selected Skills (HIGH PRIORITY)
**File**: `orchestrators/nodes/planning.py:410-416`

When skill ID is known, skip discovery:

```python
if pre_selected_skill:
    # Check if skill tool is already loaded in configured_tools
    skill_tool = next(
        (t for t in configured_tools if t.get("config", {}).get("skill_id")),
        None
    )
    if skill_tool:
        skill_id = skill_tool["config"]["skill_id"]
        enriched_task = (
            f"{task}\n\n"
            f"[USER DIRECTIVE: Execute skill ID {skill_id} ('{pre_selected_skill}'). "
            f"This skill is already loaded as a configured tool. Use it directly with the skill_skill_{skill_id} tool.]"
        )
    else:
        # Fall back to discovery
        enriched_task = (...)
```

---

### Fix 3: Graceful Degradation in DynamicSkillTool (MEDIUM)
**File**: `tools/integrations/dynamic_skill.py:98-162`

When metadata fetch fails, still create a usable tool:

```python
def _fetch_skill_metadata(self) -> dict[str, Any]:
    try:
        # ... existing fetch logic ...
    except Exception as e:
        logger.error(f"[DYNAMIC-SKILL] Error fetching skill metadata: {e}")
        # Return minimal metadata that allows execution
        return {
            "name": f"skill_{self.skill_id}",
            "description": f"Execute skill {self.skill_id}. Metadata unavailable, but skill can still be executed.",
            "inputs": [],  # Will use generic input
        }
```

---

### Fix 4: Direct Execution Mode for @skill Mentions (MEDIUM)
**File**: `orchestrators/graphs/plan_execute.py`

When `@skill:` with valid skill_id in configured_tools, route directly to execution:

```python
def decide_after_entry(state: SessionState) -> str:
    # ... existing logic ...

    # If skill is pre-selected AND we have the tool loaded, skip planning
    if state.get("pre_selected_skill"):
        configured = state.get("configured_tools", [])
        skill_tool = next((t for t in configured if "skill_id" in t.get("config", {})), None)
        if skill_tool:
            # Create a simple 1-step plan and go directly to execution
            return "direct_skill_execute"
```

---

### Fix 5: Clarification Deduplication (LOW)
**File**: `orchestrators/nodes/planning.py` or `services/planning/dspy_plan_generator.py`

Track previously asked questions and don't repeat:

```python
# In state
previous_clarifications: list[str] = []

# In planning
if question_already_asked(new_question, previous_clarifications):
    # Don't ask again, try with available information
    pass
```

---

## Verification Steps

1. **Unit test**: Mock network failure, verify skill still executes with ID
2. **Integration test**: Send `@skill:name` when skill tool is loaded, verify direct execution
3. **Network test**: Verify graceful degradation when `app-integration` is down

---

## Other Issues (From Previous Audit)

### Planner Routing Optimization (MEDIUM)
**File**: `reasoning/modules/planner.py:187`
```python
needs_external_data = (
    use_complex_planner
    or bool(external_services)
    or bool(self.external_tools)  # Always true if discovery tools passed
)
```
- `bool(self.external_tools)` is always true when discovery tools are passed
- Forces complex planner (ReAct) even when simpler ChainOfThought would suffice

### Knowledge Base Verification (MEDIUM)
- `runtime.knowledge_base` may be None in some cases
- Need to verify it's properly initialized in RuntimeContext
