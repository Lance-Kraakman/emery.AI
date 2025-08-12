"""
Core agent execution system for Emery.
Handles orchestration of multi-step agent workflows.
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from .types import (
    Agent, Task, StepExecution, AgentStep, Capability,
    TaskStatus, ExecutionContext, StepType
)
from .context_manager import ExecutionContextManager
from ..integrations.smolagents import SmolAgentsIntegration
from ..integrations.mcp_servers import MCPServerIntegration
from ..integrations.emery_client import EmeryClientIntegration


logger = logging.getLogger(__name__)


class AgentRunner:
    """
    Core agent execution orchestrator.
    
    Coordinates the execution of multi-step agent workflows by:
    1. Managing execution state and context
    2. Routing steps to appropriate execution engines (smolagents, MCP)
    3. Handling step dependencies and data flow
    4. Reporting progress and results back to Emery
    """
    
    def __init__(
        self, 
        emery_client: EmeryClientIntegration,
        smolagents: Optional[SmolAgentsIntegration] = None,
        mcp_servers: Optional[MCPServerIntegration] = None
    ):
        self.emery_client = emery_client
        self.smolagents = smolagents
        self.mcp_servers = mcp_servers
        
        logger.info("AgentRunner initialized")
    
    async def execute_capability(
        self, 
        agent: Agent, 
        capability_name: str,
        trigger_data: Dict[str, Any],
        step_overrides: Optional[List[Dict[str, Any]]] = None
    ) -> Task:
        """
        Execute a specific agent capability with all its steps.
        
        Args:
            agent: Agent configuration
            capability_name: Name of the capability to execute
            trigger_data: Data from the trigger that started this execution
            step_overrides: Optional step-level parameter overrides
            
        Returns:
            Task with results from all steps
        """
        # Find the capability to execute
        capability = None
        for cap in agent.capabilities:
            if cap.name == capability_name:
                capability = cap
                break
        
        if not capability:
            # AIDEV-NOTE: Add test capability for infrastructure testing
            if capability_name in ['test_capability', 'test', 'ping', 'health_check']:
                from .types import Capability, AgentStep, StepType
                capability = Capability(
                    name=capability_name,
                    description=f"Test capability for infrastructure validation",
                    steps=[
                        AgentStep(
                            id="test_step_1",
                            type=StepType.CODE_STEP,
                            instructions="Return success response with trigger data"
                        )
                    ]
                )
                logger.info(f"Using built-in test capability: {capability_name}")
            else:
                raise ValueError(f"Capability '{capability_name}' not found in agent {agent.id}")
        
        execution_id = str(uuid.uuid4())
        logger.info(f"Starting capability execution {execution_id} for agent {agent.id}, capability: {capability_name}")
        
        task = Task(
            id=execution_id,
            agent_id=int(agent.id),  # Convert to int to match schema
            name=f"Capability execution: {capability_name}",
            capability_name=capability_name,
            status=TaskStatus.IN_PROGRESS,
            payload=trigger_data,
            started_at=datetime.now()
        )
        
        # Use context manager for persistent state between steps
        with ExecutionContextManager(task, agent) as context_manager:
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
                    if step_result.output_data:
                        context_manager.save_step_output(step.id, step_result.output_data)
                    
                    # Mark step as completed
                    context_manager.mark_step_completed(step.id)
                    
                    # Stop execution if step failed
                    if step_result.status == TaskStatus.FAILED:
                        logger.error(f"Step {step.id} failed: {step_result.error_message}")
                        task.status = TaskStatus.FAILED
                        task.error = f"Step {step.id} failed: {step_result.error_message}"
                        break
                
                # Mark execution as completed if all steps succeeded
                if task.status == TaskStatus.IN_PROGRESS:
                    task.status = TaskStatus.COMPLETED
                    # Get final context as output
                    final_context = context_manager.get_context()
                    task.result = final_context.get("step_outputs", {})
                
            except Exception as e:
                logger.exception(f"Task execution {execution_id} failed with exception")
                task.status = TaskStatus.FAILED
                task.error = str(e)
            
            finally:
                task.completed_at = datetime.now()
                
                # Report execution results back to Emery
                await self._report_execution_results(task)
        
        logger.info(f"Task execution {execution_id} completed with status: {task.status}")
        return task
    
    async def _execute_step(
        self, 
        step: AgentStep, 
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
            task_id=step_context.get('execution_id', ''),
            step_id=step.id,
            step_type=step.type,  # Use the StepType enum
            instructions=step.instructions,
            tools=step.tools,
            servers=step.servers,
            input_data=step_context,
            started_at=datetime.now()
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
                step_execution.output_data = result
                
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
                    step_execution.output_data = result
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
                    
                    step_execution.output_data = server_results
                else:
                    # No tools or servers - check if this is a test step
                    if step.id == "test_step_1" or "test" in step.id.lower():
                        # Return successful test response
                        step_execution.output_data = {
                            "success": True,
                            "message": "Test capability executed successfully",
                            "trigger_data": context_manager.context.payload,
                            "timestamp": datetime.now().isoformat(),
                            "step_id": step.id
                        }
                    else:
                        # No tools or servers - just pass through
                        step_execution.output_data = step_context
            
            step_execution.status = TaskStatus.COMPLETED
            
        except Exception as e:
            logger.exception(f"Step {step.id} execution failed")
            step_execution.status = TaskStatus.ERROR
            step_execution.error_message = str(e)
        
        finally:
            step_execution.completed_at = datetime.now()
        
        logger.info(f"Step {step.id} completed with status: {step_execution.status}")
        return step_execution
    
    def _apply_step_overrides(
        self, 
        step: AgentStep, 
        overrides: Optional[List[Dict[str, Any]]], 
        step_index: int
    ) -> AgentStep:
        """Apply any step-level parameter overrides from the execution request."""
        if not overrides or step_index >= len(overrides):
            return step
        
        override = overrides[step_index]
        
        # Create a copy of the step with overrides applied
        return AgentStep(
            id=step.id,
            type=StepType(override.get('type', step.type.value)),
            instructions=override.get('instructions', step.instructions),
            tools=override.get('tools', step.tools),
            servers=override.get('servers', step.servers)
            # AIDEV-NOTE: Simplified step configuration with StepType enum
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