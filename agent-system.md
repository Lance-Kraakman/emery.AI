# Agent System Architecture

Deep-dive documentation on how the agent system works, including DSPy modules,
signatures, data flows, tool filtering, and the Agent Engine.

---

# AGENT ENGINE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT ENGINE                                        │
│                                                                                  │
│  File: emery-agents/src/emery_agents/engine/engine.py                           │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                           INITIALIZATION                                     ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                              ││
│  │  AgentEngine(                                                                ││
│  │      workspace_id: str,      # Unique ID (user/agent/session)               ││
│  │      workspace_type: str,    # "agents" | "users" | "sessions"              ││
│  │      base_path: Path,        # Root path (from WORKSPACE_STORAGE_PATH)       ││
│  │  )                                                                           ││
│  │       │                                                                      ││
│  │       ▼                                                                      ││
│  │  engine.initialize()                                                         ││
│  │       │                                                                      ││
│  │       ├── paths.ensure_structure()    # Create directory tree               ││
│  │       └── paths.fix_permissions()     # Set 0o700 mode                      ││
│  │                                                                              ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      LAZY-LOADED SERVICES                                    ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                              ││
│  │  engine.memory ────────────▶ MemoryService                                  ││
│  │       │                          │                                           ││
│  │       │                          ├── ChromaDB in .engine/memory/chroma/     ││
│  │       │                          ├── mem0 MemoryConfig                       ││
│  │       │                          ├── PII filtering for "agents" type        ││
│  │       │                          └── add(), search(), get_all(), delete()   ││
│  │       │                                                                      ││
│  │  engine.plans ─────────────▶ PlanFileRepository                             ││
│  │       │                          │                                           ││
│  │       │                          ├── JSON files in .engine/plans/           ││
│  │       │                          ├── Persisted via S3 WorkspaceSync         ││
│  │       │                          └── save(), load(), list_plans()           ││
│  │       │                                                                      ││
│  │  engine.sandbox ───────────▶ GVisorExecutor                                 ││
│  │       │                          │                                           ││
│  │       │                          ├── gVisor runsc with ptrace platform      ││
│  │       │                          ├── Sentry user-space kernel               ││
│  │       │                          ├── Filtered proxy (blocks private IPs)    ││
│  │       │                          └── execute(command, timeout=300)          ││
│  │       │                                                                      ││
│  │  engine.ace ───────────────▶ StrategyAccumulationService                    ││
│  │       │                          │                                           ││
│  │       │                          ├── ACE pattern (Agentic Context Eng.)     ││
│  │       │                          ├── DSPy ChainOfThought(RankStrategies)    ││
│  │       │                          ├── Storage: .engine/strategies.json       ││
│  │       │                          └── record(), retrieve()                   ││
│  │       │                                                                      ││
│  │  engine.planner ───────────▶ PlanService                                    ││
│  │                                  │                                           ││
│  │                                  ├── DSPyPlanGenerator                       ││
│  │                                  ├── PlannerModule (ChainOfThought/ReAct)   ││
│  │                                  └── generate_plan()                        ││
│  │                                                                              ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

DIRECTORY STRUCTURE (created by EnginePaths):
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  {workspace_id}/                                                                 │
│  ├── .engine/                          # Internal engine state                  │
│  │   ├── memory/chroma/                # ChromaDB embeddings (mem0)             │
│  │   ├── plans/                        # Session plan JSON files                │
│  │   ├── strategies.json               # ACE strategy registry                  │
│  │   └── config.json                   # Engine config (future)                 │
│  └── [user-created files]              # Agent/user workspace                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# ENGINE LIFECYCLE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ENGINE LIFECYCLE                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. CREATION (CoordinatorExecutor)                                              │
│  ─────────────────────────────────                                              │
│                                                                                  │
│     CoordinatorRequest                                                          │
│          │                                                                       │
│          ▼                                                                       │
│     Determine workspace_path                                                     │
│          │                                                                       │
│          ├── request.workspace_path provided?                                   │
│          │       │                                                               │
│          │       ├── YES: Use request.workspace_path                            │
│          │       │                                                               │
│          │       └── NO: WORKSPACE_STORAGE_PATH / org_id / "sessions" / thread  │
│          │                                                                       │
│          ▼                                                                       │
│     engine = AgentEngine(workspace_id, workspace_type, base_path)               │
│          │                                                                       │
│          ▼                                                                       │
│     engine.initialize()                                                          │
│                                                                                  │
│                                                                                  │
│  2. EMBEDDING IN RUNTIME                                                        │
│  ─────────────────────────                                                      │
│                                                                                  │
│     RuntimeContext(                                                              │
│         engine=engine,           # AgentEngine instance                         │
│         tools=tools,             # List of dspy.Tool                            │
│         api_key=api_key,         # Auth for tool calls                          │
│         org_id=org_id,           # Organization context                         │
│         org_model=org_model,     # Model override (if any)                      │
│         workspace_api=...,       # WorkspaceAPI service                         │
│         ...                                                                      │
│     )                                                                            │
│          │                                                                       │
│          ▼                                                                       │
│     Passed to LangGraph nodes via closure                                        │
│                                                                                  │
│                                                                                  │
│  3. USAGE IN GRAPH NODES                                                        │
│  ────────────────────────                                                       │
│                                                                                  │
│     generate_plan_node:                                                          │
│          │                                                                       │
│          ├── runtime.engine.ace.retrieve(goal)      # Get proven strategies    │
│          ├── runtime.engine.memory.search(query)    # Get relevant memories    │
│          └── runtime.engine.planner.generate(...)   # Create plan              │
│                                                                                  │
│     execute_step_node:                                                           │
│          │                                                                       │
│          ├── runtime.engine.sandbox.execute(cmd)    # Run code safely          │
│          └── runtime.engine.plans.save(plan)        # Persist plan state       │
│                                                                                  │
│                                                                                  │
│  4. CLEANUP                                                                      │
│  ──────────                                                                      │
│                                                                                  │
│     with AgentEngine(...) as engine:                                            │
│         ...                                                                      │
│     # __exit__ called automatically                                             │
│          │                                                                       │
│          ├── Set all service refs to None                                       │
│          ├── Reset _initialized flag                                            │
│          └── Log cleanup completion                                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# DSPY MODULES OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DSPY MODULE ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         CLASSIFICATION                                     │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  TaskClassifierModule                                                      │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  dspy.ChainOfThought(ClassifyTask)                                        │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Output: TaskClassificationResult                                         │  │
│  │       ├── mode: DIRECT | PLAN_AND_APPROVE                                 │  │
│  │       ├── complexity: simple | medium | complex                           │  │
│  │       ├── estimated_steps: 1-20                                           │  │
│  │       └── needs_clarification: bool                                       │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           TRIAGE                                           │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  Triage (in triage_node)                                                   │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  KNNFewShot(k=5, trainset=TRIAGE_DEMOS, vectorizer=embedder)              │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  dspy.ChainOfThought(TriageTask)                                          │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Output:                                                                   │  │
│  │       ├── execution_mode: "direct" | "plan" | "respond"                   │  │
│  │       ├── reasoning: str                                                  │  │
│  │       ├── intent: str (one-sentence goal)                                 │  │
│  │       ├── entities: list[str]                                             │  │
│  │       ├── approach: str                                                   │  │
│  │       ├── external_services: list[str]                                    │  │
│  │       └── record_context: RecordContext (table_id, record_ids)            │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                          PLANNING                                          │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  PlannerModule                                                             │  │
│  │       │                                                                    │  │
│  │       ├── STANDARD MODE (no external tools):                              │  │
│  │       │       │                                                            │  │
│  │       │       ▼                                                            │  │
│  │       │   LabeledFewShot(k=5).compile(                                    │  │
│  │       │       ChainOfThought(CreatePlan)                                  │  │
│  │       │   )                                                                │  │
│  │       │                                                                    │  │
│  │       └── COMPLEX MODE (with discovery tools):                            │  │
│  │               │                                                            │  │
│  │               ▼                                                            │  │
│  │           dspy.ReAct(CreatePlan, tools=discovery_tools, max_iters=4)      │  │
│  │                                                                            │  │
│  │  CreatePlan / CreatePlanAutonomous                                        │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Inputs:                                                                   │  │
│  │       ├── request: str                                                    │  │
│  │       ├── workspace_context: str (JSON of resources)                     │  │
│  │       ├── planning_context: str (analysis + strategies + memories)       │  │
│  │       ├── conversation_history: str                                      │  │
│  │       └── configured_tools: str (JSON of tool configs)                   │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Output: PlanOrQuestionsOutput                                            │  │
│  │       ├── plan: PlanOutput (if ready)                                    │  │
│  │       │       ├── plan_id: str                                           │  │
│  │       │       ├── goal: str                                              │  │
│  │       │       ├── context: str                                           │  │
│  │       │       ├── analysis: str                                          │  │
│  │       │       ├── steps: list[PlanStepOutput]                           │  │
│  │       │       ├── auto_approve_policy: str                              │  │
│  │       │       └── matched_conditions: list[str]                         │  │
│  │       │                                                                    │  │
│  │       └── questions: list[ClarifyingQuestionOutput] (if needs input)    │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                          EXECUTION                                         │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  ExecutorModule                                                            │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  KNNFewShot(k=5, trainset=TOOL_EXAMPLES, vectorizer=embedder).compile(    │  │
│  │       dspy.ReAct(                                                         │  │
│  │           "step_description, context -> result",                          │  │
│  │           tools=execution_tools + [finish_tool],                          │  │
│  │           max_iters=10                                                    │  │
│  │       )                                                                    │  │
│  │  )                                                                         │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Inputs:                                                                   │  │
│  │       ├── step_description: str (self-contained instruction)             │  │
│  │       └── context: str (JSON of execution context)                       │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Output: str (result of step execution)                                   │  │
│  │                                                                            │  │
│  │  DirectExecutorModule (for DIRECT mode)                                   │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  dspy.Refine(                                                             │  │
│  │       threshold=0.8,                                                      │  │
│  │       reward_fn=direct_execution_reward                                   │  │
│  │  )(                                                                        │  │
│  │       KNNFewShot(...).compile(ReAct(DirectExecution, tools, max_iters))   │  │
│  │  )                                                                         │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         EVALUATION                                         │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  EvaluatorModule                                                           │  │
│  │       │                                                                    │  │
│  │       ├── evaluate_goal():                                                │  │
│  │       │       ChainOfThought(EvaluateGoal)                                │  │
│  │       │            ▼                                                       │  │
│  │       │       Output: GoalEvaluation                                      │  │
│  │       │            ├── achieved: bool                                     │  │
│  │       │            ├── confidence: float                                  │  │
│  │       │            ├── completed_items: list[str]                        │  │
│  │       │            ├── remaining_items: list[str]                        │  │
│  │       │            ├── blockers: list[str]                               │  │
│  │       │            └── next_steps: list[str]                             │  │
│  │       │                                                                    │  │
│  │       ├── analyze_recovery():                                             │  │
│  │       │       ChainOfThought(AnalyzeRecovery)                             │  │
│  │       │            ▼                                                       │  │
│  │       │       Output: RecoveryAction                                      │  │
│  │       │            ├── action_type: retry|skip|replan|escalate           │  │
│  │       │            ├── confidence: float                                  │  │
│  │       │            ├── corrected_parameters: dict                        │  │
│  │       │            └── reasoning: str                                     │  │
│  │       │                                                                    │  │
│  │       └── synthesize_answer():                                            │  │
│  │               ChainOfThought(SynthesizeAnswer)                            │  │
│  │                    ▼                                                       │  │
│  │               Output: str (user-facing summary)                           │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                       OUTPUT EXTRACTION                                    │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  OutputExtractorModule                                                     │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  create_extraction_signature(skill_outputs)                               │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Dynamic Pydantic model created from skill output definitions             │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  ChainOfThought(ExtractOutputs[dynamic])                                  │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Inputs:                                                                   │  │
│  │       └── content: str (execution result to extract from)                │  │
│  │       │                                                                    │  │
│  │       ▼                                                                    │  │
│  │  Output: Typed dict matching skill output schema                          │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# SIGNATURE DATA FLOWS

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PLANNING SIGNATURE FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  User Request: "Create a contacts table with name, email, phone"                │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ TriageTask                                                                   ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   task: "Create a contacts table with name, email, phone"                   ││
│  │   workspace_context: '{"tables": [...], "apps": [...]}'                     ││
│  │   memory_context: "User prefers snake_case naming"                          ││
│  │   image_context: ""                                                          ││
│  │                                                                              ││
│  │ OUTPUT:                                                                      ││
│  │   execution_mode: "plan"                                                     ││
│  │   reasoning: "Multi-step task requiring schema design"                      ││
│  │   intent: "Create table with 3 fields"                                      ││
│  │   entities: ["contacts", "name", "email", "phone"]                          ││
│  │   approach: "step-by-step"                                                  ││
│  │   external_services: []                                                     ││
│  │   record_context: null                                                       ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼ execution_mode="plan"                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ CreatePlan                                                                   ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   request: "Create a contacts table with name, email, phone"                ││
│  │   workspace_context: '{"databases": [{"id": 1, "name": "Main"}], ...}'     ││
│  │   planning_context: |                                                       ││
│  │     ## Task Analysis                                                         ││
│  │     Intent: Create table with 3 fields                                       ││
│  │     Entities: contacts, name, email, phone                                   ││
│  │                                                                              ││
│  │     ## Proven Strategies                                                     ││
│  │     - Table creation: use table_crud with create method                     ││
│  │                                                                              ││
│  │     ## Memory Context                                                        ││
│  │     - User prefers snake_case naming                                        ││
│  │   conversation_history: ""                                                   ││
│  │   configured_tools: '["table_crud", "field_crud"]'                          ││
│  │                                                                              ││
│  │ OUTPUT:                                                                      ││
│  │   plan:                                                                      ││
│  │     plan_id: "plan_create_contacts"                                         ││
│  │     goal: "Create contacts table with name, email, phone fields"            ││
│  │     context: "Main database exists. No existing contacts table."            ││
│  │     analysis: "Single table creation with 3 explicit fields."               ││
│  │     steps:                                                                   ││
│  │       - step_id: "step_1_create_table"                                      ││
│  │         description: 'Create table "contacts" in database 1 with fields:   ││
│  │                       name (text), email (email), phone (phone).'           ││
│  │         tool_call: "table_crud"                                             ││
│  │         parameters: {method: "create", database_id: 1, ...}                 ││
│  │         phase_name: "Execution"                                              ││
│  │         phase_order: 1                                                       ││
│  │     auto_approve_policy: "auto"                                             ││
│  │     matched_conditions: ["single_resource", "explicit_values"]              ││
│  │   questions: null                                                            ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼ (auto_approve_policy="auto" + conditions met)                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ ExecutorModule (ReAct)                                                       ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   step_description: 'Create table "contacts" in database 1 with fields:    ││
│  │                      name (text), email (email), phone (phone).'            ││
│  │   context: '{"workspace": {...}, "previous_results": []}'                   ││
│  │                                                                              ││
│  │ REACT LOOP:                                                                  ││
│  │   Thought: Need to call table_crud with create method                       ││
│  │   Action: table_crud(method="create", database_id=1, ...)                   ││
│  │   Observation: {"success": true, "table_id": 42}                            ││
│  │   Thought: Table created successfully                                        ││
│  │   Action: finish()                                                           ││
│  │                                                                              ││
│  │ OUTPUT:                                                                      ││
│  │   result: 'Created table "contacts" (id: 42) with 3 fields.'               ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ EvaluateGoal                                                                 ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   original_goal: "Create contacts table with name, email, phone fields"    ││
│  │   plan_steps: ['Create table "contacts" with 3 fields']                    ││
│  │   step_results: ['[COMPLETED] Created table "contacts" (id: 42)']          ││
│  │   tool_evidence: 'table_crud: SUCCESS {"table_id": 42, "fields": 3}'       ││
│  │                                                                              ││
│  │ OUTPUT:                                                                      ││
│  │   achieved: true                                                             ││
│  │   confidence: 0.95                                                           ││
│  │   completed_items: ["contacts table created", "3 fields added"]             ││
│  │   remaining_items: []                                                        ││
│  │   blockers: []                                                               ││
│  │   next_steps: []                                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ SynthesizeAnswer                                                             ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   goal: "Create contacts table with name, email, phone fields"              ││
│  │   step_results: 'Created table "contacts" (id: 42) with 3 fields'          ││
│  │   curated_context: "Table created in Main database"                         ││
│  │                                                                              ││
│  │ OUTPUT:                                                                      ││
│  │   "Created the **contacts** table with 3 fields:                            ││
│  │    - name (text)                                                             ││
│  │    - email (email)                                                           ││
│  │    - phone (phone)                                                           ││
│  │    Table ID: 42 in Main database."                                          ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# DIRECT EXECUTION FLOW

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DIRECT EXECUTION FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  User Request: "What tables do I have?"                                         │
│       │                                                                          │
│       ▼                                                                          │
│  TriageTask                                                                      │
│       │                                                                          │
│       ▼                                                                          │
│  execution_mode: "direct"                                                        │
│  reasoning: "Simple lookup, no planning needed"                                 │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ DirectExecutorModule                                                         ││
│  │                                                                              ││
│  │ TOOLS AVAILABLE (6 only):                                                    ││
│  │   ├── workspace_overview                                                     ││
│  │   ├── system_research                                                        ││
│  │   ├── web_search                                                             ││
│  │   ├── search_external                                                        ││
│  │   ├── row_crud                                                               ││
│  │   └── table_crud                                                             ││
│  │                                                                              ││
│  │ REACT LOOP with Refine(threshold=0.8):                                       ││
│  │                                                                              ││
│  │   Thought: User wants to see their tables. Use workspace_overview.          ││
│  │   Action: workspace_overview()                                               ││
│  │   Observation: {"tables": [                                                  ││
│  │     {"id": 1, "name": "contacts", "fields": 3},                             ││
│  │     {"id": 2, "name": "orders", "fields": 5}                                ││
│  │   ]}                                                                         ││
│  │   Thought: Found tables, can respond now.                                   ││
│  │   Action: finish()                                                           ││
│  │                                                                              ││
│  │ REWARD CHECK:                                                                ││
│  │   direct_execution_reward() -> 0.9 (above 0.8 threshold)                    ││
│  │                                                                              ││
│  │ OUTPUT:                                                                      ││
│  │   "You have 2 tables:                                                        ││
│  │    - contacts (3 fields)                                                     ││
│  │    - orders (5 fields)"                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  END (no planning/approval needed)                                              │
│                                                                                  │
│                                                                                  │
│  ESCALATION PATH (if Refine fails):                                             │
│  ─────────────────────────────────                                              │
│       │                                                                          │
│       ▼                                                                          │
│  If reward < 0.8 after max_retries:                                             │
│       │                                                                          │
│       ▼                                                                          │
│  Escalate to generate_plan_node                                                  │
│       │                                                                          │
│       ▼                                                                          │
│  Full planning flow with all tools                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# REFLEXION LOOP (Plan Quality)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          REFLEXION LOOP                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PlannerModule.generate_plan()                                                   │
│       │                                                                          │
│       ▼                                                                          │
│  ┌──────────────────────────────┐                                               │
│  │ CreatePlan (draft)           │                                               │
│  │      │                       │                                               │
│  │      ▼                       │                                               │
│  │ draft_plan: PlanOutput       │                                               │
│  └──────────────────────────────┘                                               │
│       │                                                                          │
│       ▼                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ ReflectOnPlan                                                             │   │
│  │                                                                           │   │
│  │ INPUT:                                                                    │   │
│  │   request: original user request                                         │   │
│  │   draft_plan: JSON of draft plan                                         │   │
│  │   research_done: summary of research performed                           │   │
│  │   workspace_context: existing resources                                  │   │
│  │                                                                           │   │
│  │ OUTPUT (PlanReflection):                                                 │   │
│  │   quality_score: 0.65                                                    │   │
│  │   critique: "Plan lacks error handling for missing table"               │   │
│  │   missing_info: ["Check if table exists first"]                         │   │
│  │   suggested_improvements: "Add validation step before creation"         │   │
│  │   should_iterate: true (quality < 0.7)                                  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                          │
│       ▼ should_iterate=true                                                      │
│  ┌──────────────────────────────┐                                               │
│  │ CreatePlan (iteration 2)     │                                               │
│  │      │                       │                                               │
│  │      ▼                       │                                               │
│  │ Include reflection feedback  │                                               │
│  │ in planning_context          │                                               │
│  └──────────────────────────────┘                                               │
│       │                                                                          │
│       ▼                                                                          │
│  ReflectOnPlan (iteration 2)                                                     │
│       │                                                                          │
│       ▼                                                                          │
│  quality_score: 0.85                                                             │
│  should_iterate: false (quality >= 0.7 OR max_iterations=2 reached)             │
│       │                                                                          │
│       ▼                                                                          │
│  Return final_plan                                                               │
│                                                                                  │
│                                                                                  │
│  MAX ITERATIONS: 2                                                               │
│  EXIT CONDITIONS:                                                                │
│    - quality_score >= 0.7                                                        │
│    - iterations >= 2                                                             │
│    - should_iterate = false                                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# ACE PATTERN (STRATEGY ACCUMULATION)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     ACE PATTERN DATA FLOW                                        │
│           (Agentic Context Engineering)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  DURING PLANNING:                                                               │
│  ────────────────                                                               │
│                                                                                  │
│  1. Retrieve relevant strategies                                                │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ RankStrategies                                                               ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   goal: "Create CRM with contacts table"                                    ││
│  │   strategies_json: '[                                                        ││
│  │     {"pattern_id": "crm_setup", "summary": "CRM requires contacts+deals"},  ││
│  │     {"pattern_id": "table_create", "summary": "Tables need primary key"},   ││
│  │     ...                                                                      ││
│  │   ]'                                                                         ││
│  │                                                                              ││
│  │ OUTPUT (StrategyRankingsResult):                                            ││
│  │   rankings:                                                                  ││
│  │     - pattern_id: "crm_setup"                                               ││
│  │       relevance: 0.95                                                        ││
│  │       reason: "Direct CRM setup match"                                      ││
│  │     - pattern_id: "table_create"                                            ││
│  │       relevance: 0.75                                                        ││
│  │       reason: "Table creation involved"                                     ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  Top strategies included in planning_context for CreatePlan                     │
│                                                                                  │
│                                                                                  │
│  AFTER SUCCESSFUL EXECUTION:                                                    │
│  ───────────────────────────                                                    │
│                                                                                  │
│  2. Extract insights from planning                                              │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ ExtractPlanningInsights                                                      ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   phase_name: "Planning"                                                     ││
│  │   context: "Found existing contacts table, modified plan to add fields"    ││
│  │   analysis: "Checked for existing resources before creating"               ││
│  │                                                                              ││
│  │ OUTPUT (PlanningInsightsResult):                                            ││
│  │   insights:                                                                  ││
│  │     - insight_type: "decision"                                              ││
│  │       summary: "Check existing resources before creating"                   ││
│  │       key_facts: ["Avoid duplicate tables", "Preserve existing data"]      ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  3. Extract insights from execution                                             │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ ExtractExecutionInsights                                                     ││
│  │                                                                              ││
│  │ INPUT:                                                                       ││
│  │   step_results_json: '[                                                      ││
│  │     {"step_id": "step_1", "result": "Created contacts table (id: 42)"},    ││
│  │     {"step_id": "step_2", "result": "Added 3 fields successfully"}         ││
│  │   ]'                                                                         ││
│  │                                                                              ││
│  │ OUTPUT (ExecutionInsightsResult):                                           ││
│  │   insights:                                                                  ││
│  │     - insight_type: "ARTIFACT"                                              ││
│  │       summary: "Contacts table ID 42 created"                               ││
│  │       key_facts: ["Table in Main database"]                                 ││
│  │       source_step_ids: ["step_1"]                                           ││
│  │     - insight_type: "DISCOVERY"                                             ││
│  │       summary: "Email field type auto-validates format"                     ││
│  │       key_facts: ["Use email type for email fields"]                        ││
│  │       source_step_ids: ["step_2"]                                           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  4. Record strategy in engine.ace                                               │
│       │                                                                          │
│       ▼                                                                          │
│  engine.ace.record({                                                            │
│      goal: "Create CRM contacts table",                                         │
│      plan: plan,                                                                 │
│      execution_insights: insights,                                              │
│      planning_insights: planning_insights,                                      │
│      success: true                                                               │
│  })                                                                              │
│       │                                                                          │
│       ▼                                                                          │
│  Stored in .engine/strategies.json                                              │
│  (Available for future similar goals)                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# TOOL SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         TOOL SYSTEM ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         TOOL CATEGORIES                                      ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                              ││
│  │  CRUD TOOLS (12)                    DISCOVERY TOOLS (5)                     ││
│  │  ───────────────                    ────────────────────                    ││
│  │  database_crud                      workspace_overview                       ││
│  │  table_crud                         system_research                          ││
│  │  field_crud                         search_capabilities                      ││
│  │  row_crud                           search_external                          ││
│  │  document_crud                      web_search                               ││
│  │  file_crud                                                                   ││
│  │  app_crud                                                                    ││
│  │  page_crud                          INTEGRATION TOOLS                       ││
│  │  view_crud                          ───────────────────                      ││
│  │  skill_crud                         Pipedream (gmail_*, slack_*, etc.)      ││
│  │  agent_crud                         DynamicSkillTool (skill:{id})           ││
│  │  team_crud                          DynamicAgentTool (agent:{id})           ││
│  │                                                                              ││
│  │  EXECUTION TOOLS                    OUTPUT TOOLS                            ││
│  │  ────────────────                   ─────────────                            ││
│  │  bash (sandboxed)                   output                                   ││
│  │  file_reader                        ask_question                             ││
│  │  file_writer                                                                 ││
│  │  calculator                                                                  ││
│  │                                                                              ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      TOOL FACTORY PATTERN                                    ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                              ││
│  │  # Factory captures auth in closure                                         ││
│  │  def create_table_crud(api_key: str, org_id: str) -> dspy.Tool:            ││
│  │       │                                                                      ││
│  │       ▼                                                                      ││
│  │  def table_crud(method: str, ...) -> str:                                   ││
│  │       # api_key and org_id available from closure                          ││
│  │       blocked = check_mutation_allowed(method)  # Planning guard           ││
│  │       if blocked:                                                            ││
│  │           return blocked                                                     ││
│  │       return make_request(..., auth_token=api_key, org_id=org_id)          ││
│  │       │                                                                      ││
│  │       ▼                                                                      ││
│  │  return dspy.Tool(                                                          ││
│  │       func=table_crud,                                                      ││
│  │       name="table_crud",                                                    ││
│  │       desc="Table management: create, list, update, delete",               ││
│  │       arg_desc={...}                                                        ││
│  │  )                                                                           ││
│  │                                                                              ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# TOOL FILTERING BY MODE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TOOL FILTERING BY MODE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  All Tools (24+)                                                                 │
│       │                                                                          │
│       ▼                                                                          │
│  filter_tools_for_mode(tools, mode)                                              │
│       │                                                                          │
│       ├─────────────────────────────────────────────────────────────────────────┤
│       │                                                                          │
│       ▼                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐           │
│  │   DIRECT MODE     │  │  PLANNING MODE    │  │  EXECUTION MODE   │           │
│  │   (6 tools)       │  │  (read-only)      │  │  (all tools)      │           │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤           │
│  │                   │  │                   │  │                   │           │
│  │ workspace_overview│  │ ALL CRUD tools    │  │ ALL CRUD tools    │           │
│  │ system_research   │  │ (mutations blocked│  │ (mutations OK)    │           │
│  │ web_search        │  │  at runtime)      │  │                   │           │
│  │ search_external   │  │                   │  │ Discovery tools   │           │
│  │ row_crud          │  │ Discovery tools   │  │                   │           │
│  │ table_crud        │  │                   │  │ Integration tools │           │
│  │                   │  │ NO mutation-only  │  │                   │           │
│  │                   │  │ tools:            │  │ Output tools      │           │
│  │                   │  │ - tool_executor   │  │                   │           │
│  │                   │  │ - pipedream       │  │ Execution tools   │           │
│  │                   │  │ - output          │  │                   │           │
│  │                   │  │ - skill_tool      │  │                   │           │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘           │
│                                                                                  │
│                                                                                  │
│  MUTATION GUARD (runtime protection in planning mode):                          │
│  ─────────────────────────────────────────────────────                          │
│                                                                                  │
│  def check_mutation_allowed(method: str) -> str | None:                         │
│       │                                                                          │
│       ▼                                                                          │
│  ctx = get_current_context()                                                     │
│       │                                                                          │
│       ▼                                                                          │
│  if ctx.tool_mode == ToolMode.PLANNING:                                         │
│       │                                                                          │
│       ├── method in ["create", "update", "delete", "write", ...]               │
│       │       │                                                                  │
│       │       ▼                                                                  │
│       │   return "BLOCKED: Cannot {method} during planning phase"              │
│       │                                                                          │
│       └── method in ["list", "read", "get", "query", ...]                      │
│               │                                                                  │
│               ▼                                                                  │
│           return None (allowed)                                                  │
│                                                                                  │
│                                                                                  │
│  MUTATION METHODS:          READ-ONLY METHODS:                                  │
│  ─────────────────          ───────────────────                                  │
│  create                     list                                                 │
│  update                     read                                                 │
│  delete                     get                                                  │
│  append_text                get_rows                                             │
│  write                      download                                             │
│  add_row                    query                                                │
│  delete_row                 search                                               │
│  update_row                                                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# TOOL TO REACT INTEGRATION

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       TOOL TO REACT INTEGRATION                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. TOOL CREATION                                                               │
│  ────────────────                                                               │
│                                                                                  │
│  api_key, org_id                                                                 │
│       │                                                                          │
│       ▼                                                                          │
│  create_all_tools(api_key, org_id, extra_headers)                               │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ List of dspy.Tool objects                                                    ││
│  │                                                                              ││
│  │  [                                                                           ││
│  │    dspy.Tool(func=table_crud, name="table_crud", desc="...", arg_desc={}), ││
│  │    dspy.Tool(func=row_crud, name="row_crud", desc="...", arg_desc={}),     ││
│  │    dspy.Tool(func=workspace_overview, name="workspace_overview", ...),      ││
│  │    ...                                                                       ││
│  │  ]                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│                                                                                  │
│  2. MODULE INITIALIZATION                                                       │
│  ────────────────────────                                                       │
│                                                                                  │
│  tools list                                                                      │
│       │                                                                          │
│       ▼                                                                          │
│  ExecutorModule(execution_tools=tools)                                          │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ # Add finish tool                                                            ││
│  │ all_tools = list(execution_tools)                                           ││
│  │ all_tools.append(                                                            ││
│  │     dspy.Tool(                                                               ││
│  │         func=lambda: "Completed.",                                          ││
│  │         name="finish",                                                       ││
│  │         desc="Marks the task as complete.",                                 ││
│  │         args={}                                                              ││
│  │     )                                                                        ││
│  │ )                                                                            ││
│  │                                                                              ││
│  │ # Create ReAct with ALL tools upfront                                       ││
│  │ # CRITICAL: Tool names baked into Literal constraint at init               ││
│  │ base_react = dspy.ReAct(                                                    ││
│  │     "step_description, context -> result",                                  ││
│  │     tools=all_tools,           # <-- Must include all tools here            ││
│  │     max_iters=10                                                            ││
│  │ )                                                                            ││
│  │                                                                              ││
│  │ # Compile with KNNFewShot for tool selection guidance                       ││
│  │ embedder = get_embedder()                                                   ││
│  │ self.react = KNNFewShot(                                                    ││
│  │     k=5,                                                                    ││
│  │     trainset=TOOL_EXAMPLES,    # <-- Examples teach tool selection          ││
│  │     vectorizer=embedder                                                     ││
│  │ ).compile(base_react)                                                       ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│                                                                                  │
│  3. REACT EXECUTION LOOP                                                        │
│  ────────────────────────                                                       │
│                                                                                  │
│  step_description: "Create contacts table with name, email, phone"              │
│  context: '{"workspace": {...}}'                                                │
│       │                                                                          │
│       ▼                                                                          │
│  self.react(step_description=..., context=...)                                  │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ REACT LOOP (max_iters=10):                                                   ││
│  │                                                                              ││
│  │   Iteration 1:                                                               ││
│  │     Thought: Need to create a table. Use table_crud.                        ││
│  │     next_tool_name: "table_crud"     <-- Literal constraint validates       ││
│  │     next_tool_args: {"method": "create", "database_id": 1, ...}            ││
│  │         │                                                                    ││
│  │         ▼                                                                    ││
│  │     Tool execution: table_crud.func(**args)                                 ││
│  │         │                                                                    ││
│  │         ▼                                                                    ││
│  │     Observation: {"success": true, "table_id": 42}                          ││
│  │                                                                              ││
│  │   Iteration 2:                                                               ││
│  │     Thought: Table created. Task complete.                                  ││
│  │     next_tool_name: "finish"                                                ││
│  │     next_tool_args: {}                                                       ││
│  │         │                                                                    ││
│  │         ▼                                                                    ││
│  │     Tool execution: finish()                                                ││
│  │         │                                                                    ││
│  │         ▼                                                                    ││
│  │     Observation: "Completed."                                               ││
│  │         │                                                                    ││
│  │         ▼                                                                    ││
│  │     EXIT LOOP                                                               ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  result.result: 'Created table "contacts" (id: 42)'                             │
│                                                                                  │
│                                                                                  │
│  KNNFEWSHOT TOOL EXAMPLES:                                                      │
│  ─────────────────────────                                                      │
│                                                                                  │
│  TOOL_EXAMPLES = [                                                              │
│      Example(task="create a table", tool="table_crud"),                         │
│      Example(task="add a row to contacts", tool="row_crud"),                    │
│      Example(task="send email to user", tool="gmail_send"),                     │
│      Example(task="search the web for info", tool="web_search"),                │
│      ...                                                                         │
│  ]                                                                               │
│                                                                                  │
│  KNN matches task to similar examples → suggests correct tool                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# DYNAMIC TOOL LOADING

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       DYNAMIC TOOL LOADING                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Plan step specifies: tool_call="skill:30"                                      │
│       │                                                                          │
│       ▼                                                                          │
│  PlanStepExecutor._ensure_tool_available("skill:30")                            │
│       │                                                                          │
│       ▼                                                                          │
│  Tool not in current _all_tools list                                            │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ UnifiedToolLoader.load_tool(ToolConfig(name="skill:30"), ...)               ││
│  │      │                                                                       ││
│  │      ▼                                                                       ││
│  │ Pattern matching:                                                            ││
│  │      │                                                                       ││
│  │      ├── "skill:{id}" pattern detected                                      ││
│  │      │       │                                                               ││
│  │      │       ▼                                                               ││
│  │      │   DynamicSkillTool(skill_id=30, api_key, org_id)                     ││
│  │      │       │                                                               ││
│  │      │       ▼                                                               ││
│  │      │   .to_dspy_tool() → dspy.Tool wrapping skill execution               ││
│  │      │                                                                       ││
│  │      ├── "agent:{id}" pattern                                               ││
│  │      │       │                                                               ││
│  │      │       ▼                                                               ││
│  │      │   DynamicAgentTool(agent_id, api_key, org_id)                        ││
│  │      │                                                                       ││
│  │      ├── CRUD factory name (e.g., "table_crud")                             ││
│  │      │       │                                                               ││
│  │      │       ▼                                                               ││
│  │      │   CRUD_FACTORIES["table_crud"](api_key, org_id)                      ││
│  │      │                                                                       ││
│  │      └── Pipedream/integration tool                                         ││
│  │              │                                                               ││
│  │              ▼                                                               ││
│  │          Load from unified_metadata.json                                    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│       │                                                                          │
│       ▼                                                                          │
│  Append to _all_tools list                                                       │
│       │                                                                          │
│       ▼                                                                          │
│  Emit ToolLoadedEvent for frontend sync                                          │
│       │                                                                          │
│       ▼                                                                          │
│  Tool available for ReAct execution                                             │
│                                                                                  │
│                                                                                  │
│  TOOL CONFIG PATTERN:                                                           │
│  ────────────────────                                                           │
│                                                                                  │
│  ToolConfig:                                                                     │
│    name: str          # "table_crud", "skill:30", "gmail_send"                  │
│    version: str       # "1.0"                                                   │
│    config: dict       # Tool-specific (auth, options)                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# TOOL PROVIDER (Centralized Creation)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TOOL PROVIDER                                           │
│                    (Centralized Tool Creation)                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  File: emery-agents/src/emery_agents/tools/provider.py                          │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ class ToolProvider:                                                          ││
│  │                                                                              ││
│  │     DSPY_FACTORIES = {                                                       ││
│  │         "database_crud": create_database_crud,                               ││
│  │         "table_crud": create_table_crud,                                     ││
│  │         "field_crud": create_field_crud,                                     ││
│  │         "row_crud": create_row_crud,                                         ││
│  │         "document_crud": create_document_crud,                               ││
│  │         "file_crud": create_file_crud,                                       ││
│  │         "app_crud": create_app_crud,                                         ││
│  │         "page_crud": create_page_crud,                                       ││
│  │         "view_crud": create_view_crud,                                       ││
│  │         "skill_crud": create_skill_crud,                                     ││
│  │         "agent_crud": create_agent_crud,                                     ││
│  │         "team_crud": create_team_crud,                                       ││
│  │     }                                                                        ││
│  │                                                                              ││
│  │     def __init__(self, api_key, org_id, extra_headers=None):                ││
│  │         self._cache = {}  # Lazy caching                                    ││
│  │                                                                              ││
│  │     def get(self, tool_name: str) -> dspy.Tool:                             ││
│  │         if tool_name not in self._cache:                                    ││
│  │             factory = self.DSPY_FACTORIES[tool_name]                        ││
│  │             self._cache[tool_name] = factory(api_key, org_id, headers)      ││
│  │         return self._cache[tool_name]                                       ││
│  │                                                                              ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  CATEGORY HELPERS:                                                              │
│  ─────────────────                                                              │
│                                                                                  │
│  provider.get_schema_builder_tools()                                            │
│       └── ["database_crud", "table_crud", "field_crud"]                        │
│                                                                                  │
│  provider.get_skill_builder_tools()                                             │
│       └── ["skill_crud"]                                                        │
│                                                                                  │
│  provider.get_document_builder_tools()                                          │
│       └── ["document_crud"]                                                     │
│                                                                                  │
│  provider.get_agent_builder_tools()                                             │
│       └── ["agent_crud", "skill_crud"]                                         │
│                                                                                  │
│  provider.get_system_designer_tools()                                           │
│       └── ["security_report"]                                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# SIGNATURE FIELD REFERENCE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       SIGNATURE FIELD REFERENCE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PLANNING SIGNATURES                                                            │
│  ───────────────────                                                            │
│                                                                                  │
│  CreatePlan / CreatePlanAutonomous:                                             │
│    INPUTS:                                                                       │
│      request: str              # User's goal                                    │
│      workspace_context: str    # JSON of resources                              │
│      planning_context: str     # Analysis + strategies + memories               │
│      conversation_history: str # Previous messages                               │
│      configured_tools: str     # JSON of tool configs                           │
│    OUTPUT:                                                                       │
│      PlanOrQuestionsOutput     # Plan OR clarifying questions                   │
│                                                                                  │
│  TriageTask:                                                                     │
│    INPUTS:                                                                       │
│      task: str                 # User request                                   │
│      workspace_context: str    # Existing resources                             │
│      memory_context: str       # Previous memories                              │
│      image_context: str        # Image descriptions                             │
│    OUTPUTS:                                                                      │
│      execution_mode: str       # "direct" | "plan" | "respond"                  │
│      reasoning: str            # Route explanation                              │
│      intent: str               # One-sentence goal                              │
│      entities: list[str]       # Concrete nouns                                 │
│      approach: str             # Reasoning approach                             │
│      external_services: list   # Third-party services                           │
│      record_context: Optional  # Table/record references                        │
│                                                                                  │
│  ReflectOnPlan:                                                                  │
│    INPUTS:                                                                       │
│      request: str              # Original request                               │
│      draft_plan: str           # JSON of draft plan                             │
│      research_done: str        # Research summary                               │
│      workspace_context: str    # Existing resources                             │
│    OUTPUT:                                                                       │
│      PlanReflection            # Quality score, critique, improvements          │
│                                                                                  │
│                                                                                  │
│  EVALUATION SIGNATURES                                                          │
│  ─────────────────────                                                          │
│                                                                                  │
│  EvaluateGoal:                                                                   │
│    INPUTS:                                                                       │
│      original_goal: str        # User's original goal                          │
│      plan_steps: list[str]     # Step descriptions                              │
│      step_results: list[str]   # [COMPLETED]/[FAILED]/[PENDING] prefixed       │
│      tool_evidence: str        # RAW tool outputs (ground truth)                │
│    OUTPUT:                                                                       │
│      GoalEvaluation            # achieved, confidence, items, blockers          │
│                                                                                  │
│  AnalyzeRecovery:                                                                │
│    INPUTS:                                                                       │
│      failed_step: str          # Failed step description                        │
│      error_message: str        # Error/exception                                │
│      context: str              # Execution state                                │
│    OUTPUT:                                                                       │
│      RecoveryAction            # action_type, confidence, parameters            │
│                                                                                  │
│  SynthesizeAnswer:                                                               │
│    INPUTS:                                                                       │
│      goal: str                 # User's goal                                    │
│      step_results: str         # Formatted results                              │
│      curated_context: str      # Execution insights                             │
│    OUTPUT:                                                                       │
│      str                       # User-facing summary                            │
│                                                                                  │
│                                                                                  │
│  ACE SIGNATURES                                                                  │
│  ──────────────                                                                  │
│                                                                                  │
│  RankStrategies:                                                                 │
│    INPUTS:                                                                       │
│      goal: str                 # Goal to match                                  │
│      strategies_json: str      # JSON of strategy summaries                     │
│    OUTPUT:                                                                       │
│      StrategyRankingsResult    # Rankings with relevance scores                 │
│                                                                                  │
│  ExtractPlanningInsights / ExtractExecutionInsights:                            │
│    INPUTS:                                                                       │
│      [phase/step info]         # Context and results                            │
│    OUTPUT:                                                                       │
│      [Insights]Result          # Typed insights for ACE storage                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

# KEY FILE LOCATIONS

| Component | File Path |
|-----------|-----------|
| **Agent Engine** | `emery-agents/src/emery_agents/engine/engine.py` |
| **Engine Paths** | `emery-agents/src/emery_agents/engine/paths.py` |
| **PlannerModule** | `emery-agents/src/emery_agents/reasoning/modules/planner.py` |
| **ExecutorModule** | `emery-agents/src/emery_agents/reasoning/modules/executor.py` |
| **EvaluatorModule** | `emery-agents/src/emery_agents/reasoning/modules/evaluator.py` |
| **Planning Signatures** | `emery-agents/src/emery_agents/reasoning/signatures/planning/` |
| **Evaluation Signatures** | `emery-agents/src/emery_agents/reasoning/signatures/evaluation.py` |
| **Tool Factories** | `emery-agents/src/emery_agents/tools/factories.py` |
| **Tool Provider** | `emery-agents/src/emery_agents/tools/provider.py` |
| **Tool Modes** | `emery-agents/src/emery_agents/tools/tool_modes.py` |
| **Mutation Guard** | `emery-agents/src/emery_agents/tools/mutation_guard.py` |
| **CRUD Tools** | `emery-agents/src/emery_agents/tools/crud/` |
| **Discovery Tools** | `emery-agents/src/emery_agents/tools/discovery.py` |
| **Tool Loader** | `emery-agents/src/emery_agents/tools/loader.py` |
| **ACE Service** | `emery-agents/src/emery_agents/ace/services/strategy_service.py` |
| **Memory Service** | `emery-agents/src/emery_agents/services/memory/memory_service.py` |
| **Plan Service** | `emery-agents/src/emery_agents/services/plan_service.py` |
| **Sandbox Executor** | `emery-agents/src/emery_agents/services/sandbox/gvisor_executor.py` |

---

# MODULE COMPILATION STRATEGIES

| Module | Base Strategy | Compilation | K value |
|--------|--------------|-------------|---------|
| **TaskClassifierModule** | ChainOfThought | Direct | N/A |
| **Triage** | ChainOfThought | KNNFewShot | k=5 |
| **PlannerModule (standard)** | ChainOfThought | LabeledFewShot | k=5 |
| **PlannerModule (complex)** | ReAct | LabeledFewShot | k=5 |
| **ExecutorModule** | ReAct | KNNFewShot | k=5 |
| **DirectExecutorModule** | ReAct + Refine | KNNFewShot | k=5 |
| **EvaluatorModule** | ChainOfThought | Direct | N/A |
| **OutputExtractorModule** | ChainOfThought | Direct | N/A |
| **StrategyRankingModule** | ChainOfThought | Direct | N/A |

---

# EXAMPLE DATASETS

| Dataset | Purpose | Location |
|---------|---------|----------|
| `TOOL_EXAMPLES` | Teach tool selection | `reasoning/examples/tools.py` |
| `PLANNING_DEMOS` | Plan structure for request types | `reasoning/examples/planning.py` |
| `AUTONOMOUS_PLANNING_DEMOS` | Autonomous planning (no questions) | `reasoning/examples/planning.py` |
| `TRIAGE_EXAMPLES` | Quick DIRECT/PLAN/RESPOND routing | `reasoning/examples/triage.py` |
