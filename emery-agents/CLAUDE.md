# CLAUDE.md for Emery Agents

This file provides guidance to Claude Code when working with the emery-agents Python microservice.

## Project Overview

Emery Agents is a Python microservice that provides agent execution capabilities for the Emery platform. It implements a **simple Domain-Driven Design (DDD) architecture** that mirrors the TypeScript patterns used in the main frontend application.

## Simple DDD Architecture

### Core Principles

This project follows **authentic DDD patterns** - NOT Clean Architecture or complex abstraction layers:

- **Simple entities** with business logic
- **Repository pattern** with interfaces in domain, implementations in infrastructure  
- **Application services** for orchestration
- **No value objects** for simple IDs - just use `int` and `str`
- **No adapters or ports** - direct repository implementations
- **Mutable entities** following TypeScript patterns

### Directory Structure

```
src/emery_agents/
├── domain/                    # Pure domain logic
│   └── agents/
│       ├── entities/          # Domain entities with business rules
│       │   ├── agent.py       # Agent entity with business logic
│       │   └── task.py        # Task entity with lifecycle management
│       └── repositories/      # Repository INTERFACES only
│           ├── agent_repository.py
│           └── task_repository.py
├── application/               # Application services - orchestration
│   └── services/
│       └── agent_task_service.py
└── infrastructure/            # Concrete implementations
    └── db/
        └── repositories/
            └── agents/
                ├── grpc_agent_repository.py
                └── grpc_task_repository.py
```

### Layer Rules

#### Domain Layer (`src/emery_agents/domain/`)
- **Contains**: Entities with business logic, repository interfaces
- **Business Rules**: All domain logic lives in entities
- **No Dependencies**: Pure domain logic, no external imports
- **Mutable Entities**: Entities can change state (following TypeScript patterns)

#### Application Layer (`src/emery_agents/application/`)
- **Contains**: Application services that orchestrate domain operations
- **Orchestration**: Coordinates between repositories and domain entities
- **Transaction Management**: Handles save operations and error handling
- **Simple DTOs**: Basic request/response objects

#### Infrastructure Layer (`src/emery_agents/infrastructure/`)
- **Contains**: Repository implementations, external service integrations
- **Database Access**: Concrete repository implementations (gRPC, HTTP, etc.)
- **External Services**: Integration with external systems

## Key Patterns

### Domain Entities

Entities are simple classes with business logic, following TypeScript patterns:

```python
# src/emery_agents/domain/agents/entities/agent.py
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

@dataclass
class AgentConfig:
    """Configuration for creating a new agent."""
    name: str
    organization_id: int
    owner_id: str
    role: Optional[str] = None
    status: Optional[str] = None
    api_key: Optional[str] = None
    # ... other fields

class Agent:
    def __init__(self, id: int, name: str, status: str, api_key: str, 
                 organization_id: int, owner_id: str, ...):
        self.id = id
        self.name = name
        self.status = status
        self.api_key = api_key
        self.organization_id = organization_id
        self.owner_id = owner_id
    
    @classmethod
    def create(cls, config: AgentConfig) -> "Agent":
        return cls(
            id=0,  # Will be set by repository
            name=config.name,
            status=config.status or "active",
            organization_id=config.organization_id,
            owner_id=config.owner_id,
            api_key=config.api_key,
            # ...
        )
    
    @classmethod 
    def from_persistence(cls, data: Dict[str, Any]) -> "Agent":
        return cls(
            id=data["id"],
            name=data["name"],
            status=data.get("status"),
            api_key=data.get("api_key"),
            organization_id=data["organization_id"],
            owner_id=data["owner_id"],
            # ...
        )
    
    # Business logic methods
    @property
    def is_active(self) -> bool:
        return self.status not in ["inactive", "disabled"]
    
    def validate_for_execution(self) -> None:
        if not self.is_active:
            raise ValueError(f"Agent {self.name} is not active")
        if not self.api_key:
            raise ValueError(f"Agent {self.name} has no API key configured")
```

### Repository Pattern

Simple repository interfaces with concrete implementations:

```python
# src/emery_agents/domain/agents/repositories/agent_repository.py (INTERFACE)
from abc import ABC, abstractmethod
from typing import Optional
from ..entities.agent import Agent

class IAgentRepository(ABC):
    @abstractmethod
    async def find_by_id(self, id: int) -> Optional[Agent]:
        pass
    
    @abstractmethod
    async def save(self, agent: Agent) -> None:
        pass

# src/emery_agents/infrastructure/db/repositories/agents/grpc_agent_repository.py (IMPLEMENTATION)
from typing import Optional
from ....domain.agents.entities.agent import Agent
from ....domain.agents.repositories.agent_repository import IAgentRepository

class GrpcAgentRepository(IAgentRepository):
    def __init__(self, grpc_client):
        self.grpc_client = grpc_client
        
    async def find_by_id(self, id: int) -> Optional[Agent]:
        # gRPC implementation
        pass
```

### Application Services

Simple orchestration services that coordinate domain operations:

```python
# src/emery_agents/application/services/agent_task_service.py
from typing import Optional
from ...domain.agents.entities.agent import Agent
from ...domain.agents.entities.task import Task, TaskConfig
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.repositories.task_repository import ITaskRepository

@dataclass
class CreateTaskRequest:
    agent_id: int
    name: str
    instructions: TaskInstructions
    # ... other fields

@dataclass 
class TaskExecutionResult:
    task: Task
    execution_result: Dict[str, Any]

class AgentTaskApplicationService:
    def __init__(self, agent_repository: IAgentRepository, task_repository: ITaskRepository):
        self.agent_repository = agent_repository
        self.task_repository = task_repository
    
    async def create_and_execute_task(self, request: CreateTaskRequest) -> TaskExecutionResult:
        # 1. Validate agent
        agent = await self.agent_repository.find_by_id(request.agent_id)
        if not agent:
            raise ValueError(f"Agent {request.agent_id} not found")
        
        # 2. Create task (domain logic)
        task = Task.create(TaskConfig(
            agent_id=request.agent_id,
            organization_id=agent.organization_id,
            name=request.name,
            instructions=request.instructions
        ))
        
        # 3. Save task
        await self.task_repository.save(task)
        
        # 4. Execute task (domain logic)
        task.start()
        await self.task_repository.save(task)
        
        # ... execution logic
        
        task.complete(result)
        await self.task_repository.save(task)
        
        return TaskExecutionResult(task=task, execution_result=result)
```

## Import Patterns

### Recommended Import Style

Always use **full module paths** starting with `src.emery_agents` for clarity and consistency:

```python
# ✅ GOOD - Full module imports (recommended)
from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from src.emery_agents.domain.agents.entities.task import Task, TaskInstructions, TaskConfig
from src.emery_agents.domain.agents.repositories.agent_repository import IAgentRepository
from src.emery_agents.application.services.agent_task_service import AgentTaskApplicationService

# ✅ GOOD - Relative imports within same package
from ..entities.agent import Agent
from ...domain.agents.entities.task import Task

# ❌ AVOID - Bare package imports (less clear)
from emery_agents import Agent, Task
```

### Import Organization

Organize imports in this order:
```python
# 1. Standard library
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

# 2. Third-party packages
import pytest
from unittest.mock import AsyncMock

# 3. Local imports - full paths
from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from src.emery_agents.domain.agents.entities.task import Task, TaskInstructions
```

## Development Guidelines

### Entity Design
- **Simple Classes**: No complex immutability patterns
- **Business Logic**: Methods like `is_active()`, `validate_for_execution()`
- **Factory Methods**: `create()` for new entities, `from_persistence()` for existing
- **Mutable State**: Entities can change state (task lifecycle, etc.)

### Repository Design  
- **Interface in Domain**: Abstract base class defining contracts
- **Implementation in Infrastructure**: Concrete classes with external dependencies
- **Simple Methods**: Basic CRUD operations, no complex abstractions

### Application Service Design
- **Orchestration**: Coordinate between repositories and domain entities  
- **Transaction Boundaries**: Handle save operations and rollback
- **Error Handling**: Convert domain exceptions to appropriate responses
- **Simple DTOs**: Basic request/response objects, no complex mapping

### Testing Patterns
- **Domain Tests**: Test business logic in entities
- **Application Tests**: Mock repositories, test orchestration
- **Infrastructure Tests**: Test actual implementations (integration tests)

## Usage Examples

### Creating and Executing Tasks

```python
# Full module imports (recommended for clarity)
from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from src.emery_agents.domain.agents.entities.task import Task, TaskInstructions, TaskConfig
from src.emery_agents.application.services.agent_task_service import (
    AgentTaskApplicationService,
    CreateTaskRequest,
    ExecuteTaskRequest,
    TaskExecutionResult
)

# Set up service with dependencies (normally via DI)
service = AgentTaskApplicationService(agent_repo, task_repo)

# Create request
instructions = TaskInstructions(
    instructions="Send email to team about project update",
    tools=[{"name": "gmail"}]
)

request = CreateTaskRequest(
    agent_id=123,
    name="Send Project Update Email", 
    instructions=instructions,
    created_by="user_123"
)

# Execute
result = await service.create_and_execute_task(request)
print(f"Task {result.task.short_id} completed: {result.task.status}")
```

### Working with Domain Entities

```python
from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from src.emery_agents.domain.agents.entities.task import Task, TaskInstructions, TaskConfig

# Create new agent
config = AgentConfig(
    name="Email Agent",
    organization_id=1,
    owner_id="user_123",
    api_key="api_key_123"
)
agent = Agent.create(config)

# Business logic
if agent.is_active:
    agent.validate_for_execution()  # May raise ValueError

# Create task with lifecycle
task_config = TaskConfig(
    agent_id=agent.id,
    organization_id=1,
    name="Send Email",
    instructions=TaskInstructions(instructions="Send email")
)
task = Task.create(task_config)

# Task lifecycle
task.start()        # Changes status to "in_progress" 
task.complete(result)  # Changes status to "completed"
```

## Common Patterns

### Error Handling
- Domain entities raise `ValueError` for business rule violations
- Application services catch and handle domain exceptions
- Repository implementations handle infrastructure errors

### State Management
- Entities manage their own state transitions
- Application services coordinate state changes
- Repositories persist state changes

### Dependency Injection
- Application services receive repositories via constructor
- Infrastructure implementations are injected at runtime
- Tests use mock repositories

## Anti-Patterns to Avoid

❌ **Don't use complex value objects for simple IDs**
```python
# DON'T DO THIS
class AgentId:
    def __init__(self, value: int): ...

# DO THIS  
def find_agent(agent_id: int) -> Agent:
    pass
```

❌ **Don't create adapter layers**
```python
# DON'T DO THIS
class AgentRepositoryAdapter(IAgentRepository):
    def __init__(self, grpc_adapter: GrpcAdapter): ...

# DO THIS
class GrpcAgentRepository(IAgentRepository):
    def __init__(self, grpc_client): ...
```

❌ **Don't over-abstract simple operations**
```python  
# DON'T DO THIS
class AgentDomainService:
    def validate_agent_execution_eligibility(self, agent: Agent): ...

# DO THIS - put logic in entity
class Agent:
    def validate_for_execution(self): ...
```

## AIDEV Anchor Comments

Use searchable AIDEV comments for inline documentation:
- `AIDEV-NOTE:` - Important architectural decisions and explanations
- `AIDEV-TODO:` - Known improvement opportunities  
- `AIDEV-QUESTION:` - Areas needing architectural decisions

```bash
grep -r "AIDEV-" --include="*.py" src/
```

## Testing

### Unit Tests
- Test domain entities independently
- Mock repositories in application service tests
- Focus on business logic, not implementation details

### Integration Tests  
- Test complete flows through all layers
- Use real repository implementations
- Test error handling and edge cases

### Running Tests
```bash
# Run all tests
uv run pytest

# Run specific test files
uv run pytest tests/ddd/test_agent_task_service.py -v

# Run with coverage
uv run pytest --cov=src/emery_agents --cov-report=term-missing
```