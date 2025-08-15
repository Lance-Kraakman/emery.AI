# Emery Agents

Distributed agent execution system with gRPC communication and multi-step workflow orchestration.

## Architecture

- **Core**: Type definitions, execution orchestration, context management
- **gRPC**: Protocol buffers communication for distributed workers
- **Integrations**: SmolAgents AI models, MCP servers, Emery client
- **Utils**: Templated prompts and utilities

## Key Components

### SmolAgentsOrchestrator  
Manages AI agent hierarchy with TaskExecutorAgent → CapabilityAgents → DefaultTaskExecutorAgent routing.

### gRPC Server
Production server receiving complete agent configuration via protocol buffers, eliminating environment variable dependencies.

### ExecutionContextManager
Provides persistent context between agent steps using temporary working directories with JSON state files.

## Installation

```bash
# Install in Emery project
cd /path/to/emery
uv add ./emery-agents

# Install with smolagents support
uv add "./emery-agents[smolagents]"

# Install for development
cd emery-agents
uv sync --dev
```

## Quick Start

### 1. Basic Agent Execution

```python
import asyncio
from emery_agents import Agent, AgentStep, AgentType
from emery_agents.integrations import (
    EmeryClientIntegration, 
    SmolAgentsIntegration, 
    MCPServerIntegration
)

async def main():
    # Initialize integrations
    emery_client = EmeryClientIntegration(
        api_url="http://localhost:3000",
        agent_id="123"
    )
    smolagents = SmolAgentsIntegration()
    mcp_servers = MCPServerIntegration(emery_client)
    
    # Create runner    
    # Define agent with steps
    agent = Agent(
        id="123",
        name="Email Assistant",
        role="assistant",
        description="Helps with email tasks",
        persona="Helpful email assistant",
        agent_type=AgentType.TOOL_CALLING_AGENT,
        model="claude-3-sonnet-20240229",
        steps=[
            AgentStep(
                id="step1",
                instructions="Analyze the email request",
                agent_type=AgentType.TOOL_CALLING_AGENT,
                tools=["email_analyzer"]
            ),
            AgentStep(
                id="step2", 
                instructions="Send the email via Gmail",
                agent_type=AgentType.TOOL_CALLING_AGENT,
                servers=["gmail"]
            )
        ]
    )
    
    # Execute agent
    trigger_data = {"request": "Send meeting reminder"}
    execution = await runner.execute_agent(agent, trigger_data)
    
    print(f"Execution completed: {execution.status}")

if __name__ == "__main__":
    asyncio.run(main())
```

### 2. CLI Usage (from NextJS)

```bash
# Set environment variables
export EMERY_AGENT_CONFIG='{"id": "123", "name": "Test Agent", ...}'
export EMERY_TRIGGER_DATA='{"request": "Process data"}'
export EMERY_API_URL="http://localhost:3000"
export EMERY_API_KEY="agent_api_key_here"

# Execute agent
uv run emery-agents execute 123
```

## Agent Configuration

### Agent Types

- `TOOL_CALLING_AGENT`: Uses smolagents ToolCallingAgent for function calling
- `CODE_AGENT`: Uses smolagents CodeAgent for code generation and execution
- `HUMAN`: Human-in-the-loop step (pauses execution)
- `AI_EMPLOYEE`: Specialized AI employee agent
- `AI_LEAD`: AI lead/manager agent

### Step Configuration

```python
AgentStep(
    id="unique_step_id",
    instructions="What the agent should do",
    agent_type=AgentType.TOOL_CALLING_AGENT,  # Step-specific agent type
    tools=["tool1", "tool2"],                 # Tools to load
    servers=["gmail", "slack"],               # MCP servers to use
    # Data flows automatically through execution context - no complex I/O mapping needed
)
```

### Trigger Types

- `MANUAL`: Manual execution via API
- `CRON`: Scheduled execution
- `WEBHOOK`: Triggered by webhook
- `DATABASE_EVENT`: Triggered by database changes

## Integration with Emery

### Environment Variables

```bash
# Required
EMERY_API_URL=http://localhost:3000
EMERY_AGENT_ID=123
EMERY_API_KEY=your_agent_api_key

# Optional
EMERY_AGENTS_LOG_LEVEL=INFO
SMOLAGENTS_MODEL=claude-3-sonnet-20240229
```

### OAuth Integration

Leverages Emery's existing Pipedream Connect system:

```python
# MCP servers automatically use owner's OAuth credentials
servers=["gmail", "slack", "github"]

# No additional OAuth configuration needed
```

## Development

### Testing

#### Quick Tests
```bash
# Smoke tests without external dependencies
uv run quick_test.py
```

#### Comprehensive Tests
```bash
# All tests with coverage
uv run run_tests.py all --coverage

# Unit tests only
uv run run_tests.py unit --verbose

# Integration tests
uv run run_tests.py integration

# SmolAgents tests (requires HF_TOKEN)
export HF_TOKEN="your_token"
uv run run_tests.py smolagents

# gRPC tests
uv run run_tests.py grpc
```

#### Test Structure
- `tests/test_types.py` - Type definitions validation
- `tests/test_runner.py` - Core orchestrator functionality
- `tests/test_smolagents.py` - SmolAgents integration
- `tests/test_grpc.py` - gRPC server tests
- `tests/test_integration.py` - End-to-end workflows

### Code Quality

```bash
# Format code
uv run black src/
uv run isort src/

# Type checking
uv run mypy src/

# Linting
uv run flake8 src/
```

### Adding New Integrations

1. Create new integration in `src/emery_agents/integrations/`
2. Follow the pattern of existing integrations
3. Add to `__init__.py` exports
4. Update documentation

## Examples

See the `examples/` directory for:
- Basic agent workflows
- Complex multi-step processes
- Custom tool integrations
- Error handling patterns

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   NextJS App    │    │  emery-agents    │    │   smolagents    │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Agent API   │ │────│ │ Orchastator  │ │────│ │ CodeAgent   │ │
│ │ Routes      │ │    │ │ Smol         │ │    │ │ ToolCalling │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    └─────────────────┘
│ │ OAuth Proxy │ │◄───│ │ MCP Servers  │ │    
│ │ (Pipedream) │ │    │ │ Integration  │ │    ┌─────────────────┐
│ └─────────────┘ │    │ └──────────────┘ │    │ External APIs   │
└─────────────────┘    └──────────────────┘    │ (Gmail, Slack)  │
                                               └─────────────────┘
```

## License

This project is part of the Emery ecosystem.