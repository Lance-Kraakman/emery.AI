# Backend: Node → Skill Output Separation

## High Priority Implementation Plan

### Overview

Currently, the system uses skill-level outputs directly for OutputTool. The new architecture separates:

1. **Node outputs** (`step.output_defs`) - What the LLM extracts via `submit_result()`
2. **Skill outputs** (`skill.outputs` with `source` config) - Mapped from node outputs after capture

```
                     CURRENT FLOW
┌─────────────────────────────────────────────────┐
│  skill.outputs → OutputTool → submit_result()   │
│       ↓                                          │
│  captured values = skill outputs (direct)        │
└─────────────────────────────────────────────────┘

                      NEW FLOW
┌─────────────────────────────────────────────────┐
│  step.output_defs → OutputTool → submit_result()│
│       ↓                                          │
│  captured node outputs (per step)                │
│       ↓                                          │
│  skill.outputs[].source → mapping                │
│       ↓                                          │
│  skill outputs (aggregated from nodes)           │
└─────────────────────────────────────────────────┘
```

---

## Phase 1: Proto Changes

### File: `proto/agent_worker.proto`

Add `OutputSource` message and update `OutputDefinition`:

```protobuf
// Output source - where skill output value comes from
message OutputSource {
  string type = 1;           // "node_output"
  string node_id = 2;        // Step/node name that produces this output
  string output_name = 3;    // Output name from the node's output_defs
}

// Unified output definition
message OutputDefinition {
  string name = 1;
  string type = 2;
  OutputMappingConfig output_mapping = 3;
  string description = 4;
  OutputSource source = 5;  // NEW: where skill output value comes from
}
```

After editing proto, regenerate Python types:
```bash
cd emery-agents && make proto
```

---

## Phase 2: Skill Executor Changes

### File: `emery-agents/src/emery_agents/services/skill_executor.py`

### 2.1 Update Workflow Execution Mode

Current code at line ~286 uses `skill_config.outputs` for OutputTool. Need to:

1. For each agentic step, use `step.output_defs` for OutputTool
2. After capture, map node outputs → skill outputs via source config

```python
# In _execute_workflow() or similar method

async def _execute_agentic_step(
    self,
    step: SkillStep,
    step_inputs: Dict[str, Any],
    # ... other params
) -> Dict[str, Any]:
    """Execute an agentic step with its own OutputTool."""

    # Use step's output_defs for OutputTool (not skill-level outputs)
    output_tool = None
    if step.output_defs:
        target_metadata = build_target_field_metadata_from_mappings(list(step.output_defs))
        output_tool = OutputTool(
            skill_outputs=list(step.output_defs),  # Step-level outputs
            target_field_metadata=target_metadata
        )
        step_tools.append(output_tool)

    # ... build task, create agent, execute ...

    # Capture step's outputs
    captured = output_tool.get_captured_values() if output_tool and output_tool.was_called() else {}

    # Return captured node outputs (keyed by output name)
    return captured
```

### 2.2 Add Output Mapping Function

```python
def map_node_outputs_to_skill_outputs(
    all_node_outputs: Dict[str, Dict[str, Any]],  # node_id -> {output_name: value}
    skill_outputs: List[OutputDefinition]
) -> Dict[str, Any]:
    """
    Map captured node outputs to skill outputs based on source config.

    Args:
        all_node_outputs: Dict mapping node_id to its captured outputs
        skill_outputs: Skill-level output definitions with source config

    Returns:
        Dict mapping skill output name to value
    """
    result = {}

    for output in skill_outputs:
        if output.source and output.source.type == 'node_output':
            node_id = output.source.node_id
            output_name = output.source.output_name

            # Get value from the specified node's outputs
            node_outputs = all_node_outputs.get(node_id, {})
            value = node_outputs.get(output_name)

            result[output.name] = value
            logger.debug(f"Mapped {node_id}.{output_name} -> {output.name}: {value}")
        else:
            # No source configured - skill output not mapped
            result[output.name] = None

    return result
```

### 2.3 Integration in Workflow Execution

```python
async def execute_workflow(
    self,
    skill_config: SkillConfig,
    runtime_inputs: Dict[str, Any],
    # ...
) -> SkillExecutionResult:
    """Execute multi-step workflow with output separation."""

    # Track outputs from all nodes
    all_node_outputs: Dict[str, Dict[str, Any]] = {}

    # Execute each step
    for step in skill_config.steps:
        step_inputs = self._resolve_step_inputs(step, runtime_inputs, all_node_outputs)

        if step.instruction:  # Agentic step
            captured = await self._execute_agentic_step(step, step_inputs, ...)
            all_node_outputs[step.name] = captured
        elif step.skill_id:  # Skill reference
            result = await self._execute_skill_ref(step, step_inputs, ...)
            all_node_outputs[step.name] = result
        # ... other step types

    # Map node outputs to skill outputs
    skill_outputs = map_node_outputs_to_skill_outputs(
        all_node_outputs,
        list(skill_config.outputs)
    )

    return SkillExecutionResult(
        result="Workflow completed",
        captured_outputs=skill_outputs
    )
```

---

## Phase 3: Step Executor Integration

### File: `emery-agents/src/emery_agents/services/step_executor.py`

The `StepExecutorService` already parses `output_defs` from proto (line 243-246):

```python
output_defs = [
    OutputDef(name=d.name, type=d.type or "text")
    for d in proto.output_defs
]
```

Need to:
1. Add OutputTool creation for agentic steps with output_defs
2. Track captured outputs per step
3. Return aggregated outputs for mapping

### 3.1 Update `_execute_inline_step`

Current implementation (line 1087-1131) doesn't use OutputTool. Update to:

```python
async def _execute_inline_step(
    self,
    step: Step,
    step_inputs: Dict[str, Any],
    step_context: Dict[str, Any],
    org_model: Optional[str]
) -> Any:
    """Execute a step with inline instruction using a sub-agent."""

    instruction = self._inject_context(step.instruction, step_context)

    # Load step tools
    step_tools = []
    if step.tools:
        # ... existing tool loading ...

    # Add OutputTool if step has output_defs
    output_tool = None
    if step.output_defs:
        from ..tools.output_tool import OutputTool, build_target_field_metadata_from_mappings

        # Convert OutputDef to proto-like structure for OutputTool
        proto_outputs = [
            {'name': d.name, 'type': d.type}
            for d in step.output_defs
        ]
        output_tool = OutputTool(skill_outputs=proto_outputs)
        step_tools.append(output_tool)

    # Build task with output instructions
    task_parts = [instruction]
    if step_inputs:
        task_parts.append("\n\nInputs:")
        for key, value in step_inputs.items():
            task_parts.append(f"- {key}: {value}")

    if output_tool:
        from ..prompts import render_output_instructions
        output_instructions = render_output_instructions(proto_outputs)
        if output_instructions:
            task_parts.append(f"\n\n{output_instructions}")

    task = "\n".join(task_parts)

    # Create and run agent
    # ... existing agent creation ...
    result = sub_agent.run(task=task, stream=False, reset=True)

    # Return captured outputs if OutputTool was used
    if output_tool and output_tool.was_called():
        return output_tool.get_captured_values()

    return result
```

---

## Phase 4: Frontend → Backend Data Flow

### 4.1 Skill Mapper Updates

Ensure `OutputSource` is serialized when saving skills:

**File: `src/app/mappers/skill-mapper.ts`**

```typescript
// In toProto or similar conversion
function outputDefinitionToProto(output: OutputDefinition): ProtoOutputDefinition {
  return {
    name: output.name,
    type: output.type || 'text',
    description: output.description,
    outputMapping: output.outputMapping ? outputMappingToProto(output.outputMapping) : undefined,
    source: output.source ? {
      type: output.source.type,
      nodeId: output.source.nodeId,
      outputName: output.source.outputName,
    } : undefined,
  };
}
```

### 4.2 Verify GRPC Serialization

After proto regeneration, ensure the generated TypeScript types include `source`:

**File: `src/lib/grpc/generated/agent_worker.ts`** (auto-generated)

Should include:
```typescript
export interface OutputSource {
  type: string;
  nodeId: string;
  outputName: string;
}

export interface OutputDefinition {
  name: string;
  type: string;
  outputMapping?: OutputMappingConfig;
  description?: string;
  source?: OutputSource;  // Should be present after proto regen
}
```

---

## Phase 5: Output Mapping Service

### File: `emery-agents/src/emery_agents/services/output_mapping_service.py`

The current service receives `skill_outputs: List[SkillOutputValue]` and applies table mappings.

No changes needed here - the mapping from node→skill outputs happens BEFORE this service is called. The service receives the already-mapped skill outputs.

---

## Implementation Order

1. **Proto changes** (15 min)
   - Add `OutputSource` message
   - Add `source` field to `OutputDefinition`
   - Regenerate Python & TypeScript types

2. **Skill executor mapping function** (30 min)
   - Add `map_node_outputs_to_skill_outputs()`
   - Unit test the mapping logic

3. **Step executor OutputTool** (45 min)
   - Update `_execute_inline_step` to use step.output_defs
   - Add OutputTool creation for agentic steps
   - Update `_capture_outputs` to store per-step

4. **Workflow orchestration** (30 min)
   - Aggregate node outputs across steps
   - Apply mapping at workflow completion

5. **Frontend mapper** (15 min)
   - Ensure `source` is serialized to proto
   - Test round-trip save/load

6. **Integration testing** (30 min)
   - Create skill with:
     - Agentic node with outputDefs
     - Skill output with source mapping
   - Verify captured outputs flow correctly

---

## Testing Strategy

### Unit Tests

```python
def test_map_node_outputs_to_skill_outputs():
    """Test node→skill output mapping."""
    node_outputs = {
        'extract_data': {'company_name': 'Acme', 'email': 'test@acme.com'},
        'validate': {'is_valid': True}
    }

    skill_outputs = [
        OutputDefinition(
            name='company',
            source=OutputSource(type='node_output', node_id='extract_data', output_name='company_name')
        ),
        OutputDefinition(
            name='contact_email',
            source=OutputSource(type='node_output', node_id='extract_data', output_name='email')
        ),
        OutputDefinition(
            name='validated',
            source=OutputSource(type='node_output', node_id='validate', output_name='is_valid')
        ),
    ]

    result = map_node_outputs_to_skill_outputs(node_outputs, skill_outputs)

    assert result == {
        'company': 'Acme',
        'contact_email': 'test@acme.com',
        'validated': True
    }
```

### Integration Test

1. Create skill via UI with:
   - Agentic node "scraper" with outputDefs: `[{name: 'title'}, {name: 'description'}]`
   - Skill outputs: `[{name: 'page_title', source: {nodeId: 'scraper', outputName: 'title'}}]`

2. Execute skill

3. Verify:
   - LLM sees OutputTool with `title`, `description` (node-level)
   - Skill result has `page_title` (mapped from node's `title`)

---

## Backward Compatibility

For skills without the new `source` config:
- Default behavior: skill outputs pass through directly (legacy mode)
- Add fallback in mapping function:

```python
def map_node_outputs_to_skill_outputs(
    all_node_outputs: Dict[str, Dict[str, Any]],
    skill_outputs: List[OutputDefinition]
) -> Dict[str, Any]:
    result = {}

    for output in skill_outputs:
        if output.source and output.source.type == 'node_output':
            # New: Map from node output
            node_id = output.source.node_id
            output_name = output.source.output_name
            node_outputs = all_node_outputs.get(node_id, {})
            result[output.name] = node_outputs.get(output_name)
        else:
            # Legacy: Try to find output with same name in any node
            for node_outputs in all_node_outputs.values():
                if output.name in node_outputs:
                    result[output.name] = node_outputs[output.name]
                    break
            else:
                result[output.name] = None

    return result
```

---

## Summary

| Task | File | Effort |
|------|------|--------|
| Proto changes | `agent_worker.proto` | 15 min |
| Mapping function | `skill_executor.py` | 30 min |
| Step executor OutputTool | `step_executor.py` | 45 min |
| Workflow orchestration | `skill_executor.py` | 30 min |
| Frontend mapper | `skill-mapper.ts` | 15 min |
| Testing | Various | 30 min |
| **Total** | | **~2.5 hours** |
