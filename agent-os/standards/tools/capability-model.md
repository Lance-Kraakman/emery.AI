# Capability Model

Unified representation for agents, skills, and tools. Enables semantic search across all capability types.

**ID Format:** `type:name` (validated on construction)
- `agent:schema_builder`
- `skill:weekly-report`
- `integration:gmail` or `tool:gmail-send-email`

**Required fields:**
```python
Capability(
    id="agent:schema_builder",
    name="schema_builder",
    type=CapabilityType.AGENT,  # AGENT, SKILL, or TOOL
    domain="emery",             # Source: emery, gmail, slack, user...
    description="Creates database tables",
    actions=["create", "update"],  # Verbs for search
    entities=["tables", "fields"], # Nouns for search (optional)
)
```

**Note:** `type` in ID prefix and `type` enum are redundant. The enum enables filtering without parsing IDs.

See `entities/models/capability.py` and `tools/capability_registry.py`.
