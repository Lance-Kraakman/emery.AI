# Emery Agents - Actual System Architecture

> **IMPORTANT**: This document reflects the ACTUAL implementation, not the simplified version described in the README.

## System Overview

Emery Agents is a sophisticated multi-agent orchestration platform with advanced AI capabilities, not a "simplified" system as claimed in the documentation.

## Core Architecture (Reality)

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMERY AGENTS 3.0.0                           │
│              Advanced Multi-Agent Platform                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND & API LAYER                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Web UI        │  │   Next.js API   │  │   gRPC Client   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    GATEWAY & SESSION                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ gRPC Server     │  │ChatProcessing   │  │Session Manager  │ │
│  │                 │  │Service         │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Mention Parser   │  │Agent Executor   │  │Tool Provider    │ │
│  │(@agent routing) │  │(Dynamic)        │  │(Auth-aware)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 ORCHESTRATION ENGINE                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Execution        │  │Task Classifier  │  │Planning Service │ │
│  │Coordinator     │  │(LLM-based)      │  │(Two-phase)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │State Machine    │  │Interrupt Handler│  │ACE Framework    │ │
│  │(Persistent)     │  │(Real-time)      │  │(Context Evol.)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   AGENT SYSTEM                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Domain Planners  │  │Managed Agents   │  │Autonomous Agents│ │
│  │(Specialized)    │  │(HITL)           │  │(Auto-exec)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │OSSA Agents      │  │Skill Executors  │  │Multi-modal      │ │
│  │(Registry)       │  │(MPC-enhanced)   │  │(Image/Audio)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  SERVICES & INTEGRATION                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Output Mapping   │  │Strategy Accum.  │  │Research Tools   │ │
│  │(Multi-table)    │  │Service          │  │(Web/System)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Multi-modal Proc │  │S3 Integration   │  │Storage Services │ │
│  │(Image/Audio)    │  │(Binary files)   │  │(Databases)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components (Actual Implementation)

### 1. Orchestration Engine

#### ExecutionCoordinator
- **Two-phase execution**: Planning → Approval → Execution
- **Dynamic replanning**: Plans can be modified during execution
- **State machine**: Persistent state across message boundaries
- **Interrupt handling**: Real-time user input during execution

#### TaskClassifier (LLM-based)
- **Intelligent routing**: Uses LLM to classify task complexity
- **Domain detection**: Identifies which specialized agents are needed
- **Context awareness**: Considers conversation history and previous results

### 2. ACE Framework (Advanced Context Evolution)

#### PlanningContextService
- **Context curation**: Manages context during planning phase
- **Strategy integration**: Incorporates learned strategies from past executions
- **Token budgeting**: Optimizes context within LLM token limits

#### ExecutionEvolutionTracker
- **Change detection**: Tracks context changes during execution
- **Degradation detection**: Identifies when context quality degrades
- **Recovery system**: Automatic recovery from context degradation

#### StrategyAccumulationService
- **Pattern learning**: Learns successful execution patterns
- **Strategy recording**: Records what worked in past executions
- **Guidance generation**: Provides guidance to future planning

### 3. Agent System

#### Agent Types
1. **AgentExecutor**: Main orchestration agent with multiple execution modes
2. **Domain Planners**: Specialized planners for different problem domains
3. **Managed Agents**: HITL (Human-in-the-Loop) agents requiring approval
4. **Autonomous Agents**: Self-executing agents for routine tasks
5. **OSSA Agents**: Open-source agents from registry
6. **Skill Executors**: MPC-enhanced agents for complex skills

#### Agent Hierarchies
```
AgentExecutor (Main)
├─ PlanningService
│  ├─ SchemaPlanner
│  ├─ AppPlanner
│  ├─ AutomationPlanner
│  └─ ResearchPlanner
├─ ManagedAgents
│  ├─ SkillBuilder
│  ├─ SchemaBuilder
│  ├─ AppBuilder
│  ├─ PageBuilder
│  └─ DocumentBuilder
├─ AutonomousAgents
│  ├─ TableBuilder
│  ├─ ResearchAgent
│  └─ SystemResearchAgent
└─ SkillExecutors
    └─ MPC-Enhanced Skills
```

### 4. Multi-Modal Processing

#### Content Processing Pipeline
- **Text processing**: Natural language understanding
- **Image processing**: PIL-based image analysis and manipulation
- **Audio processing**: Audio transcription and analysis
- **File handling**: Support for various file formats
- **Binary support**: Upload and reference binary files

### 5. Output Mapping System

#### Multi-table Output Capture
- **Structured output**: Capture LLM outputs into structured tables
- **Type-aware mapping**: Field metadata guides LLM output generation
- **Multi-table support**: Map outputs across multiple database tables
- **Binary handling**: Upload images/files to S3 and reference in database

### 6. Tool System

#### Tool Categories
1. **CRUD Tools**: Database, table, field, document, skill, app, agent operations
2. **Research Tools**: Web search, page visits, system introspection
3. **Multi-modal Tools**: Image processing, audio transcription
4. **Output Mapping Tools**: Data capture and storage
5. **OSSA Tools**: Open-source agent integration

#### Security Features
- **AuthenticatedHTTPClient**: Prevents credential exposure
- **Organization-based access**: Multi-tenant security
- **API key management**: Secure key handling and rotation

### 7. MPC Skill Builder

#### Control Theory Integration
- **Model Predictive Control**: Optimize skill execution
- **HuggingFace Integration**: Use HF models for schema generation
- **Dynamic schema**: Natural language to structured skill schemas
- **Performance optimization**: Optimal control for complex workflows

## Execution Flow (Actual)

### Phase 1: Planning & Approval
```
User Request
     │
     ▼
Task Classification (LLM-based)
     │
     ▼
Domain Detection
     │
     ▼
Specialized Planning
├─ Schema Planner (for database tasks)
├─ App Planner (for app creation)
├─ Automation Planner (for workflows)
└─ Research Planner (for information gathering)
     │
     ▼
Context Enrichment
├─ Strategy Accumulation (past patterns)
├─ Conversation History (user references)
├─ ACE Context (evolution tracking)
└─ Research Results (web/system)
     │
     ▼
Plan Generation
     │
     ▼
User Approval/Modification
     │
     ├─ Approve → Execution
     ├─ Modify → Replan with feedback
     └─ Cancel → Abort
```

### Phase 2: Execution with Real-time Control
```
Approved Plan
     │
     ▼
Step-by-Step Execution
     │
     ├─► Execute Step
     │        │
     │        ├─ Success → Update Context → Next Step
     │        ├─ Failure → Recovery Analysis → Auto-fix/User Input
     │        └─ Interrupt → User Input → Continue/Modify/Stop
     │
     ├─► Context Evolution Tracking
     │        │
     │        ├─ Capture Insights (discoveries, decisions, artifacts)
     │        ├─ Update Strategies (successful patterns)
     │        ├─ Detect Degradation (information loss)
     │        └─ Take Snapshots (for recovery)
     │
     ├─► Output Mapping
     │        │
     │        ├─ Capture structured outputs
     │        ├─ Store in appropriate tables
     │        ├─ Upload binary content to S3
     │        └─ Update schemas dynamically
     │
     └─► Dynamic Replanning (if needed)
              │
              ▼
   Continue/Modify/Stop Execution
```

## Advanced Features

### 1. Interrupt System
- **Real-time interrupts**: Users can interrupt execution at any time
- **Context preservation**: State is preserved during interrupts
- **Recovery options**: Retry, skip, modify, or replan
- **Degradation detection**: Automatic detection of context issues

### 2. Dynamic Replanning
- **Execution feedback**: Plans can be modified based on execution results
- **Failure recovery**: Automatic or manual recovery from failures
- **Scope changes**: Plans can adapt to changing requirements
- **Optimization**: Plans can be optimized based on performance

### 3. Multi-Modal AI
- **Image understanding**: Process and analyze images
- **Audio transcription**: Convert audio to text
- **File analysis**: Support for various file formats
- **Binary handling**: Upload and reference binary files

### 4. Output Mapping
- **Structured capture**: Capture LLM outputs into database tables
- **Type awareness**: Field metadata guides output formatting
- **Multi-table support**: Distribute outputs across multiple tables
- **Schema evolution**: Dynamically update schemas based on outputs

## Configuration & Deployment

### Dependencies (Key Categories)
```python
# AI/ML
smolagents, transformers, huggingface-hub

# Control Theory (MPC)
do-mpc, casadi

# Data Processing
polars, pyarrow, deltalake

# Multi-modal
Pillow, pydub

# Async/Networking
aiohttp, httpx, grpcio
```

### Build System
- **Modern Python**: Uses pyproject.toml with uv
- **Type Safety**: mypy strict mode
- **Code Quality**: Black, isort, flake8
- **Testing**: pytest with comprehensive markers
- **Package**: hatchling for distribution

## Security Model

### Authentication
- **Organization-based**: Multi-tenant security
- **API key management**: Secure key handling
- **HTTP client**: Authenticated requests without credential exposure
- **Session management**: Secure session handling

### Data Protection
- **Credential isolation**: API keys never logged
- **Secure storage**: S3 integration for binary content
- **Access control**: Role-based permissions
- **Audit logging**: Comprehensive execution tracking

## Conclusion

Emery Agents is a **highly sophisticated multi-agent orchestration platform** with:
- Advanced AI capabilities (multi-modal, context evolution)
- Complex agent hierarchies and specialized planners
- Real-time control and interrupt handling
- Modern software engineering practices
- Comprehensive security and testing

The documentation needs to be updated to reflect this reality rather than the misleading "simplified" claims.