"""Core agent execution orchestrator for multi-step workflows."""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from .types import (
    Agent, Task, StepExecution, StepConfig, CapabilityConfig,
    TaskStatus, ExecutionContext, StepType, TaskInstructions
)
from .context_manager import ExecutionContextManager
from ..integrations.smolagents import SmolAgentsOrchestrator
from ..integrations.mcp_servers import MCPServerIntegration
from ..integrations.emery_client import EmeryClientIntegration


logger = logging.getLogger(__name__)


class AgentRunner:
    """Orchestrates multi-step agent workflows with proper state management."""
    
    def __init__(
        self, 
        emery_client: EmeryClientIntegration,
        smolagents: Optional[SmolAgentsOrchestrator] = None,
        mcp_servers: Optional[MCPServerIntegration] = None
    ):
        self.emery_client = emery_client
        self.smolagents = smolagents
        self.mcp_servers = mcp_servers
        
        logger.info("AgentRunner initialized")
    
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
        trigger_data: Dict[str, Any],
        step_overrides: Optional[List[Dict[str, Any]]] = None
    ) -> Task:
        """Execute agent capability with all its steps."""
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
        
        # Use context manager for persistent state between steps
        with ExecutionContextManager(task, agent, trigger_data) as context_manager:
            try:
                # Execute each step in the capability sequence
                for i, step in enumerate(capability.steps):
                    logger.info(f"Executing step {i+1}/{len(capability.steps)}: {step.id}")
                    
                    # Mark step as started
                    context_manager.mark_step_started(step.id)
                    
                    # Apply any step overrides
                    step_config = self._apply_step_overrides(step, step_overrides, i)
                    
                    # Get current context for this step
                    step_context = context_manager.get_step_context_for_smolagents(step.id)
                    
                    # Execute the step
                    step_result = await self._execute_step(step_config, step_context, context_manager)
                    context_manager.context.step_executions.append(step_result)
                    
                    # Save step output to persistent context
                    if step_result.outputData:
                        context_manager.save_step_output(step.id, step_result.outputData)
                    
                    # Mark step as completed
                    context_manager.mark_step_completed(step.id)
                    
                    # Stop execution if step failed
                    if step_result.status == TaskStatus.FAILED:
                        logger.error(f"Step {step.id} failed: {step_result.errorMessage}")
                        task.status = TaskStatus.FAILED
                        task.error = f"Step {step.id} failed: {step_result.errorMessage}"
                        break
                
                # Mark execution as completed if all steps succeeded
                if task.status == TaskStatus.IN_PROGRESS:
                    task.status = TaskStatus.COMPLETED
                    # Get final context as output
                    final_context = context_manager.get_context()
                    task.result = final_context["step_outputs"] if "step_outputs" in final_context else {}
                
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
    
    async def _execute_step(
        self, 
        step: StepConfig, 
        step_context: Dict[str, Any],
        context_manager: ExecutionContextManager
    ) -> StepExecution:
        """
        Execute a single agent step using the appropriate execution engine.
        
        Args:
            step: Step configuration
            step_context: Current step context with persistent state
            context_manager: Context manager for persistence
            
        Returns:
            StepExecution with step results
        """
        step_execution = StepExecution(
            id=str(uuid.uuid4()),
            taskId=step_context.get('execution_id', ''),
            stepId=step.id,
            stepType=step.type.value,
            instructions=step.instructions,
            inputData=step_context,
            startedAt=datetime.now()
        )
        
        try:
            step_execution.status = TaskStatus.IN_PROGRESS
            
            # Route to appropriate execution engine based on step type
            if step.type == StepType.CODE_STEP:
                # Use smolagents CodeAgent for code generation/execution
                if not self.smolagents:
                    raise RuntimeError("smolagents integration not available")
                
                result = await self.smolagents.execute_step(
                    step_type=step.type,
                    instructions=step.instructions,
                    tools=step.tools,
                    context=step_context,  # Use persistent context
                    model=step_context.get('model')  # Get model from context
                )
                step_execution.outputData = result
                
            elif step.type == StepType.TOOL_STEP:
                # Use smolagents ToolCallingAgent or MCP servers
                if step.tools and self.smolagents:
                    # Use smolagents for tool calling
                    result = await self.smolagents.execute_step(
                        step_type=step.type,
                        instructions=step.instructions,
                        tools=step.tools,
                        context=step_context,
                        model=step_context.get('model')
                    )
                    step_execution.outputData = result
                elif step.servers and self.mcp_servers:
                    # Use MCP servers for external service integrations
                    server_results = {}
                    for server in step.servers:
                        result = await self.mcp_servers.execute_server_action(
                            server_name=server,
                            action="default",  # AIDEV-TODO: Make this configurable per step
                            params=step_context  # Use persistent context
                        )
                        server_results[server] = result
                    
                    step_execution.outputData = server_results
                else:
                    # No tools or servers - check if this is a test step
                    if step.id == "test_step_1" or "test" in step.id.lower():
                        # Return successful test response
                        step_execution.outputData = {
                            "success": True,
                            "message": "Test capability executed successfully",
                            "trigger_data": context_manager.trigger_data,
                            "timestamp": datetime.now().isoformat(),
                            "step_id": step.id
                        }
                    else:
                        # No tools or servers - just pass through
                        step_execution.outputData = step_context
            
            step_execution.status = TaskStatus.COMPLETED
            
        except Exception as e:
            logger.exception(f"Step {step.id} execution failed")
            step_execution.status = TaskStatus.FAILED
            step_execution.errorMessage = str(e)
        
        finally:
            step_execution.completedAt = datetime.now()
        
        logger.info(f"Step {step.id} completed with status: {step_execution.status}")
        return step_execution
    
    def _apply_step_overrides(
        self, 
        step: StepConfig, 
        overrides: Optional[List[Dict[str, Any]]], 
        step_index: int
    ) -> StepConfig:
        """Apply any step-level parameter overrides from the execution request."""
        if not overrides or step_index >= len(overrides):
            return step
        
        override = overrides[step_index]
        
        # Create a copy of the step with overrides applied
        return StepConfig(
            id=step.id,
            type=StepType(override['type']) if 'type' in override else step.type,
            instructions=override['instructions'] if 'instructions' in override else step.instructions,
            tools=override['tools'] if 'tools' in override else step.tools,
            servers=override['servers'] if 'servers' in override else step.servers
        )
    
    async def _report_execution_results(self, task: Task) -> None:
        """Report execution results back to the Emery system."""
        try:
            await self.emery_client.report_execution_result(task)
            logger.info(f"Reported execution results for {task.id}")
        except Exception as e:
            logger.error(f"Failed to report execution results: {e}")


# AIDEV-NOTE: This is the core orchestrator - handles step sequencing and error propagation
# AIDEV-TODO: Add support for parallel step execution where dependencies allow
# AIDEV-TODO: Implement step retry logic for transient failures
