"""
CLI entry point for emery-agents package.
Allows execution from NextJS via `uv run emery-agents execute <agent_id>`
"""

import asyncio
import json
import logging
import os
import sys
from typing import Dict, Any

from .core.runner import AgentRunner
from .core.types import Agent, StepType, TriggerType, Trigger, AgentStep, Capability
from .integrations.smolagents import SmolAgentsIntegration
from .integrations.mcp_servers import MCPServerIntegration
from .integrations.emery_client import EmeryClientIntegration


def setup_logging():
    """Set up logging configuration."""
    log_level = os.getenv("EMERY_AGENTS_LOG_LEVEL", "INFO")
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )


def parse_agent_config(config_data: Dict[str, Any]) -> Agent:
    """Parse agent configuration from JSON data."""
    # Parse trigger
    trigger = None
    if config_data.get('trigger'):
        trigger_data = config_data['trigger']
        trigger = Trigger(
            type=TriggerType(trigger_data['type']),
            cron=trigger_data.get('cron'),
            webhook_url=trigger_data.get('webhook_url'),
            webhook_secret=trigger_data.get('webhook_secret'),
            table_id=trigger_data.get('table_id')
        )
    
    # Parse capabilities
    capabilities = []
    for cap_data in config_data.get('capabilities', []):
        capabilities.append(Capability(
            name=cap_data['name'],
            description=cap_data['description']
        ))
    
    # Parse capabilities (which contain steps)
    capabilities = []
    for cap_data in config_data.get('capabilities', []):
        # Parse steps for this capability
        cap_steps = []
        for step_data in cap_data.get('steps', []):
            cap_steps.append(AgentStep(
                id=step_data['id'],
                type=StepType(step_data.get('type', 'TOOL_STEP')),
                instructions=step_data['instructions'],
                tools=step_data.get('tools', []),
                servers=step_data.get('servers', [])
            ))
        
        capabilities.append(Capability(
            name=cap_data['name'],
            description=cap_data['description'],
            steps=cap_steps
        ))
    
    return Agent(
        id=str(config_data['id']),
        name=config_data['name'],
        role=config_data.get('role', ''),
        description=config_data.get('description', ''),
        persona=config_data.get('persona', ''),
        model=config_data.get('model'),
        tools=config_data.get('tools', []),
        servers=config_data.get('servers', []),
        goals=config_data.get('goals', []),
        trigger=trigger,
        capabilities=capabilities,
        database_id=config_data.get('database_id'),
        status=config_data.get('status', 'active'),
        organization_id=config_data.get('organization_id'),
        owner_id=config_data.get('owner_id'),
        api_key=config_data.get('api_key')
    )


async def execute_capability_command(agent_id: str, capability_name: str):
    """Execute a specific agent capability from command line."""
    setup_logging()
    logger = logging.getLogger(__name__)
    
    try:
        # Get configuration from environment
        config_json = os.getenv("EMERY_AGENT_CONFIG")
        trigger_json = os.getenv("EMERY_TRIGGER_DATA", "{}")
        overrides_json = os.getenv("EMERY_STEP_OVERRIDES", "[]")
        
        if not config_json:
            raise ValueError("EMERY_AGENT_CONFIG environment variable not set")
        
        # Parse configuration
        config_data = json.loads(config_json)
        trigger_data = json.loads(trigger_json)
        step_overrides = json.loads(overrides_json)
        
        agent = parse_agent_config(config_data)
        logger.info(f"Executing capability '{capability_name}' for agent {agent.name} (ID: {agent.id})")
        
        # Initialize integrations
        emery_client = EmeryClientIntegration(agent_id=agent.id)
        smolagents = SmolAgentsIntegration()
        mcp_servers = MCPServerIntegration(emery_client)
        
        # Create runner and execute capability
        runner = AgentRunner(emery_client, smolagents, mcp_servers)
        task_execution = await runner.execute_capability(agent, capability_name, trigger_data, step_overrides)
        
        # Output results as JSON
        result = {
            "execution_id": task_execution.id,
            "capability_name": task_execution.capability_name,
            "status": task_execution.status.value,
            "output_data": task_execution.output_data,
            "error_message": task_execution.error_message,
            "step_executions": [
                {
                    "step_id": step.step_id,
                    "step_type": step.step_type.value,
                    "status": step.status.value,
                    "output_data": step.output_data,
                    "error_message": step.error_message
                }
                for step in task_execution.step_executions
            ]
        }
        
        print(json.dumps(result, indent=2))
        
        # Exit with appropriate code
        sys.exit(0 if task_execution.status.value in ["completed"] else 1)
        
    except Exception as e:
        logger.exception(f"Agent execution failed: {e}")
        error_result = {
            "error": str(e),
            "status": "failed"
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: emery-agents <command> [args...]")
        print("Commands:")
        print("  execute <agent_id> <capability_name>  - Execute a specific agent capability")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "execute":
        if len(sys.argv) < 4:
            print("Usage: emery-agents execute <agent_id> <capability_name>")
            sys.exit(1)
        
        agent_id = sys.argv[2]
        capability_name = sys.argv[3]
        asyncio.run(execute_capability_command(agent_id, capability_name))
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()


# AIDEV-NOTE: This CLI allows NextJS to spawn agent execution as subprocess
# AIDEV-TODO: Add more CLI commands for debugging and testing
# AIDEV-TODO: Add configuration validation and better error handling