# DSPy Patterns

Conventions for using DSPy in the reasoning layer.

## Signature Structure

Use Pydantic `BaseModel` for complex outputs, `dspy.Signature` for the I/O contract:

```python
class PlanOutput(BaseModel):
    plan_id: str = Field(description="...")
    goal: str = Field(description="...")
    steps: list[PlanStepOutput] = Field(description="...")

class CreatePlan(dspy.Signature):
    """<docstring is LLM instructions>"""

    request: str = dspy.InputField(desc="...")
    workspace_context: str = dspy.InputField(desc="...")

    result: PlanOutput = dspy.OutputField()
```

## Async LM Usage

Never use `dspy.configure(lm=...)` in async code. Use context manager:

```python
lm = get_dspy_lm(org_model=org_model)
with dspy.context(lm=lm):
    result = await asyncio.to_thread(module, **kwargs)
record_from_lm(lm, tracker)  # Track token usage
```

## Module Structure

Modules combine multiple DSPy strategies:

```python
class PlannerModule(dspy.Module):
    def __init__(self, discovery_tools: list[dspy.Tool] = None):
        self.analyzer = dspy.ChainOfThought(AnalyzeTask)
        self.planner = dspy.ReAct(CreatePlan, tools=discovery_tools)
```

See `reasoning/config.py`, `reasoning/signatures/`, `reasoning/modules/`.
