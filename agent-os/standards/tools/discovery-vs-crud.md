# Discovery vs CRUD Tools

Two categories of tools with different execution permissions.

**Discovery Tools** (read-only, always available):
- `system_research` — query platform resources
- `workspace_overview` — snapshot of all databases, apps, agents
- `search_capabilities` — semantic search for capabilities
- `search_external` — external integration details
- `web_search` — DuckDuckGo search

**CRUD Tools** (mutations blocked during planning):
- `database_crud`, `table_crud`, `field_crud`, `row_crud`
- `app_crud`, `page_crud`, `view_crud`
- `skill_crud`, `agent_crud`, `team_crud`

**Two-phase protection:**
1. Planning: CRUD read methods allowed, mutations blocked by `check_mutation_allowed()`
2. Execution: All methods allowed after plan approval

```python
# In CRUD tools:
blocked = check_mutation_allowed(method)  # Returns error string during planning
if blocked:
    return blocked
```

See `tools/mutation_guard.py` and `tools/tool_modes.py`.
