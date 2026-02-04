# Skill Input Resolution + Tool Display UI

## Phase 1: Input Resolution Fix (Python)

### Fix 1: `_resolve_inputs` tolerance

**File**: `emery-agents/src/emery_agents/services/skills/step_executor.py:1445-1464`

Change `_resolve_inputs` to skip missing inputs with a warning instead of crashing. Currently it raises `ValueError` for any missing template variable. Safe because:
- Jinja2 template resolver renders undefined variables as empty string
- Matches old `_execute_agent()` behavior
- Multi-step DAGs still work (read step populates context before agentic step)

### Fix 2: LLM InputExtractor for @skill mention route

**New file**: `emery-agents/src/emery_agents/reasoning/modules/input_extractor.py`

Lightweight DSPy signature — single LLM call to extract structured inputs from user text based on the skill's input definitions. Analogous to OutputExtractorModule.

```python
class ExtractSkillInputs(dspy.Signature):
    """Extract input values from user text for a skill."""
    user_text = dspy.InputField(desc="User's message text")
    input_schema = dspy.InputField(desc="JSON skill input definitions")
    extracted_inputs = dspy.OutputField(desc="JSON dict of input_name -> value")
```

**File**: `emery-agents/src/emery_agents/grpc/skill_mention_routing.py:122-128`

Before `tool.forward()`, if `cleaned_task` has text and no inputs were parsed, call InputExtractor to resolve inputs from the user's message.

### Phase 1 files
1. `emery-agents/src/emery_agents/services/skills/step_executor.py` — `_resolve_inputs()` tolerance
2. `emery-agents/src/emery_agents/reasoning/modules/input_extractor.py` — new module
3. `emery-agents/src/emery_agents/grpc/skill_mention_routing.py` — call InputExtractor

---

## Phase 2: Tool Display UI (Frontend)

### 2A: Tool icon lookup utility

**New file**: `src/lib/utils/tool-icon-lookup.ts`

Utility that takes a tool name (e.g., `gmail_send_email`) and returns the app icon URL from the Pipedream generated config. Extracts the app prefix from the tool name, looks up in `pipedream-tools.generated.ts`, returns the app icon URL. Falls back to a default enhancd icon.

```typescript
export function getToolAppIcon(toolName: string): { iconUrl: string; appName: string } | null
```

### 2B: ToolChip component

**New file**: `src/app/(app)/agents/[agentId]/skills/components/editor/ToolChip.tsx`

Inline chip for tool references — purple themed (matching the existing skill editor style). Shows a small app icon (from 2A lookup) + tool display name. Reuses the VariableChip pattern but with:
- Purple color scheme (`bg-purple-100 text-purple-700` / dark mode equivalent)
- Small icon (12-14px) before the tool name
- Falls back to a default wrench/plug icon if no app icon found

### 2C: PlanStepCard — show toolCall in summary

**File**: `src/app/(app)/agents/[agentId]/skills/components/editor/PlanStepCard.tsx`

In the Summary tab, if `step.toolCall` exists, render it as a ToolChip inline with the description text. Currently the summary is just `<p>{step.description}</p>` — add the tool chip after or below it.

### 2D: PlanStepCard — highlight variables in summary

**File**: `src/app/(app)/agents/[agentId]/skills/components/editor/PlanStepCard.tsx`

Apply `TemplateRenderer` to the summary/description text (not just the prompt tab). If the description contains `{{ variable }}` patterns, render them as VariableChips instead of plain text.

### 2E: ToolsSection — Pipedream app icons

**File**: `src/app/(app)/agents/[agentId]/skills/components/editor/ToolsSection.tsx`

Update `getToolIcon()` to use the tool icon lookup (2A) for non-reference tools. Currently Pipedream tools get a generic `Plus` icon — replace with the actual app icon from `pipedream-tools.generated.ts`. Use `ToolIcon` component (already exists at `src/components/tools/ToolIcon.tsx`) for rendering.

### Phase 2 files
1. `src/lib/utils/tool-icon-lookup.ts` — new utility
2. `src/app/(app)/agents/[agentId]/skills/components/editor/ToolChip.tsx` — new component
3. `src/app/(app)/agents/[agentId]/skills/components/editor/PlanStepCard.tsx` — show toolCall + highlight variables in summary
4. `src/app/(app)/agents/[agentId]/skills/components/editor/ToolsSection.tsx` — Pipedream app icons

---

## Verification

**Phase 1:**
- `@skill:print-name name: LANCE` — InputExtractor resolves `{"name": "LANCE"}`, skill executes
- `@skill:print-name` (no inputs) — `_resolve_inputs` skips, no crash
- LLM-driven execution (`skill_crud(method='execute')`) — unchanged
- Multi-step DAG skills with read steps — read results still populate context

**Phase 2:**
- Skill editor shows Pipedream app icons for tools (not generic Plus icon)
- Plan step cards show toolCall as purple chip with app icon
- Plan step summaries highlight `{{ variable }}` references as colored chips
- Dark mode support for all new components
