# Emery Agents

Agent execution system for Emery with smolagents and MCP integration.

## Overview

Emery Agents provides a robust multi-step agent workflow execution system that integrates with:

- **smolagents**: AI agent capabilities (CodeAgent, ToolCallingAgent)
- **MCP Servers**: External service integration via Pipedream Connect
- **Emery API**: Seamless integration with the main Emery application

## Features

- 🔄 **Multi-step Workflows**: Execute complex agent workflows with multiple steps
- 🤖 **AI Agent Types**: Support for CodeAgent and ToolCallingAgent via smolagents
- 🌐 **OAuth Integration**: Secure external service calls via Emery's Pipedream Connect
- 📊 **Execution Tracking**: Detailed tracking of execution progress and results
- 🛠️ **Flexible Tools**: Dynamic tool loading and configuration
- 📨 **Step Dependencies**: Context passing between workflow steps

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
from emery_agents import AgentRunner, Agent, AgentStep, AgentType
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
    runner = AgentRunner(emery_client, smolagents, mcp_servers)
    
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

### Running Tests

```bash
cd emery-agents
uv run pytest tests/
```

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
│ │ Agent API   │ │────│ │ AgentRunner  │ │────│ │ CodeAgent   │ │
│ │ Routes      │ │    │ │              │ │    │ │ ToolCalling │ │
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