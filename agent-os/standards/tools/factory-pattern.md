# Tool Factory Pattern

DSPy ReAct only passes function signature args to tools. Auth must be captured at tool creation time.

**Per-request flow:**
1. Request arrives with api_key (user token or agent token depending on context)
2. `ToolProvider(api_key, org_id)` is created once per request
3. All tools created from provider share same auth for request duration

**Pattern:**
```python
def create_xxx_tool(api_key: str, org_id: str, extra_headers: dict | None = None) -> dspy.Tool:
    """Factory: Create tool with auth captured in closure."""

    def xxx_operation(method: str, ...) -> str:
        # api_key, org_id captured from outer scope
        return make_request(..., auth_token=api_key, org_id=org_id)

    return dspy.Tool(func=xxx_operation, name="xxx_tool", ...)
```

**Why:**
- DSPy ReAct infers tool args from function signature, doesn't support extra context
- Auth bound at construction, not exposed in tool interface
- `extra_headers` enables audit trail (agent/user context)

See `tools/provider.py` for ToolProvider and `tools/factories.py` for individual factories.
