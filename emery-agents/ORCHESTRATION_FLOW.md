# Orchestration Flow Documentation

This document maps the complete orchestration flow from user message to execution completion.

## High-Level Flow

```mermaid
flowchart TB
    subgraph Entry["Entry Point"]
        A[User Message] --> B[ProcessMessage gRPC]
        B --> C[_stream_tool_calling_agent_response]
    end

    subgraph StateMachine["State Machine Check"]
        C --> D{Current Phase?}
        D -->|IDLE| E[New Task Flow]
        D -->|AWAITING_APPROVAL| F[Handle Approval]
        D -->|AWAITING_CLARIFICATION| G[Handle Clarification]
        D -->|AWAITING_RECOVERY| H[Handle Recovery]
    end

    subgraph Classification["Task Classification"]
        E --> I[TaskClassifier.classify]
        I --> J{Classification Result}
        J -->|DIRECT| K[Direct Execution]
        J -->|PLAN_AND_APPROVE| L[Planning Phase]
        J -->|needs_clarification| M[Request Clarification]
    end

    subgraph Planning["Planning Phase"]
        L --> N[PlannerRouter.generate_plan]
        N --> O[Goal Summarization]
        O --> P[Domain Classification]
        P --> Q[Domain Planners]
        Q --> R[PlanCreatedEvent]
        R --> S[AWAITING_APPROVAL]
    end

    subgraph Approval["Approval Flow"]
        S --> T{User Response}
        F --> T
        T -->|Approved| U[Execution Phase]
        T -->|Rejected| V[Return to IDLE]
    end

    subgraph Execution["Execution Phase"]
        U --> W[execute_plan Loop]
        W --> X[PlanStepExecutor.execute]
        X --> Y[StepCompletedEvent]
        Y --> Z[Evaluate Progress]
        Z --> AA{Evaluation}
        AA -->|goal_achieved| AB[FinalSynthesisEvent]
        AA -->|needs_replan| AC[PlanDiffer.generate_diff]
        AA -->|continue| W
        AC --> W
    end

    K --> AB
    AB --> AD[ExecutionCompletedEvent]
```

## State Machine Transitions

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> AWAITING_CLARIFICATION: needs_clarification
    IDLE --> AWAITING_APPROVAL: plan_created
    IDLE --> AWAITING_QUESTIONS: managed_agent_hitl
    IDLE --> EXECUTING: direct_execution

    AWAITING_CLARIFICATION --> IDLE: clarification_received

    AWAITING_APPROVAL --> EXECUTING: approved
    AWAITING_APPROVAL --> IDLE: rejected

    AWAITING_QUESTIONS --> IDLE: questions_answered

    EXECUTING --> IDLE: execution_complete
    EXECUTING --> AWAITING_QUESTIONS: managed_agent_hitl
    EXECUTING --> AWAITING_RECOVERY: step_failed

    AWAITING_RECOVERY --> EXECUTING: recovery_approved
    AWAITING_RECOVERY --> IDLE: recovery_rejected
```

## Planning Phase Detail

```mermaid
flowchart LR
    subgraph PlannerRouter["PlannerRouter.generate_plan"]
        A[Instructions] --> B[_summarize_goal]
        B --> C[Classifier.classify]
        C --> D{Domains Needed}
    end

    subgraph DomainPlanners["Domain Planners"]
        D -->|direct| E[DirectDomainPlanner]
        D -->|schema| F[SchemaDomainPlanner]
        D -->|app| G[AppDomainPlanner]
        D -->|automation| H[AutomationDomainPlanner]
    end

    subgraph ACE["ACE Context Curation"]
        E --> I[PlanningContextService]
        F --> I
        G --> I
        H --> I
        I --> J[Curated Insights]
    end

    subgraph Output["Plan Output"]
        J --> K[Combine Steps]
        K --> L[create_plan]
        L --> M[Plan with phases]
    end
```

### Domain Execution Order

| Order | Domain | Target Agent | Purpose |
|-------|--------|--------------|---------|
| 1 | direct | direct_execution | Pure LLM tasks (analysis, routing, transformation) |
| 2 | schema | skill_builder | Database/table operations |
| 3 | app | skill_builder | App/page/view operations |
| 4 | automation | skill_builder | Agent/skill/trigger creation |

## Execution Phase Detail

```mermaid
flowchart TB
    subgraph ExecutionLoop["execute_plan Loop"]
        A[Get Pending Steps] --> B{Has Steps?}
        B -->|No| C[FinalSynthesisEvent]
        B -->|Yes| D[Get Next Step]
    end

    subgraph StepExecution["Step Execution"]
        D --> E{target_agent?}
        E -->|direct_execution| F[_execute_direct]
        E -->|other| G[_execute_with_routing]
        F --> H[ToolCallingAgent no managed agents]
        G --> I[ToolCallingAgent with managed agents]
        H --> J[Step Result]
        I --> J
    end

    subgraph ACECuration["ACE Curation every 3 steps"]
        J --> K[Store StepResult]
        K --> L{Every 3 steps?}
        L -->|Yes| M[ExecutionContextService.curate]
        L -->|No| N[Skip Curation]
        M --> O[Extract Insights]
        O --> P[Decay Old Relevance]
    end

    subgraph Evaluation["Evaluation"]
        N --> Q[EvaluatorAgent]
        P --> Q
        Q --> R{Evaluation Result}
        R -->|goal_achieved| C
        R -->|needs_replan| S[_handle_replan]
        R -->|continue| A
        S --> T[PlanDiffer.generate_diff]
        T --> U[Apply Diff]
        U --> A
    end
```

## Replanning Flow (Diff-Based)

```mermaid
flowchart LR
    subgraph Trigger["Replan Trigger"]
        A[Evaluation: needs_replan] --> B[_handle_replan]
        C[Step Failure] --> B
    end

    subgraph DiffGeneration["PlanDiffer.generate_diff"]
        B --> D[Build Completed Context]
        D --> E[Render plan_diff.j2]
        E --> F[ToolCallingAgent]
        F --> G[DiffOutputTool]
        G --> H[PlanDiff]
    end

    subgraph DiffOperations["Diff Operations"]
        H --> I{Operations}
        I --> J[steps_to_skip]
        I --> K[steps_to_modify]
        I --> L[steps_to_append]
    end

    subgraph Apply["apply_diff"]
        J --> M[Mark SKIPPED]
        K --> N[Update Description]
        L --> O[Append New Steps]
        M --> P[Updated Plan v+1]
        N --> P
        O --> P
    end
```

## ACE Integration Points

```mermaid
flowchart TB
    subgraph PlanningPhase["Planning Phase ACE"]
        A[Domain Planner Output] --> B[raw_context + raw_analysis]
        B --> C[PlanningContextService.curate_after_phase]
        C --> D[LLM: PlanningInsightTool]
        D --> E[PlanningInsights]
        E --> F[PlanningContext]
        F --> G[format_for_phase next domain]
    end

    subgraph ExecutionPhase["Execution Phase ACE"]
        H[Step Results] --> I[ExecutionContextService.curate]
        I --> J[LLM: InsightExtractionTool]
        J --> K[ExecutionInsights]
        K --> L[Relevance Decay 0.9x]
        L --> M[ExecutionContext]
    end

    subgraph EvolutionTracking["Evolution Tracking"]
        M --> N[ExecutionEvolutionTracker]
        N --> O[Record Deltas]
        O --> P{detect_degradation?}
        P -->|>30% losses| Q[Degradation Warning]
        P -->|OK| R[Continue]
    end

    subgraph StrategyAccumulation["Strategy Recording"]
        S[Plan Completed] --> T[StrategyAccumulationService.record_execution]
        T --> U[ExecutionPattern]
        U --> V[StrategyRegistry]
        V --> W[Keyword Index]
    end
```

## Graph Retrieval Flow

When triage detects a record-level query (e.g., "tell me about John Smith"), it extracts `RecordContext` and passes it through the graph retrieval pipeline.

```mermaid
flowchart TB
    subgraph Triage["Triage Node"]
        A[Task + workspace_context] --> B[DSPy TriageTask]
        B --> C[RecordContext typed output]
        C --> D{table_id present?}
        D -->|Yes| E[Store in state]
        D -->|No| F[record_context = None]
    end

    subgraph GraphRetrieval["Graph Retrieval (planning/direct nodes)"]
        E --> G[retrieve_graph_context]
        G --> H[For each record_id]
        H --> I[Try ID lookup via GraphRetriever]
        I --> J{Found?}
        J -->|Yes| K[Collect related records]
        J -->|No| L[find_by_name ILIKE search]
        L --> M{Found ID?}
        M -->|Yes| N[Retry with resolved ID]
        M -->|No| O[Skip record]
        N --> K
        K --> P[format_for_planner]
    end

    P --> Q[Graph context added to planner input]
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| **RecordContext** | `reasoning/signatures/planning/models.py` | Pydantic model: `table_id`, `record_ids` |
| **TriageAnalysis** | `reasoning/signatures/planning/models.py` | Pydantic model: `intent`, `entities`, `approach`, `external_services` |
| **TriageTask** | `reasoning/signatures/planning/triage.py` | DSPy signature with typed outputs |
| **Triage Node** | `orchestrators/nodes/triage.py` | Extracts RecordContext and TriageAnalysis to state |
| **Graph Helper** | `orchestrators/helpers/graph.py` | ID-first lookup, name fallback |
| **GraphService** | `services/graph/service.py` | `find_by_name()`, `get_related()` |
| **GraphRetriever** | `reasoning/modules/graph_retriever.py` | DuckPGQ traversal + markdown formatting |

### Name Resolution Strategy

1. **ID-first**: Try `record_id` as UUID directly
2. **Name fallback**: If no results, search name-like columns via ILIKE
3. **Dynamic columns**: `find_by_name()` queries DESCRIBE to find columns containing "name" or "title"

## Error Recovery Flow

```mermaid
flowchart TB
    subgraph Detection["Error Detection"]
        A[Step Execution Error] --> B[_handle_step_failure]
    end

    subgraph Analysis["Failure Analysis"]
        B --> C[plan_service.analyze_step_failure]
        C --> D[RecoveryResult]
        D --> E{Confidence Level}
    end

    subgraph Recovery["Recovery Actions"]
        E -->|HIGH >= 0.8| F[Auto-Fix]
        E -->|MEDIUM 0.5-0.8| G[Propose Recovery Plan]
        E -->|LOW < 0.5| H[Ask Clarifying Questions]

        F --> I[Execute Recovery Steps]
        G --> J[AWAITING_RECOVERY]
        H --> K[AWAITING_CLARIFICATION]

        J --> L{User Response}
        L -->|Approved| I
        L -->|Rejected| M[Return to IDLE]
    end
```

## Key File References

| Component | File | Key Lines |
|-----------|------|-----------|
| gRPC Entry | `grpc/chat_processing_service.py` | 298-302, 703-1200 |
| Approval Handler | `grpc/approval_handler.py` | Extracted approval/error helpers |
| State Machine | `services/coordinator_state_machine.py` | 40-45, 102-128 |
| Coordinator | `services/execution_coordinator.py` | 525-651, 939-1558 |
| Step Executor | `services/execution/step_executor.py` | Extracted step execution |
| Interrupt Handler | `services/execution/interrupt_handler.py` | Extracted interrupt management |
| Replan Handler | `services/execution/replan_handler.py` | Extracted replanning logic |
| Planning Router | `services/planning/planners/planner_router.py` | 69-262 |
| Plan Step Executor | `services/plan_step_executor.py` | 82-147, 149-293 |
| Plan Differ | `services/planning/plan_differ.py` | 181-371 |
| ACE Context | `ace/services/context_service.py` | 137-302 |
| ACE Strategy | `ace/services/strategy_service.py` | 86-295 |
| RecordContext | `reasoning/signatures/planning/models.py` | 297-301 |
| Graph Helper | `orchestrators/helpers/graph.py` | 21-93 |
| GraphService | `services/graph/service.py` | 215-252 |
| GraphRetriever | `reasoning/modules/graph_retriever.py` | Full file |

## Event Types

| Event | Emitted By | Purpose |
|-------|-----------|---------|
| `PlanCreatedEvent` | ExecutionCoordinator | Plan ready for approval |
| `PlanApprovedEvent` | ExecutionCoordinator | Plan approved, starting execution |
| `StepStartedEvent` | ExecutionCoordinator | Step execution beginning |
| `StepCompletedEvent` | ExecutionCoordinator | Step finished successfully |
| `StepFailedEvent` | ExecutionCoordinator | Step execution failed |
| `EvaluationCompletedEvent` | ExecutionCoordinator | Evaluator finished assessment |
| `ReplanTriggeredEvent` | ExecutionCoordinator | Replanning initiated |
| `PlanUpdatedEvent` | ExecutionCoordinator | Plan modified via diff |
| `PhaseStartedEvent` | ExecutionCoordinator | New phase beginning |
| `PhaseCompletedEvent` | ExecutionCoordinator | Phase finished |
| `FinalSynthesisEvent` | ExecutionCoordinator | Final answer synthesized |
| `ExecutionCompletedEvent` | ExecutionCoordinator | All execution complete |
| `AwaitingClarificationEvent` | ExecutionCoordinator | Needs user input |
| `RecoveryAnalysisEvent` | ExecutionCoordinator | Recovery analysis complete |

## Tool Modes

```mermaid
flowchart LR
    subgraph Modes["Tool Mode Filtering"]
        A[All Tools] --> B{Phase?}
        B -->|Planning| C[PLANNING Mode]
        B -->|Execution| D[EXECUTION Mode]
        C --> E[Read-only tools only]
        D --> F[Full tool access]
    end
```

| Mode | Description | Tools Available |
|------|-------------|-----------------|
| PLANNING | Read-only discovery | list_tables, describe_table, list_apps, etc. |
| EXECUTION | Full operations | create_table, update_record, create_app, etc. |

## Extracted Modules (Phase 5 Refactoring)

### services/execution/

Extracted from `execution_coordinator.py` for maintainability:

| Module | Purpose |
|--------|---------|
| `step_executor.py` | Executes individual plan steps using PlanStepExecutor |
| `interrupt_handler.py` | Manages interrupt queue and classification |
| `replan_handler.py` | Handles diff-based replanning when evaluator triggers replan |

### grpc/

Extracted from `chat_processing_service.py`:

| Module | Purpose |
|--------|---------|
| `approval_handler.py` | Plan approval helpers, error response creation |
