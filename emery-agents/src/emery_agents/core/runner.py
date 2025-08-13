"""Core agent execution orchestrator using simplified smolagents hierarchy."""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from .types import (
    Agent, Task, StepConfig, CapabilityConfig,
    TaskStatus, StepType, TaskInstructions
)
from ..integrations.smolagents import SmolAgentsOrchestrator
from ..integrations.mcp_servers import MCPServerIntegration
from ..integrations.emery_client import EmeryClientIntegration


logger = logging.getLogger(__name__)


class AgentRunner:
    """Simplified agent orchestrator using hierarchical smolagents execution."""
    
    def __init__(
        self, 
        emery_client: EmeryClientIntegration,
        smolagents: Optional[SmolAgentsOrchestrator] = None,
        mcp_servers: Optional[MCPServerIntegration] = None
    ):
        self.emery_client = emery_client
        self.smolagents = smolagents or SmolAgentsOrchestrator()
        self.mcp_servers = mcp_servers
        
        logger.info("AgentRunner initialized with simplified smolagents integration")
    
    def _find_or_create_capability(self, agent: Agent, capability_name: str) -> CapabilityConfig:
        """Find capability in agent or create test capability."""
        if agent.capabilities:
            for cap in agent.capabilities:
                if cap.name == capability_name:
                    return cap
        
        if capability_name in ['test_capability', 'test', 'ping', 'health_check']:
            return CapabilityConfig(
                name=capability_name,
                description="Test capability for infrastructure validation",
                steps=[StepConfig(
                    id="test_step_1",
                    type=StepType.CODE_STEP,
                    instructions="Return success response with trigger data"
                )]
            )
        
        raise ValueError(f"Capability '{capability_name}' not found in agent {agent.id}")
    
    async def execute_capability(
        self, 
        agent: Agent, 
        capability_name: str,
        step_overrides: Optional[List[Dict[str, Any]]] = None
    ) -> Task:
        """Execute agent capability using simplified smolagents hierarchy."""
        capability = self._find_or_create_capability(agent, capability_name)
        execution_id = str(uuid.uuid4())
        
        logger.info(f"Starting execution {execution_id} for agent {agent.id}, capability: {capability_name}")
        
        task = Task(
            id=execution_id,
            agentId=int(agent.id),
            name=f"Capability execution: {capability_name}",
            instructions=TaskInstructions(instructions=f"Execute capability: {capability_name}"),
            capabilityName=capability_name,
            status=TaskStatus.IN_PROGRESS,
            startedAt=datetime.now()
        )
        
        try:
            # Set up the agent hierarchy that mirrors our system structure
            self.smolagents.setup_agent_orchestrator(agent)
            
            # Create execution instructions
            instructions = TaskInstructions(
                instructions=f"Execute {capability_name} capability: {capability.description}"
            )
            
            # ONE AGENT CALL - smolagents handles all steps internally
            result = await self.smolagents.execute_with_orchestrator(
                instructions=instructions,
            )
            
            # Update task status based on result
            if result["status"] == "success":
                task.status = TaskStatus.COMPLETED
                task.result = result["result"]["output"]
            else:
                task.status = TaskStatus.FAILED
                task.error = result.get("error", "Unknown execution error")
                
        except Exception as e:
            logger.exception(f"Task execution {execution_id} failed with exception")
            task.status = TaskStatus.FAILED
            task.error = str(e)
        
        finally:
            task.completedAt = datetime.now()
            
            # Report execution results back to Emery
            await self._report_execution_results(task)
        
        logger.info(f"Task execution {execution_id} completed with status: {task.status}")
        return task
    
    async def _report_execution_results(self, task: Task) -> None:
        """Report execution results back to the Emery system."""
        try:
            await self.emery_client.report_execution_result(task)
            logger.info(f"Reported execution results for {task.id}")
        except Exception as e:
            logger.error(f"Failed to report execution results: {e}")


# AIDEV-NOTE: Simplified runner using smolagents hierarchy - Agent → CapabilityAgents → StepAgents
# AIDEV-NOTE: No more ExecutionContextManager or complex step sequencing
# AIDEV-NOTE: One agent call handles entire capability execution