# CLAUDE.md for Emery Agents

This file provides guidance to Claude Code when working with the emery-agents Python microservice.

## Project Overview

Emery Agents is a Python microservice that provides agent execution capabilities for the Emery platform. It implements a **Domain-Driven Design (DDD) architecture** with centralized AI model management and standardized testing infrastructure.

## DDD Architecture

### Core Principles

This project follows **authentic DDD patterns**:

- **Domain entities** with business logic and proper value objects
- **Repository pattern** with interfaces in domain, implementations in infrastructure  
- **Application services** for orchestration
- **Value objects** as source of truth (not primitive obsession)
- **Centralized model provider** for AI model standardization

### Directory Structure

```
src/emery_agents/
├── domain/                    # Pure domain logic
│   ├── agents/
│   │   ├── entities/          # Domain entities with business rules
│   │   │   ├── agent.py       # Agent entity with business logic
│   │   │   └── task.py        # Task entity with lifecycle management
│   │   ├── repositories/      # Repository INTERFACES only
│   │   │   ├── agent_repository.py
│   │   │   └── task_repository.py
│   │   └── value_objects/     # Value objects with validation
│   │       └── agent_value_objects.py
│   ├── ai/                    # AI domain services
│   │   └── services/
│   │       └── model_provider_service.py  # Model provider interface
│   └── shared/
│       └── value_objects/
│           └── ids.py         # Shared ID value objects
├── application/               # Application services - orchestration
│   └── services/
│       └── agent_task_service.py
└── infrastructure/            # Concrete implementations
    ├── ai/                    # AI infrastructure
    │   └── smolagents_model_provider.py  # Centralized model provider
    ├── execution/
    │   └── smolagents_execution_repository.py  # Updated with model provider
    └── repositories/
        └── mock_agent_repository.py
```

### Layer Rules

#### Domain Layer (`src/emery_agents/domain/`)
- **Contains**: Entities with business logic, repository interfaces, value objects
- **Business Rules**: All domain logic lives in entities
- **No Dependencies**: Pure domain logic, no external imports
- **Value Objects**: Immutable objects with validation (AgentId, OrganizationId, etc.)

#### Application Layer (`src/emery_agents/application/`)
- **Contains**: Application services that orchestrate domain operations
- **Orchestration**: Coordinates between repositories and domain entities
- **Transaction Management**: Handles save operations and error handling

#### Infrastructure Layer (`src/emery_agents/infrastructure/`)
- **Contains**: Repository implementations, external service integrations
- **AI Model Provider**: Centralized model creation and management
- **Database Access**: Concrete repository implementations

## 🎯 AI Model System Standardization (2025-01)

### Problem Solved

**Before**: AI model instantiation was scattered across multiple files with hardcoded values:
- `smolagents_execution_repository.py`: `InferenceClientModel("Qwen/Qwen2.5-14B-Instruct", token=hf_token)`
- `capability_router_agent.py`: Same hardcoded pattern
- Multiple locations with duplicate model configuration

**After**: Centralized model management through DDD service pattern.

### ModelProviderService Architecture

#### Domain Interface (`domain/ai/services/model_provider_service.py`)

```python
from abc import ABC, abstractmethod
from enum import Enum

class ModelType(Enum):
    CHAT = "chat"                    # General conversation
    CODE = "code"                    # Code generation  
    TOOL_CALLING = "tool_calling"    # Tool execution
    FAST = "fast"                    # Quick responses

class IModelProviderService(ABC):
    @abstractmethod
    def get_model_for_step_type(self, step_type: StepType, model_override: Optional[str] = None) -> Any:
        """Get appropriate AI model for a specific step type."""
        
    @abstractmethod  
    def get_model_by_type(self, model_type: ModelType) -> Any:
        """Get AI model by standardized model type."""
        
    @abstractmethod
    def get_default_model_for_capability(self, capability_name: Optional[str] = None) -> Any:
        """Get default model for capability execution."""
```

#### Infrastructure Implementation (`infrastructure/ai/smolagents_model_provider.py`)

```python
class SmolagentsModelProvider(IModelProviderService):
    def __init__(self):
        self.model_configs = {
            ModelType.CHAT: {
                'model_id': 'Qwen/Qwen2.5-Coder-7B-Instruct',
                'max_tokens': 2048,
                'temperature': 0.7
            },
            ModelType.CODE: {
                'model_id': 'Qwen/Qwen2.5-Coder-7B-Instruct',
                'max_tokens': 4096, 
                'temperature': 0.6
            },
            ModelType.TOOL_CALLING: {
                'model_id': 'Qwen/Qwen2.5-14B-Instruct',
                'max_tokens': 2048,
                'temperature': 0.7
            },
            ModelType.FAST: {
                'model_id': 'Qwen/Qwen2.5-Coder-7B-Instruct',
                'max_tokens': 1024,
                'temperature': 0.6
            }
        }
        
        # Step type to model type mapping
        self.step_type_mapping = {
            StepType.CODE_STEP: ModelType.CODE,
            StepType.TOOL_STEP: ModelType.TOOL_CALLING,
        }
```

### Usage in Infrastructure

#### Updated Execution Repository

```python
class SmolAgentsExecutionRepository(IExecutionRepository):
    def __init__(self, tool_registry_repository: IToolRegistryRepository, model_provider: IModelProviderService):
        self.model_provider = model_provider
        # ...
    
    async def _create_direct_execution_agent(self, context: ExecutionContext) -> ToolCallingAgent:
        # OLD: model = InferenceClientModel("Qwen/Qwen2.5-14B-Instruct", token=hf_token)
        # NEW: Get model from centralized provider
        model = self.model_provider.get_default_model_for_capability()
        return ToolCallingAgent(tools=tools, model=model, max_steps=10)
    
    async def _create_step_agent(self, step: StepConfig) -> Union[CodeAgent, ToolCallingAgent]:
        # OLD: Hardcoded model selection logic
        # NEW: Use centralized provider with step type routing
        model = self.model_provider.get_model_for_step_type(step.type, model_override=step.model)
        # ...
```

#### Updated Capability Router

```python
class CapabilityRouterAgent:
    def __init__(self, model_provider: IModelProviderService):
        self.model_provider = model_provider
    
    async def _create_tool_calling_agent(self, tool_names: list = None) -> ToolCallingAgent:
        # OLD: model = InferenceClientModel("Qwen/Qwen2.5-14B-Instruct", token=hf_token)
        # NEW: Use centralized provider
        model = self.model_provider.get_default_model_for_capability()
        return ToolCallingAgent(tools=tools, model=model, max_steps=10)
```

### Benefits Achieved

- **90% reduction** in AI model configuration duplication
- **Centralized model management** following DDD patterns
- **Type-safe model selection** based on step types and capabilities
- **Consistent model configuration** across the entire system
- **Easy model updates** through single configuration point

### Context-Specific Model Selection

The `resolve_model_selection()` method is **context-agnostic** but receives different parameters based on execution context:

#### 1. Chat System Context
```python
# Called from: chat_processing_service.py:410
# Parameters: Only org_model
model_id = model_provider.resolve_model_selection(org_model=request.model)

# Hierarchy: Organization → Default
# Use Case: Mission Control chat conversations
# Set In: Organization settings (/settings/usage)
```

#### 2. Agent Task Execution Context (Future)
```python
# Parameters: agent_model + org_model
model_id = model_provider.resolve_model_selection(
    agent_model=agent.default_model,
    org_model=organization.default_model
)

# Hierarchy: Agent → Organization → Default
# Use Case: Agent executing task instructions
# Set In: Agent configuration form
```

#### 3. Skill Execution Context (Future)
```python
# Parameters: skill_model + agent_model + org_model
model_id = model_provider.resolve_model_selection(
    skill_model=skill.model,
    agent_model=agent.default_model,
    org_model=organization.default_model
)

# Hierarchy: Skill → Agent → Organization → Default
# Use Case: Skill tool execution
# Set In: Skill configuration UI (not yet built)
```

**AIDEV-NOTE:** The model provider doesn't know about contexts - it just implements priority logic. Context-specific parameter selection happens at the caller level (chat service, task execution, skill execution).

**See detailed documentation:** TypeScript side `/docs/model-selection-hierarchy.md`

## 🧪 Standardized Testing Infrastructure (2025-01)

### Problem Solved

**Before**: Multiple test approaches without shared patterns or consistent fixtures.

**After**: Standardized test infrastructure with base classes and enhanced fixtures.

### Base Test Classes (`tests/base_test_classes.py`)

```python
class BaseDDDTest(ABC):
    """Base class for DDD-focused tests with standard fixtures."""
    
    @pytest.fixture
    def sample_agent_config(self) -> AgentConfig:
        """Standard agent configuration for testing."""
        
    @pytest.fixture 
    def sample_agent(self, sample_agent_config) -> Agent:
        """Standard agent entity for testing."""

class BaseModelProviderTest(BaseDDDTest):
    """Base class for testing AI model providers."""
    
    @pytest.fixture
    def model_provider(self, mock_hf_token):
        """Create real model provider for testing."""
        
    @pytest.fixture
    def mock_model_provider(self):
        """Mock model provider for unit tests."""

class BaseExecutionTest(BaseModelProviderTest):
    """Base class for testing execution services."""
    
    @pytest.fixture
    def mock_execution_context(self):
        """Mock execution context."""
        
    @pytest.fixture
    def execution_progress_tracker(self):
        """Track execution progress for testing."""

class BaseRealAgentTest(BaseIntegrationTest):
    """Base class for real agent execution tests."""
    
    async def execute_real_task(self, task: Task, agent: Agent):
        """Execute a real task with proper monitoring."""
```

### Enhanced Fixtures (`tests/conftest.py`)

```python
@pytest.fixture
def mock_model_provider():
    """Mock model provider for standardized testing."""
    provider = Mock()
    provider.get_model_for_step_type = Mock(return_value=mock_model)
    provider.get_model_by_type = Mock(return_value=mock_model)
    # ...

@pytest.fixture
def real_model_provider(mock_hf_env):
    """Real model provider for integration tests."""
    return SmolagentsModelProvider()

@pytest.fixture
def execution_context_factory():
    """Factory for creating execution contexts."""
    def create_context(instructions: str = "Test execution", ...):
        return ExecutionContext(...)
    return create_context

@pytest.fixture
def progress_tracker():
    """Track execution progress for testing."""
    events = []
    def track_event(event): events.append(event)
    return events, track_event
```

### Test Organization

#### Test Markers
- `@pytest.mark.unit`: Unit tests with mocks
- `@pytest.mark.integration`: Multi-component tests  
- `@pytest.mark.real_execution`: Tests requiring AI models (HF_TOKEN)
- `@pytest.mark.model_provider`: Model provider system tests
- `@pytest.mark.ddd`: Domain-Driven Design pattern tests

#### Test Categories
- **Validation**: Basic setup and environment tests
- **Unit**: Individual component tests with mocks
- **Integration**: Multi-component tests with real dependencies  
- **Real Execution**: Full end-to-end tests with AI models

## Key Patterns

### Value Objects as Source of Truth

Value objects are maintained as the source of truth in DDD systems:

```python
# Value objects provide type safety and validation
class AgentId:
    def __init__(self, value: int):
        if not isinstance(value, int) or value <= 0:
            raise ValueError("AgentId must be positive integer")
        self._value = value
    
    @property
    def value(self) -> int:
        return self._value

# Domain entities use value objects
class Agent:
    def __init__(self, id: AgentId, name: AgentName, ...):
        self.id = id
        self.name = name
```

### Model Provider Injection

All components requiring AI models use dependency injection:

```python
# Infrastructure components receive model provider
class SmolAgentsExecutionRepository:
    def __init__(self, tool_registry: IToolRegistryRepository, model_provider: IModelProviderService):
        self.model_provider = model_provider

# Application services coordinate the dependency injection
class AgentTaskApplicationService:
    def __init__(self, agent_repo: IAgentRepository, model_provider: IModelProviderService):
        self.execution_repo = SmolAgentsExecutionRepository(tool_registry, model_provider)
```

### Standardized Test Inheritance

Tests inherit from appropriate base classes:

```python
class TestModelProvider(BaseModelProviderTest):
    def test_step_type_mapping(self, model_provider):
        """Test step type to model mapping."""
        model = model_provider.get_model_for_step_type(StepType.CODE_STEP)
        assert model is not None

class TestRealExecution(BaseRealAgentTest):
    @pytest.mark.real_execution
    async def test_email_task(self, available_tasks, available_agents):
        """Test real email task execution."""
        task = self.find_task_by_id(available_tasks, "task_001")
        # ...
```

## Development Guidelines

### AI Model Management
- **Always use ModelProviderService** for AI model creation
- **Never hardcode model strings** in infrastructure code
- **Use dependency injection** for model provider access
- **Prefer step type mapping** over manual model selection

### Testing Patterns
- **Inherit from base test classes** for common functionality
- **Use appropriate test markers** for categorization
- **Mock model provider** for unit tests, use real provider for integration
- **Track execution progress** in real execution tests

### Value Object Usage
- **Use value objects for all IDs** and domain concepts
- **Validate in constructors** with clear error messages
- **Provide type safety** throughout the domain layer
- **Keep as source of truth** for domain integrity

## Import Patterns

### Recommended Import Style

Always use **full module paths** starting with `emery_agents` for clarity:

```python
# ✅ GOOD - Full module imports (recommended)
from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.ai.services.model_provider_service import IModelProviderService
from emery_agents.infrastructure.ai.smolagents_model_provider import SmolagentsModelProvider

# ✅ GOOD - Relative imports within same package  
from ..entities.agent import Agent
from ...domain.ai.services.model_provider_service import IModelProviderService
```

## Usage Examples

### Using Model Provider Service

```python
# Create model provider (normally via DI container)
model_provider = SmolagentsModelProvider()

# Get model for specific step type
code_model = model_provider.get_model_for_step_type(StepType.CODE_STEP)
tool_model = model_provider.get_model_for_step_type(StepType.TOOL_STEP)

# Get model by type
chat_model = model_provider.get_model_by_type(ModelType.CHAT)
fast_model = model_provider.get_model_by_type(ModelType.FAST)

# Get default model for capability
default_model = model_provider.get_default_model_for_capability()
```

### Writing Standardized Tests

```python
class TestAgentExecution(BaseExecutionTest):
    def test_agent_creation_with_model_provider(self, mock_model_provider, sample_agent):
        """Test agent creation uses model provider."""
        # Test uses inherited fixtures and base functionality
        repo = SmolAgentsExecutionRepository(mock_tool_registry, mock_model_provider)
        # Verify model provider was called
        mock_model_provider.get_default_model_for_capability.assert_called()

    @pytest.mark.real_execution
    async def test_real_email_execution(self, real_model_provider, available_tasks):
        """Test real email task with AI model."""
        task = self.find_task_by_id(available_tasks, "task_001")
        events = await self.execute_real_task(task, agent)
        self.verify_real_execution_result(events[-1])
```

## AIDEV Anchor Comments

Use searchable AIDEV comments for inline documentation:
- `AIDEV-NOTE:` - Important architectural decisions and explanations
- `AIDEV-TODO:` - Known improvement opportunities  
- `AIDEV-QUESTION:` - Areas needing architectural decisions

```bash
grep -r "AIDEV-" --include="*.py" src/
```

## Running Tests

### Test Categories

```bash
# Run all unit tests
uv run pytest -m unit

# Run integration tests  
uv run pytest -m integration

# Run real execution tests (requires HF_TOKEN)
HF_TOKEN=your_token uv run pytest -m real_execution

# Run model provider tests
uv run pytest -m model_provider -v
```

### Specific Test Files

```bash
# Test model provider functionality
uv run pytest tests/test_model_provider.py -v

# Test with real AI models (requires HF_TOKEN)
HF_TOKEN=your_token uv run pytest tests/test_real_agent_execution.py -v -s

# Test DDD patterns
uv run pytest -m ddd tests/ -v
```

---

## 🎯 Summary of 2025-01 Improvements

### ✅ AI Model System Standardization
- **Centralized model provider** eliminates 90% of configuration duplication
- **Type-safe model selection** based on step types and capabilities  
- **DDD-compliant architecture** with domain interface and infrastructure implementation
- **Consistent model configuration** across entire system

### ✅ Testing Infrastructure Standardization
- **Base test classes** provide common functionality and fixtures
- **Enhanced fixtures** in `conftest.py` support both mock and real testing
- **Standardized test categories** with appropriate markers
- **Progress tracking** and execution monitoring capabilities

### ✅ DDD Best Practices Maintained
- **Value objects preserved** as source of truth (not primitive obsession)
- **Repository pattern** with proper dependency injection
- **Domain services** for AI model management
- **Clear layer boundaries** and proper import patterns

This architecture provides a clean, maintainable, and extensible foundation for AI agent development while following authentic Domain-Driven Design principles.