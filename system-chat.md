# Planning Flow: Conceptual Map

---

## FULL DESIRED STATE FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER MESSAGE                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. TRIAGE                                                                  │
│  ══════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│  Pattern: KNNFewShot(TRIAGE_DEMOS) → ChainOfThought                        │
│  Demos: 26 examples teaching routing                                        │
│  Tools: NONE                                                                │
│                                                                             │
│  Output:                                                                    │
│    - execution_mode: "plan" | "direct" | "respond"                         │
│    - intent, entities, approach, external_services                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
    "respond"                    "direct"                     "plan"
    (return)                        │                            │
                                    ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  2. DSPy KNN RETRIEVAL (parallel, replaces ALL custom FAISS)              │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                            │
│  CapabilityRetriever: KNNFewShot on org's enabled capabilities (50-500)   │
│    → top-K relevant capabilities                                          │
│                                                                            │
│  PatternRetriever: KNNFewShot on PlanningRegistry                         │
│    → top-K planning patterns with strategies, step templates              │
│                                                                            │
│  KnowledgeRetriever: KNNFewShot on KnowledgeBase                          │
│    → top-K org structures, strategies, gotchas, examples                  │
│                                                                            │
│  StrategyRetriever: KNNFewShot on ACE patterns                            │
│    → top-K proven strategies from past executions                         │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  3. PLANNER                                                                │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                            │
│  Pattern: KNNFewShot(PLANNING_DEMOS) → ChainOfThought OR ReAct            │
│  Demos: 9 examples teaching plan structure                                 │
│                                                                            │
│  STANDARD (all info retrieved):                                           │
│    ChainOfThought → construct plan from retrieved context                 │
│                                                                            │
│  COMPLEX (needs external data):                                           │
│    ReAct with external tools only:                                        │
│      - workspace_overview (API)                                           │
│      - system_research (API for resource details)                         │
│      - search_external (Pipedream tool details)                           │
│      - web_search (external research)                                     │
│                                                                            │
│  Inputs (from retrievers):                                                │
│    - retrieved_capabilities                                               │
│    - retrieved_patterns                                                   │
│    - retrieved_knowledge                                                  │
│    - retrieved_strategies                                                 │
│    - triage_analysis                                                      │
│                                                                            │
│  Output: Plan with steps OR ClarifyingQuestions                           │
│                                                                            │
│  REFLEXION LOOP (2 iterations):                                           │
│    Draft → Critique → Improve → Final                                     │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  4. HITL APPROVAL                                                          │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                            │
│  await_approval_node:                                                      │
│    - Show plan to user                                                    │
│    - User approves / rejects / provides feedback                          │
│    - Clarification answers flow back to planner                           │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  5. STEP EXECUTOR (per step)                                               │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                            │
│  Pattern: KNNFewShot(TOOL_EXAMPLES) → ReAct                               │
│  Demos: 75+ examples teaching tool selection                               │
│  Tools: ALL EXECUTION TOOLS from RuntimeContext                            │
│    ├─ CRUD: table_crud, field_crud, row_crud, view_crud, app_crud         │
│    ├─ Agents: skill_executor, agent_crud                                  │
│    ├─ Integration: gmail_send_email, slack_post_message, etc.             │
│    └─ Memory: memory_crud                                                 │
│                                                                            │
│  Input: step.description (from plan)                                      │
│  Output: StepOutcome (success/failure + result + tool_calls)              │
│                                                                            │
│  NOTE: Executor gets ALL tools, not just what plan mentions               │
│        Tools come from runtime.tools (built at request start)             │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  6. REPLAN (after each step)                                               │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                            │
│  STEP REFLECTION (ReflectOnExecution):                                    │
│    - What worked? What didn't?                                            │
│    - Actionable insights for next steps                                   │
│    - Rolling summary accumulated                                          │
│                                                                            │
│  ROUTING:                                                                  │
│    ├─ Step failed → RECOVERY (auto-fix or ask user)                       │
│    ├─ More pending steps → EXECUTE next step                              │
│    └─ All steps done → GOAL EVALUATION                                    │
│                                                                            │
│  GOAL EVALUATION (EvaluateGoal):                                          │
│    Input: original_goal, plan_steps, step_results, tool_evidence          │
│    Output: GoalEvaluation {achieved: bool, reason, confidence}            │
│                                                                            │
│    ├─ Goal achieved → SYNTHESIS                                           │
│    ├─ Not achieved + replans left → NEW STEPS                             │
│    └─ Not achieved + no replans → FINISH with what we have                │
│                                                                            │
│  SYNTHESIS (SynthesizeAnswer):                                            │
│    Combine step results into coherent final answer                        │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  7. ACE FEEDBACK (if execution successful)                                 │
│  ══════════════════════════════════════════════════════════════════════════│
│                                                                            │
│  Store successful patterns:                                               │
│    - goal → approach → steps → outcome                                    │
│    - Fed back into StrategyRetriever for future tasks                     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## DEMO USAGE MAP

| Demo Set | Count | Used By | DSPy Pattern | Purpose |
|----------|-------|---------|--------------|---------|
| **TRIAGE_DEMOS** | 26 | Triage | KNNFewShot(ChainOfThought) | Routing: task → mode |
| **PLANNING_DEMOS** | 9 | Planner | KNNFewShot(ChainOfThought/ReAct) | Plan structure |
| **TOOL_EXAMPLES** | 75+ | Executor | KNNFewShot(ReAct) | Tool selection |
| **SKILL_TEMPLATE_DEMOS** | ? | SkillTemplatePlanner | KNNFewShot(ReAct) | {{ variable }} syntax |

**Current problem:** TOOL_EXAMPLES in Planner (teaches tools planner can't call)
**Fix:** Move to Executor where they belong

---

## RETRIEVER USAGE MAP

| Retriever | Data Source | Used By | Replaces |
|-----------|-------------|---------|----------|
| **CapabilityRetriever** | CapabilityRegistry (org's enabled) | Planner input | Custom FAISS search |
| **PatternRetriever** | PlanningRegistry | Planner input | Custom FAISS search |
| **KnowledgeRetriever** | KnowledgeBase | Planner input | Custom FAISS search |
| **StrategyRetriever** | ACE patterns | Planner input | Custom search |

---

## TOOL ACCESS MAP

| Component | Tools Available | Source |
|-----------|-----------------|--------|
| **Triage** | NONE | - |
| **Planner (standard)** | NONE | ChainOfThought |
| **Planner (complex)** | External only: workspace_overview, system_research, search_external, web_search | discovery.py |
| **Executor** | ALL execution tools | runtime.tools (built from org's connected integrations) |
| **Evaluator** | NONE | ChainOfThought |

---

## Current Flow (Updated: Feb 2026)

```
USER MESSAGE
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ TRIAGE (nodes/triage.py)                                        │
│                                                                 │
│ Pattern: KNNFewShot(ChainOfThought)                            │
│ Demos: TRIAGE_DEMOS (26)                                       │
│ Tools: NONE                                                     │
│                                                                 │
│ Input:  task, workspace_summary, memory_context, image_context │
│ Output: execution_mode, triage_analysis                        │
│         {intent, entities, approach, external_services}        │
└─────────────────────────────────────────────────────────────────┘
     │
     ├── "respond" → END (inline response)
     ├── "direct" → Direct Executor (ReAct with all tools)
     └── "plan" ↓

┌─────────────────────────────────────────────────────────────────┐
│ PRE-PLANNING CONTEXT (nodes/planning.py:44-108)                │
│                                                                 │
│ 1. Workspace fetch: WorkspaceAPI.get_all(org_id)               │
│ 2. Workspace filter: _filter_relevant_context()                │
│    └─> Semantic similarity with caps per resource type          │
│ 3. @mention enrichment (skill/agent/tool)                      │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ KNN RETRIEVAL (nodes/planning.py:486-537) ✅ IMPLEMENTED       │
│                                                                 │
│ CapabilityRetriever(org_id) → retrieved_capabilities           │
│ PatternRetriever() → retrieved_patterns                        │
│ KnowledgeRetriever() → retrieved_knowledge                     │
│ StrategyRetriever() → retrieved_strategies                     │
│                                                                 │
│ Note: ACE service currently None - strategies not flowing      │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ PLANNER (modules/planner.py)                                    │
│                                                                 │
│ Pattern: LabeledFewShot(PLANNING_DEMOS) → ChainOfThought/ReAct │
│ Demos: PLANNING_DEMOS only (NOT TOOL_EXAMPLES) ✅ FIXED        │
│                                                                 │
│ Tools: EXTERNAL DATA ONLY ✅ FIXED                              │
│   - system_research (API call)                                 │
│   - search_external (Pipedream tools)                          │
│   - web_search (DuckDuckGo)                                    │
│   (search_capabilities, search_planning_patterns REMOVED)      │
│                                                                 │
│ Input:                                                          │
│   - request                                                     │
│   - workspace_context (filtered JSON)                          │
│   - triage_analysis ✅ NOW USED                                 │
│   - retrieved_capabilities ✅ FROM KNN                          │
│   - retrieved_patterns ✅ FROM KNN                              │
│   - retrieved_knowledge ✅ FROM KNN                             │
│   - retrieved_strategies ✅ FROM KNN                            │
│   - conversation_history, memory_context                        │
│                                                                 │
│ Reflexion: 2 iterations (draft → critique → improve)           │
│ Output: Plan OR ClarifyingQuestions                            │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP EXECUTOR (modules/executor.py)                             │
│                                                                 │
│ Pattern: KNNFewShot(TOOL_EXAMPLES) → ReAct ✅ FIXED            │
│ Demos: TOOL_EXAMPLES (75+) - teaches tool selection            │
│ Tools: ALL EXECUTION TOOLS from RuntimeContext                  │
│   - table_crud, field_crud, row_crud                           │
│   - app_crud, page_crud, view_crud                             │
│   - skill_executor, agent_crud                                 │
│   - gmail_send_email, slack_post_message (if connected)        │
│                                                                 │
│ Input: step.description, context                                │
│ Output: StepOutcome                                             │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ REPLAN (nodes/replan.py)                                        │
│                                                                 │
│ - StepReflection: quality, insight, next_step_advice           │
│ - GoalEvaluation: achieved, confidence, reason                 │
│ - SynthesizeAnswer: combine results into final response        │
│ - Recovery: auto-fix or ask user                               │
│ - Max replans: 3                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Registries

| Registry | Data | Search Method | Status |
|----------|------|---------------|--------|
| **CapabilityRegistry** | 30K capabilities (agents, skills, integrations) | KNN Retriever (FAISS-backed) | **IMPLEMENTED** |
| **PlanningRegistry** | Planning patterns, strategies, step templates | KNN Retriever (FAISS-backed) | **IMPLEMENTED** |
| **KnowledgeBase** | Org structures, strategies, gotchas, examples | KNN Retriever (FAISS-backed) | **IMPLEMENTED** |
| **ACE Strategies** | Proven execution patterns | KNN Retriever | **PARTIAL** (ace_service=None) |
| **Pipedream Tools** | Integration tool details (gmail_send_email, etc.) | search_external tool | Unchanged |

---

## Demo Registries

| Registry | Count | Field | Used By | What It Teaches |
|----------|-------|-------|---------|-----------------|
| **TRIAGE_DEMOS** | 26 | task | Triage (classifier.py) | Routing: task → mode |
| **PLANNING_DEMOS** | 9 | request | Planner (planner.py) | Plan structure: goal, steps, phases |
| **TOOL_EXAMPLES** | 75+ | request | **Executor** (executor.py) | Tool selection: task → tool_id |
| **SKILL_TEMPLATE_DEMOS** | ~5 | request | SkillTemplatePlanner | Template syntax: {{ variables }} |

**Note:** TOOL_EXAMPLES moved from Planner to Executor (Feb 2026).

---

## Problems Identified (Status: RESOLVED)

### Problem 1: Capability Search is Wasted - **FIXED**
```
OLD: search_enabled() → get_planning_guidance() → NONE → discarded

NEW (planning.py:511-516):
  CapabilityRetriever(org_id, registry) → caps
  format_for_planner(caps) → retrieved_capabilities
  Passed to PlanService.generate_plan()
```
**Resolution:** Capabilities now flow to planner via `retrieved_capabilities` parameter.

### Problem 2: Demo Mismatch - **FIXED**
```
OLD: TOOL_EXAMPLES in Planner (but Planner can't call those tools)

NEW (planner.py docstring):
  "TOOL_EXAMPLES are NOT used here - they belong in the Executor"

  Planner: LabeledFewShot(PLANNING_DEMOS) → ChainOfThought/ReAct
  Executor: KNNFewShot(TOOL_EXAMPLES) → ReAct (executor.py:82-89)
```
**Resolution:** Demos now match module capabilities.

### Problem 3: Redundant Discovery - **FIXED**
```
OLD: Pre-planning search → discarded → Planner search_capabilities → same search

NEW (discovery.py header):
  "INTERNAL SEARCH REMOVED:
   - search_capabilities → replaced by CapabilityRetriever
   - search_planning_patterns → replaced by PatternRetriever"

  KNN retrieval happens once in planning node (lines 486-537)
  Results passed to planner as formatted strings
```
**Resolution:** Single KNN retrieval replaces redundant discovery.

### Problem 4: Triage Knows Services But Planner Re-discovers - **FIXED**
```
OLD: Triage outputs external_services, Planner ignores it

NEW (planning.py:583):
  triage_analysis passed to generate_plan()

NEW (planner.py:182-187):
  external_services = analysis_data.get("external_services", [])
  needs_external_data = use_complex_planner or bool(external_services) or ...
```
**Resolution:** Triage analysis used for routing decisions.

---

## Remaining Work

### HIGH Priority
1. **ACE Service Integration** (`planning.py:507`)
   - Currently `ace_service=None`
   - Proven strategies not being retrieved
   - Need to wire ACE service into RuntimeContext

### MEDIUM Priority
2. **Planner Routing Optimization** (`planner.py:187`)
   - `bool(self.external_tools)` condition always true if discovery tools exist
   - Consider letting triage decide routing exclusively

3. **Knowledge Base Verification**
   - Verify `runtime.knowledge_base` is initialized
   - Check KnowledgeRetriever is producing results

### LOW Priority
4. **Demo Coverage Audit**
   - Review production patterns
   - Expand examples where gaps exist
   - Consider adding more edge case demos

---

## Component Responsibilities (Current)

| Component | Responsibility | Tools |
|-----------|----------------|-------|
| **Triage** | Route to plan/direct/respond, extract analysis | NONE |
| **Pre-planning** | Gather context (workspace, capabilities, strategies) | N/A |
| **Planner** | Generate plan OR questions | Discovery only |
| **Executor** | Execute plan steps | All execution |
| **Replan** | Evaluate, recover, synthesize | N/A |

---

## Proposed Flow (DSPy Retrieval + ReAct for External)

### Principle
- **DSPy KNN Retrieval**: For internal data (capabilities, patterns, examples)
- **ReAct Tools**: Only for external data (workspace API, pipedream, web)
- **Planner ReAct**: Constructs plan, analyzes retrieved context

```
USER MESSAGE
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ TRIAGE (unchanged)                                              │
│                                                                 │
│ Pattern: KNNFewShot(ChainOfThought)                            │
│ Retrieval: TRIAGE_DEMOS via KNN                                │
│                                                                 │
│ Output: execution_mode, intent, entities, approach,            │
│         external_services                                       │
└─────────────────────────────────────────────────────────────────┘
     │
     └── "plan" ↓

┌─────────────────────────────────────────────────────────────────┐
│ DSPy KNN RETRIEVAL (replaces ALL custom FAISS search)          │
│                                                                 │
│ 1. Capabilities: KNNFewShot on CapabilityRegistry              │
│    └─> trainset: org's enabled capabilities (50-500)           │
│    └─> vectorizer: cached embedder                             │
│    └─> Output: top-K relevant capabilities                     │
│                                                                 │
│ 2. Planning Patterns: KNNFewShot on PlanningRegistry           │
│    └─> trainset: planning patterns with strategies             │
│    └─> Output: top-K relevant patterns                         │
│                                                                 │
│ 3. Knowledge: KNNFewShot on KnowledgeBase                      │
│    └─> trainset: org structures, strategies, gotchas           │
│    └─> Output: top-K relevant knowledge items                  │
│                                                                 │
│ 4. Strategies: KNNFewShot on ACE patterns                      │
│    └─> trainset: proven strategies                             │
│    └─> Output: top-K relevant strategies                       │
│                                                                 │
│ 5. Planning Examples: KNNFewShot on PLANNING_DEMOS             │
│    └─> Already done inside PlannerModule                       │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ PLANNER (ReAct for external data + plan construction)          │
│                                                                 │
│ Pattern: KNNFewShot(ReAct)                                     │
│ Demos: PLANNING_DEMOS (via KNN)                                │
│                                                                 │
│ Tools (EXTERNAL DATA ONLY):                                    │
│   - workspace_overview (API call)                              │
│   - system_research (API call for details)                     │
│   - search_external (Pipedream tool details)                   │
│   - web_search (external research)                             │
│                                                                 │
│ NO LONGER NEEDED (replaced by KNN retrieval):                  │
│   - search_capabilities ❌ (KNN on CapabilityRegistry)         │
│   - search_planning_patterns ❌ (KNN on PlanningRegistry)      │
│                                                                 │
│ Input:                                                          │
│   - request                                                     │
│   - retrieved_capabilities (from KNN)                          │
│   - retrieved_patterns (from KNN)                              │
│   - retrieved_strategies (from KNN)                            │
│   - triage_analysis                                             │
│   - conversation_history                                        │
│                                                                 │
│ ReAct does:                                                     │
│   - Analyze inputs, intent, retrieved examples                 │
│   - Call external tools for workspace/integration details      │
│   - Construct plan steps                                        │
│                                                                 │
│ Output: Plan OR ClarifyingQuestions                            │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP EXECUTOR                                                   │
│                                                                 │
│ Pattern: KNNFewShot(ReAct)                                     │
│ Demos: TOOL_EXAMPLES (via KNN)                                 │
│ Tools: ALL EXECUTION TOOLS                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### Decision 1: DSPy KNN for ALL Internal Retrieval (remove custom FAISS)
**Problem:** Custom FAISS search in CapabilityRegistry, PlanningRegistry, KnowledgeBase.
**Fix:** Use DSPy KNNFewShot for all internal retrieval.

```python
# Replace ALL custom FAISS with DSPy KNN:

class CapabilityRetriever(dspy.Module):
    def __init__(self, org_id: str, registry: CapabilityRegistry):
        enabled = registry.get_enabled(org_id)  # 50-500 caps
        examples = [cap_to_example(cap) for cap in enabled]
        embedder = create_cached_dspy_embedder(examples, field="description")
        self.knn = KNNFewShot(k=5, trainset=examples, vectorizer=embedder)

    def forward(self, task: str) -> list[Capability]:
        return self.knn(task=task).demos

class PatternRetriever(dspy.Module):
    def __init__(self, registry: PlanningRegistry):
        patterns = registry.all()
        examples = [pattern_to_example(p) for p in patterns]
        embedder = create_cached_dspy_embedder(examples, field="description")
        self.knn = KNNFewShot(k=3, trainset=examples, vectorizer=embedder)

    def forward(self, task: str) -> list[PlanningPattern]:
        return self.knn(task=task).demos

class KnowledgeRetriever(dspy.Module):
    def __init__(self, kb: KnowledgeBase):
        items = list(kb.items.values())
        examples = [knowledge_to_example(item) for item in items]
        embedder = create_cached_dspy_embedder(examples, field="content")
        self.knn = KNNFewShot(k=5, trainset=examples, vectorizer=embedder)

    def forward(self, task: str) -> list[KnowledgeItem]:
        return self.knn(task=task).demos
```

### Decision 2: ReAct Tools = External Data Only
**Problem:** Planner has tools for both internal search and external data.
**Fix:** Tools only for external data sources.

| Tool | Type | Keep? |
|------|------|-------|
| search_capabilities | Internal search | ❌ Replace with KNN |
| search_planning_patterns | Internal search | ❌ Replace with KNN |
| workspace_overview | External API | ✓ |
| system_research | External API | ✓ |
| search_external | External (Pipedream) | ✓ |
| web_search | External (web) | ✓ |

### Decision 3: Move TOOL_EXAMPLES to Executor
**Problem:** Demos teach execution tools, planner has discovery tools.
**Fix:** TOOL_EXAMPLES trains executor via KNN.

```python
# Planner:
planner = KNNFewShot(trainset=PLANNING_DEMOS).compile(ReAct(...))

# Executor:
executor = KNNFewShot(trainset=TOOL_EXAMPLES).compile(ReAct(...))
```

### Decision 4: Standard vs Complex Routing
**Standard:** All info retrieved upfront → ChainOfThought (no tools)
**Complex:** Needs external data during planning → ReAct with external tools

```python
# Standard: ChainOfThought with retrieved context
if has_all_context(retrieved_capabilities, retrieved_patterns, retrieved_knowledge):
    planner = KNNFewShot(PLANNING_DEMOS).compile(ChainOfThought(CreatePlan))

# Complex: ReAct for external research (web, workspace, integrations)
else:
    planner = KNNFewShot(PLANNING_DEMOS).compile(ReAct(CreatePlan, tools=external_tools))
```

### Decision 5: Planner Receives Retrieved Context
**Problem:** Planner re-discovers what KNN already found.
**Fix:** Pass KNN results as input fields.

```python
class CreatePlan(dspy.Signature):
    request: str = dspy.InputField()
    retrieved_capabilities: list[Capability] = dspy.InputField()  # From KNN
    retrieved_patterns: list[PlanningPattern] = dspy.InputField()  # From KNN
    retrieved_knowledge: list[KnowledgeItem] = dspy.InputField()  # From KNN
    # ... existing fields

    plan: PlanOutput = dspy.OutputField()
```

---

## Component Responsibilities (Proposed)

| Component | Responsibility | DSPy Pattern |
|-----------|----------------|--------------|
| **Triage** | Route + extract metadata | KNNFewShot(ChainOfThought) |
| **CapabilityRetriever** | Find relevant capabilities | KNNFewShot on registry |
| **PatternRetriever** | Find relevant planning patterns | KNNFewShot on registry |
| **KnowledgeRetriever** | Find org structures, strategies, gotchas | KNNFewShot on knowledge base |
| **StrategyRetriever** | Find proven strategies | KNNFewShot on ACE |
| **Planner (standard)** | Construct plan from retrieved context | KNNFewShot(ChainOfThought) |
| **Planner (complex)** | Construct plan needing external data | KNNFewShot(ReAct) + external tools |
| **Executor** | Execute plan steps | KNNFewShot(ReAct) |
| **Replan** | Evaluate + adjust | ChainOfThought |

---

## COMPLETE DATA FLOW (with all state)

```
═══════════════════════════════════════════════════════════════════════════════
TASK: "Build a CRM for a marketing agency"
═══════════════════════════════════════════════════════════════════════════════

                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRIAGE                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PATTERN: KNNFewShot(TRIAGE_DEMOS, k=5) → ChainOfThought(TriageTask)       │
│                                                                             │
│  INPUTS:                                                                    │
│    task: "Build a CRM for a marketing agency"                              │
│    workspace_summary: "2 tables, 1 app, 3 skills"                          │
│    memory_context: "User prefers simple schemas"                           │
│    image_context: ""                                                        │
│                                                                             │
│  KNN RETRIEVES (from TRIAGE_DEMOS):                                        │
│    [                                                                        │
│      Example("Build me a CRM" → mode="plan", approach="systems-thinking"), │
│      Example("Create an app" → mode="plan", approach="step-by-step"),      │
│      ...                                                                    │
│    ]                                                                        │
│                                                                             │
│  OUTPUTS:                                                                   │
│    execution_mode: "plan"                                                   │
│    intent: "Create CRM for marketing agency"                               │
│    entities: ["CRM", "marketing agency", "contacts", "deals"]              │
│    approach: "systems-thinking"                                             │
│    external_services: []  (no integrations needed)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DSPy KNN RETRIEVAL (parallel)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CapabilityRetriever(task, org_id):                                        │
│    PATTERN: KNNFewShot on org's enabled capabilities                       │
│    INPUT: "Build a CRM for a marketing agency"                             │
│    TRAINSET: [Capability(schema_builder), Capability(app_builder), ...]    │
│    OUTPUT: [                                                                │
│      Capability(id="agent:schema_builder", desc="Creates tables/fields"),  │
│      Capability(id="agent:app_builder", desc="Creates apps/dashboards"),   │
│      Capability(id="agent:view_builder", desc="Creates data views"),       │
│    ]                                                                        │
│                                                                             │
│  PatternRetriever(task):                                                   │
│    PATTERN: KNNFewShot on PlanningRegistry                                 │
│    INPUT: "Build a CRM for a marketing agency"                             │
│    TRAINSET: [Pattern(multi_capability), Pattern(schema_design), ...]      │
│    OUTPUT: [                                                                │
│      Pattern(id="multi_capability_plan",                                   │
│              strategy="1. Data schema first 2. App structure 3. Views",    │
│              step_templates=["Create {entity} table", "Build {app}"]),     │
│    ]                                                                        │
│                                                                             │
│  KnowledgeRetriever(task):                                                 │
│    PATTERN: KNNFewShot on KnowledgeBase                                    │
│    INPUT: "Build a CRM for a marketing agency"                             │
│    TRAINSET: [Knowledge(crm_structure), Knowledge(agency), ...]            │
│    OUTPUT: [                                                                │
│      Knowledge(type=PATTERN, title="CRM Organization",                     │
│                content="Contacts, Companies, Deals, Activities tables"),   │
│      Knowledge(type=STRATEGY, title="Agency Schema",                       │
│                content="Clients, Projects, Campaigns, Assets tables"),     │
│    ]                                                                        │
│                                                                             │
│  StrategyRetriever(task):                                                  │
│    PATTERN: KNNFewShot on ACE proven patterns                              │
│    INPUT: "Build a CRM for a marketing agency"                             │
│    OUTPUT: [                                                                │
│      Strategy(goal="Build CRM", approach="schema-first",                   │
│               steps=["1. Contacts table", "2. Deals table", "3. App"]),    │
│    ]                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLANNER                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ROUTING: approach="systems-thinking" → COMPLEX (use ReAct)                │
│           approach="step-by-step" + all context → STANDARD (ChainOfThought)│
│                                                                             │
│  PATTERN: KNNFewShot(PLANNING_DEMOS, k=5) → ReAct(CreatePlan)              │
│                                                                             │
│  KNN RETRIEVES (from PLANNING_DEMOS):                                      │
│    [                                                                        │
│      Example("Build me a CRM" → Plan(goal, [schema→app→views])),           │
│      Example("Create database for ..." → Plan(...)),                       │
│      ...                                                                    │
│    ]                                                                        │
│                                                                             │
│  INPUTS (all from retrieval):                                              │
│    request: "Build a CRM for a marketing agency"                           │
│    retrieved_capabilities: [schema_builder, app_builder, view_builder]     │
│    retrieved_patterns: [multi_capability_plan]                             │
│    retrieved_knowledge: [crm_org_structure, agency_schema]                 │
│    retrieved_strategies: [schema_first]                                    │
│    triage_analysis: {intent, entities, approach, external_services}        │
│                                                                             │
│  TOOLS (external data only):                                               │
│    - workspace_overview() → "2 tables: users, settings"                    │
│    - system_research(tables) → field details                               │
│    - web_search("marketing agency CRM best practices")                     │
│    (NO search_capabilities, search_planning_patterns - already retrieved!) │
│                                                                             │
│  REFLEXION LOOP (2 iterations):                                            │
│    Draft plan → Critique → Improve → Final                                 │
│                                                                             │
│  OUTPUT:                                                                    │
│    Plan(                                                                    │
│      goal="Create CRM for marketing agency",                               │
│      analysis="Multi-table schema with contacts, deals, campaigns...",     │
│      steps=[                                                                │
│        Step(1, "Create Contacts table", target="schema_builder"),          │
│        Step(2, "Create Companies table", target="schema_builder"),         │
│        Step(3, "Create Deals table", target="schema_builder"),             │
│        Step(4, "Create Campaigns table", target="schema_builder"),         │
│        Step(5, "Build CRM Dashboard app", target="app_builder"),           │
│        Step(6, "Create contact list view", target="view_builder"),         │
│      ],                                                                     │
│      auto_approve_policy="confirm",                                         │
│    )                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  HITL APPROVAL                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User sees plan → Approves                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP EXECUTOR (Step 1: Create Contacts table)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PATTERN: KNNFewShot(TOOL_EXAMPLES, k=5) → ReAct(ExecuteStep)              │
│                                                                             │
│  KNN RETRIEVES (from TOOL_EXAMPLES):                                       │
│    [                                                                        │
│      Example("Create users table" → tool=table_crud, action=create),       │
│      Example("Add email field" → tool=field_crud, action=create),          │
│      ...                                                                    │
│    ]                                                                        │
│                                                                             │
│  INPUTS:                                                                    │
│    step_description: "Create Contacts table with name, email, phone..."    │
│    context: {workspace, previous_results}                                  │
│                                                                             │
│  TOOLS (ALL execution tools from runtime):                                 │
│    ├─ table_crud(action=create, name="Contacts")                           │
│    ├─ field_crud(action=create, table_id=X, name="name", type="text")      │
│    ├─ field_crud(action=create, table_id=X, name="email", type="email")    │
│    └─ ... (has access to ALL tools, picks what step needs)                 │
│                                                                             │
│  OUTPUT:                                                                    │
│    StepOutcome(                                                             │
│      success=True,                                                          │
│      summary="Created Contacts table with 5 fields",                        │
│      tool_calls=[{table_crud, create}, {field_crud, create}, ...]          │
│    )                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  REPLAN (after Step 1)                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP REFLECTION:                                                          │
│    Input: step_description, step_result, tool_evidence, plan_goal          │
│    Output: StepReflection(                                                  │
│      quality="good",                                                        │
│      insight="Contacts table created, used 5 field_crud calls",            │
│      next_step_advice="Companies table should link to Contacts",           │
│    )                                                                        │
│                                                                             │
│  ROUTING:                                                                   │
│    ├─ Step succeeded + more pending → EXECUTE Step 2                       │
│                                                                             │
│  STATE UPDATE:                                                              │
│    step_outcomes["step_1"] = StepOutcome(...)                              │
│    step_reflections["step_1"] = StepReflection(...)                        │
│    reflection_summary += "Step 1: Contacts table created"                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                    (Execute Step 2, 3, 4, 5, 6...)
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  REPLAN (after all steps)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GOAL EVALUATION:                                                          │
│    Input:                                                                   │
│      original_goal: "Create CRM for marketing agency"                      │
│      plan_steps: [all 6 step descriptions]                                 │
│      step_results: [all 6 step results]                                    │
│      tool_evidence: [all tool calls with outputs]                          │
│                                                                             │
│    Output: GoalEvaluation(                                                  │
│      achieved=True,                                                         │
│      confidence=0.95,                                                       │
│      reason="All tables created, app built, views configured",             │
│    )                                                                        │
│                                                                             │
│  SYNTHESIS:                                                                 │
│    Input: goal, all_step_results, reflection_summary                       │
│    Output: "I've created a complete CRM for your marketing agency:         │
│             - Contacts, Companies, Deals, Campaigns tables                 │
│             - CRM Dashboard app with navigation                            │
│             - Contact list view                                            │
│             You can access it at [link]"                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ACE FEEDBACK                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Store successful pattern:                                                 │
│    goal: "Create CRM for marketing agency"                                 │
│    approach: "schema-first"                                                │
│    steps: [schema_builder x4 → app_builder x1 → view_builder x1]           │
│    outcome: success                                                         │
│    → Available to StrategyRetriever for future CRM tasks                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
EXAMPLE 2: TASK WITH EXTERNAL INTEGRATION
═══════════════════════════════════════════════════════════════════════════════

TASK: "Send email to all new leads this week"

┌─────────────────────────────────────────────────────────────────────────────┐
│  TRIAGE OUTPUT                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  execution_mode: "plan"                                                     │
│  external_services: ["gmail"]  ← Identified integration needed             │
│  approach: "step-by-step"                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DSPy KNN RETRIEVAL                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CapabilityRetriever → [Capability(gmail), Capability(row_crud)]           │
│  PatternRetriever → [Pattern(external_integration)]                        │
│  KnowledgeRetriever → [Knowledge(email_automation)]                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLANNER (COMPLEX - needs external tool details)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ReAct iteration 1:                                                        │
│    Thought: "Gmail capability retrieved. Need exact tool names."           │
│    Action: search_external(service="gmail")                                │
│    Result: [gmail_send_email(to, subject, body, cc, bcc), ...]             │
│                                                                             │
│  ReAct iteration 2:                                                        │
│    Thought: "Need to know leads table structure."                          │
│    Action: system_research(resource_type="tables", query="leads")          │
│    Result: {name: "leads", fields: [email, created_at, status]}            │
│                                                                             │
│  ReAct iteration 3:                                                        │
│    Thought: "Have all info. Constructing plan."                            │
│    Action: finish(plan=...)                                                │
│                                                                             │
│  OUTPUT:                                                                    │
│    Plan(                                                                    │
│      steps=[                                                                │
│        Step(1, "Query leads table for new leads this week"),               │
│        Step(2, "Send email via gmail_send_email to each lead",             │
│              connection_required="gmail"),  ← Needs OAuth                  │
│      ]                                                                      │
│    )                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP EXECUTOR (Step 2: Send emails)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  KNN RETRIEVES (from TOOL_EXAMPLES):                                       │
│    [                                                                        │
│      Example("Send email to team" → tool=gmail_send_email),                │
│      Example("Email the customer" → tool=gmail_send_email),                │
│    ]                                                                        │
│                                                                             │
│  TOOLS (from runtime - built from org's connected integrations):           │
│    gmail_send_email(to, subject, body)  ← Only if Gmail OAuth connected   │
│    row_crud(action=read, filters=...)                                      │
│                                                                             │
│  ReAct:                                                                     │
│    Action: gmail_send_email(to="lead1@example.com", subject="...")         │
│    Action: gmail_send_email(to="lead2@example.com", subject="...")         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify (Status: Feb 2026)

| File | Original Plan | Status |
|------|---------------|--------|
| `reasoning/modules/retrievers.py` | CREATE: CapabilityRetriever, PatternRetriever, etc. | **DONE** |
| `reasoning/modules/planner.py` | MODIFY: Use retrievers, remove internal search tools | **DONE** |
| `reasoning/modules/executor.py` | MODIFY: Add KNNFewShot with TOOL_EXAMPLES | **DONE** |
| `reasoning/signatures/planning.py` | MODIFY: Add retrieved_* input fields | **DONE** |
| `orchestrators/nodes/planning.py` | MODIFY: Call retrievers before planner | **DONE** |
| `tools/discovery.py` | MODIFY: Remove internal search tools | **DONE** |
| `tools/capability_registry.py` | MODIFY: Remove custom FAISS search | Unchanged (search method still exists for other uses) |
| `planning/registry.py` | MODIFY: Remove custom FAISS search | Unchanged (registry structure intact) |
| `knowledge/base.py` | MODIFY: Remove custom FAISS search | Unchanged (base structure intact) |

---

## What Got Changed

| Previous State | Current State |
|----------------|---------------|
| Custom FAISS in modules | DSPy Embeddings (FAISS-backed) via retrievers.py |
| Planner calls search_* tools | KNN retrieval in planning node, results passed to planner |
| TOOL_EXAMPLES in planner | TOOL_EXAMPLES in executor via KNNFewShot |
| Triage analysis discarded | Triage analysis passed to planner, used for routing |
| Capability guidance = ROUTING_HEADER only | Retrieved capabilities formatted and passed to planner |


---

## Architecture Dependency Graph

```
                    ┌─────────────────┐
                    │   Orchestration │
                    │   (LangGraph)   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐        ┌─────────┐         ┌──────────┐
    │ Triage  │        │ Planner │         │ Executor │
    │ Node    │        │ Node    │         │ Node     │
    └────┬────┘        └────┬────┘         └────┬─────┘
         │                  │                   │
         ▼                  ▼                   ▼
    ┌─────────┐        ┌─────────┐         ┌──────────┐
    │Classifier│       │PlannerMod│        │ExecutorMod│
    │Module    │       │+ Retrievers       │+ KNNFewShot│
    └────┬────┘        └────┬────┘         └────┬─────┘
         │                  │                   │
         ▼                  ▼                   ▼
    ┌─────────────────────────────────────────────────┐
    │                    Examples                      │
    │ TRIAGE_DEMOS | PLANNING_DEMOS | TOOL_EXAMPLES   │
    └────────────────────────┬────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────┐
    │            Embedding Infrastructure              │
    │       (DSPy Embedder, FAISS, Gemini API)        │
    └────────────────────────┬────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────┐
    │               Data Registries                    │
    │  CapabilityRegistry | PlanningRegistry | KB     │
    └─────────────────────────────────────────────────┘
```

---

## FAQ / Notes

**Q: Does KNN happen on workspace retrieval?**
A: No. Workspace filtering uses `_filter_relevant_context()` with semantic embeddings (same embedding service), but not the KNNFewShot pattern. It's a simple top-N by cosine similarity approach with per-resource-type caps.

**Q: Why is ACE service not wired?**
A: Deferred for future implementation. The StrategyRetriever is ready but `ace_service=None` in planning.py:507.

---

*Last updated: February 2026*