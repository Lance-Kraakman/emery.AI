# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emery Agents is a distributed agent execution system with gRPC communication and multi-step workflow orchestration. It integrates with SmolAgents for AI model execution and MCP servers for external service connections through the parent Emery system.

## Core Architecture

### Clean Architecture Layers
- **Domain Layer** (`domain/`): Core business logic and models - NO external dependencies
- **Application Layer** (`application/`): Use cases and orchestration services
- **Infrastructure Layer** (`infrastructure/`): Concrete implementations of domain interfaces
- **gRPC Layer** (`grpc/`): Protocol buffers communication for distributed workers

### Key Components
- **SmolAgentsOrchestrator**: Manages AI agent hierarchy with TaskExecutorAgent → CapabilityAgents → DefaultTaskExecutorAgent routing
- **ExecutionContextManager**: Persistent context between agent steps using temporary working directories
- **Tool Registry**: Dynamic tool loading and conversion system for SmolAgents integration
- **MCP Server Integration**: Leverages Emery's OAuth proxy for external service connections

## Development Commands

### Testing Commands
```bash
# Quick smoke tests (no external dependencies)
uv run pytest tests/test_types.py -v

# All unit tests
uv run pytest tests/ -v

# Tests with coverage report
uv run pytest tests/ --cov=src/emery_agents --cov-report=html

# Specific test categories (if run_tests.py exists)
uv run pytest tests/ -m "not integration"  # Unit tests only
uv run pytest tests/ -m "integration"      # Integration tests
uv run pytest tests/ -m "smolagents"       # SmolAgents tests (requires HF_TOKEN)
uv run pytest tests/ -m "grpc"             # gRPC tests
```

### Code Quality Commands
```bash
# Format code
uv run black src/ tests/
uv run isort src/ tests/

# Type checking
uv run mypy src/

# Linting
uv run flake8 src/
```

### Development Setup
```bash
# Install for development
uv sync --dev

# Install with smolagents support
uv add "./[smolagents]"
```

## Environment Configuration

### Required Environment Variables
```bash
# Core integration
EMERY_API_URL=http://localhost:3000
EMERY_AGENT_ID=123
EMERY_API_KEY=your_agent_api_key

# For SmolAgents integration
HF_TOKEN=your_huggingface_token
SMOLAGENTS_MODEL=claude-3-sonnet-20240229

# Optional
EMERY_AGENTS_LOG_LEVEL=INFO
```

### Test Environment
```bash
# For SmolAgents tests
export HF_TOKEN="your_huggingface_token"

# For integration tests
export EMERY_API_URL="http://localhost:3000" 
export TEST_ORGANIZATION_ID="test_org"
```

## Agent Configuration System

### Agent Types
- `TOOL_CALLING_AGENT`: Uses smolagents ToolCallingAgent for function calling
- `CODE_AGENT`: Uses smolagents CodeAgent for code generation and execution
- `HUMAN`: Human-in-the-loop step (pauses execution)
- `AI_EMPLOYEE`: Specialized AI employee agent
- `AI_LEAD`: AI lead/manager agent

### Step Configuration Pattern
```python
AgentStep(
    id="unique_step_id",
    instructions="What the agent should do",
    agent_type=AgentType.TOOL_CALLING_AGENT,  # Step-specific agent type
    tools=["tool1", "tool2"],                 # Tools to load dynamically
    servers=["gmail", "slack"],               # MCP servers via Emery OAuth proxy
    # Data flows automatically through execution context
)
```

### Trigger Types
- `MANUAL`: Manual execution via API
- `CRON`: Scheduled execution via parent Emery scheduler
- `WEBHOOK`: Triggered by webhook
- `DATABASE_EVENT`: Triggered by database changes

## Integration Patterns

### Emery Integration
- **OAuth Proxy**: Uses parent Emery's Pipedream Connect system for external service authentication
- **API Communication**: gRPC for distributed execution, HTTP for configuration
- **Database Integration**: Agents configured in parent Emery database, executed in this system
- **Multi-tenant**: Inherits organization context from parent Emery system

### SmolAgents Integration
- **Model Support**: HuggingFace models (Qwen series recommended in parent project)
- **Tool Registry**: Dynamic loading and conversion of tools to SmolAgents format
- **Context Management**: Persistent state between agent execution steps
- **Error Propagation**: Comprehensive error handling and reporting

### MCP Server Integration
- **OAuth Delegation**: Uses owner's connected accounts from parent Emery system
- **Service Discovery**: Runtime discovery of available services based on user connections
- **No Local Credentials**: All OAuth handled through parent Emery's proxy system

## Development Workflow

### Pre-commit Testing Protocol
**MANDATORY**: Always run tests before committing to ensure changes don't break existing functionality.

```bash
# Quick validation tests
uv run pytest tests/test_types.py -v

# If quick tests pass, run full unit test suite
uv run pytest tests/ -v --tb=short

# Run with coverage for comprehensive validation
uv run pytest tests/ --cov=src/emery_agents --cov-report=term-missing
```

**Test-Driven Commit Process:**
1. Make your code changes
2. Run relevant unit tests: `uv run pytest tests/test_[module].py -v`
3. If successful, run full test suite: `uv run pytest tests/ -v`
4. Fix any failing tests before proceeding
5. Commit only when all tests pass

### Python Code Quality Standards

**Type Definitions:**
- **Use @dataclass for structured data** - Prefer dataclasses over Dict[str, Any] for configuration objects
- **Use TypedDict for result dictionaries** - For return values and loose data structures
- **Explicit type annotations** - All function parameters, return values, and class attributes
- **Domain-specific Enums** - For status values, types, and categories (AgentType, TriggerType)

**Clean Architecture Compliance:**
- **Domain Layer**: NO external dependencies - only pure business logic and interfaces
- **Application Layer**: Depends only on Domain layer - orchestrates business operations
- **Infrastructure Layer**: Concrete implementations of domain interfaces
- **Dependency Injection**: Use constructor injection, configure at composition root (gRPC layer)

**Error Handling:**
- **Fail fast on dependencies** - Import required libraries directly, let ImportError fail module load
- **Chain exceptions** - Use `raise ... from e` to preserve stack traces
- **Specific exception types** - Avoid generic `Exception` usage
- **Proper context logging** - Include relevant context in error messages

**Function Design:**
- **Single responsibility** - One function, one purpose
- **Type annotations everywhere** - Never use untyped functions
- **@dataclass parameters** - For complex parameter sets instead of multiple loose parameters
- **Pure functions preferred** - Avoid excessive state mutation

### Testing Patterns

**Unit Test Guidelines:**
- **Focus on behavior** - Test actual behavior, not implementation details
- **Minimal mocking** - Avoid stubbing everything just for coverage
- **Fixtures for common data** - Use pytest fixtures in `conftest.py`
- **Test categories** - Use pytest markers (integration, smolagents, grpc)
- **Fast unit tests** - Keep unit tests independent of external services

**Integration Test Patterns:**
- **External service mocking** - Mock Emery API and MCP servers appropriately
- **Environment variable testing** - Test with missing/invalid environment variables
- **Error scenarios** - Test network failures, authentication errors, etc.

### Architecture Rules

**Layer Dependencies (ENFORCED):**
- **Domain → Domain**: ✅ Allowed
- **Application → Domain**: ✅ Allowed  
- **Infrastructure → Domain**: ✅ Allowed
- **gRPC → Application + Infrastructure**: ✅ Allowed (composition root)
- **Domain → Application**: ❌ FORBIDDEN
- **Domain → Infrastructure**: ❌ FORBIDDEN
- **Application → Infrastructure**: ❌ FORBIDDEN (use dependency injection)

**Import Rules:**
- All imports at top of file - NO inline imports
- Group imports: stdlib, third-party, local imports
- Fail fast on missing dependencies

**Anti-patterns to Avoid:**
- ❌ **Domain layer with external dependencies** - Keep domain pure business logic
- ❌ **Application layer importing infrastructure** - Use dependency injection instead
- ❌ **Generic Dict[str, Any]** - Create explicit @dataclass types
- ❌ **Untyped function parameters** - All functions must have explicit type annotations
- ❌ **Defensive .get() on typed structures** - Use dataclass attributes directly
- ❌ **Magic numbers** - Extract constants with meaningful names

## AIDEV Anchor Comments

The codebase uses searchable AIDEV comments for inline documentation:
- `AIDEV-NOTE:` - Important architectural decisions and explanations
- `AIDEV-TODO:` - Known improvement opportunities  
- `AIDEV-QUESTION:` - Areas needing architectural decisions

Search for these patterns when working on complex areas:
```bash
grep -r "AIDEV-" --include="*.py" src/
```

## Integration with Parent Emery System

### gRPC Communication
- **Protocol Buffers**: Complete agent configuration passed via gRPC (no environment variable dependencies)
- **Streaming Updates**: Real-time progress reporting back to parent system
- **Error Propagation**: Comprehensive error context maintained through gRPC boundary

### OAuth Proxy Usage
- **No Local OAuth**: All external service authentication delegated to parent Emery
- **Service Discovery**: Available services determined by user's connected accounts in parent system
- **Secure Execution**: Agents run with owner's permissions, not elevated privileges

### Database Independence
- **Stateless Execution**: Agent execution is stateless - all context from parent system or execution context manager
- **Temporary State**: Uses temporary directories for execution context persistence
- **No Direct DB Access**: All data operations through parent Emery API

## Key Implementation Details

### Tool Registry System
- **Dynamic Loading**: Tools discovered and loaded at runtime based on agent configuration
- **SmolAgents Compatibility**: Automatic conversion of various tool formats to SmolAgents format
- **Custom Tools**: Support for domain-specific tools beyond standard SmolAgents tools
- **Version Management**: Tool versioning and compatibility checking

### Execution Context Management
- **Persistent Context**: State maintained between agent steps using JSON files in temporary directories
- **Cleanup**: Automatic cleanup of execution contexts after completion or failure
- **Data Flow**: Seamless data passing between steps without complex I/O mapping

### Error Handling Patterns
- **Comprehensive Logging**: Detailed logging for debugging distributed execution
- **Error Context**: Maintains full error context across gRPC boundaries
- **Graceful Degradation**: Handles network failures and service unavailability gracefully
- **Retry Logic**: Intelligent retry mechanisms for transient failures

### Performance Considerations
- **Lazy Loading**: Tools and models loaded only when needed
- **Connection Pooling**: Efficient gRPC connection management
- **Memory Management**: Proper cleanup of resources after execution
- **Concurrent Execution**: Support for concurrent agent step execution where possible