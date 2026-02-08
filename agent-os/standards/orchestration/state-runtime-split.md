# State vs RuntimeContext Split

LangGraph checkpoints state using msgpack serialization. Split data accordingly:

**PlanExecuteState (TypedDict)** — Checkpointed, survives interrupt/resume:
- Primitives: `str`, `int`, `bool`, `Optional[...]`
- Serializable containers: `List[Dict]`, `Dict[str, Any]`
- Dataclasses with `.to_dict()` / `.from_dict()` methods

**RuntimeContext (dataclass)** — Session-scoped, NOT checkpointed:
- Callable tools (closures, inference clients)
- Registries with ML embeddings (CapabilityRegistry)
- Service instances (MemoryService, PlanFileRepository)
- PIL images, protobuf objects

```python
# Bad: Tool in state (will fail checkpoint)
state["my_tool"] = some_callable  # ❌

# Good: Tool in runtime, passed via closure
runtime = RuntimeContext(tools=[some_callable])
async def _node(state): return await node(state, runtime)
```

See `orchestrators/runtime.py` for RuntimeContext definition.
