"""
SmolAgents Execution Service

AIDEV-NOTE: Pure smolagents execution service for protobuf TaskRequest.
Uses the proven hierarchical Agent → CapabilityAgents → StepAgents structure.
"""

import logging
import os
import time
import json
from typing import Dict, Any, List, Optional, Union, AsyncIterator

from smolagents import CodeAgent, ToolCallingAgent
from smolagents.models import InferenceClientModel

from ...core.entities import TaskRequest, TaskProgress, CapabilityConfig
from ...core.types import StepType, TaskStatus
from ...execution.capability_router import CapabilityRouter
from ...execution.capability_router_agent import CapabilityRouterAgent
from ...execution.tool_loader import ToolLoader

logger = logging.getLogger(__name__)

class SmolAgentsExecutionService:
    """
    Pure smolagents execution service for protobuf TaskRequest.
    
    AIDEV-NOTE: Converts protobuf entities to smolagents hierarchical structure
    and executes real agent tasks with streaming progress updates.
    """
    
    def __init__(self):
        self.agent_cache: Dict[str, CodeAgent] = {}  # Cache by task_id for isolation
        self.capability_router = CapabilityRouter()
        self.capability_router_agent = CapabilityRouterAgent()
        self.tool_loader = ToolLoader()
        logger.info("SmolAgentsExecutionService initialized")
    
    async def execute_task(self, request: TaskRequest) -> AsyncIterator[TaskProgress]:
        """
        Execute agent task using real smolagents with streaming progress.
        
        AIDEV-NOTE: Main entry point that converts protobuf request to smolagents execution.
        """
        logger.info(f"Executing task {request.task_id} for agent {request.agent_id}: {request.name}")
        
        start_time = time.time()
        
        try:
            # Yield initial progress
            yield TaskProgress(
                task_id=request.task_id,
                status=TaskStatus.TASK_IN_PROGRESS.name,
                step_id="routing",
                step_type="ROUTING",
                output_json=json.dumps({"message": "Routing execution mode"}),
                error_message="",
                timestamp_ms=int(time.time() * 1000),
                progress_percent=10.0
            )
            
            # Check if this should use CapabilityRouterAgent (capabilityName=null)
            if request.capability_name is None and request.instruction_config:
                # Use CapabilityRouterAgent for direct tool execution
                yield TaskProgress(
                    task_id=request.task_id,
                    status=TaskStatus.TASK_IN_PROGRESS.name,
                    step_id="direct_tool_execution",
                    step_type="TOOL_EXECUTION",
                    output_json=json.dumps({"message": "Using CapabilityRouterAgent for direct tool execution"}),
                    error_message="",
                    timestamp_ms=int(time.time() * 1000),
                    progress_percent=30.0
                )
                
                # Extract tool names from instruction config
                tool_names = [tool.name for tool in request.instruction_config.tools] if request.instruction_config.tools else None
                
                # Execute directly via CapabilityRouterAgent
                result = await self.capability_router_agent.execute_instructions(
                    instructions=request.instruction_config.instructions,
                    available_tools=tool_names
                )
                
                yield TaskProgress(
                    task_id=request.task_id,
                    status=TaskStatus.TASK_COMPLETED.name,
                    step_id="direct_tool_execution",
                    step_type="TOOL_EXECUTION",
                    output_json=json.dumps({"result": str(result)}),
                    error_message="",
                    timestamp_ms=int(time.time() * 1000),
                    progress_percent=100.0
                )
                
                return
            
            # Route to capability (existing logic)
            capability = self.capability_router.route_execution(request)
            
            yield TaskProgress(
                task_id=request.task_id,
                status=TaskStatus.TASK_IN_PROGRESS.name,
                step_id="setup",
                step_type="SETUP",
                output_json=json.dumps({"capability": capability.name, "steps": len(capability.steps)}),
                error_message="",
                timestamp_ms=int(time.time() * 1000),
                progress_percent=20.0
            )
            
            # Create smolagents agent for this capability
            smolagents_agent = await self._create_smolagents_agent(capability, request)
            
            # Execute each step with progress updates
            total_steps = len(capability.steps)
            for i, step in enumerate(capability.steps):
                step_progress = 30.0 + (60.0 * i / total_steps)
                
                yield TaskProgress(
                    task_id=request.task_id,
                    status=TaskStatus.TASK_IN_PROGRESS.name,
                    step_id=step.id,
                    step_type=step.type.name,
                    output_json=json.dumps({"message": f"Executing step: {step.instructions[:100]}"}),
                    error_message="",
                    timestamp_ms=int(time.time() * 1000),
                    progress_percent=step_progress
                )
                
                # Execute step (smolagents.run is not async)
                result = smolagents_agent.run(step.instructions)
                
                yield TaskProgress(
                    task_id=request.task_id,
                    status=TaskStatus.TASK_IN_PROGRESS.name,
                    step_id=step.id,
                    step_type=step.type.name,
                    output_json=json.dumps({"result": str(result)}),
                    error_message="",
                    timestamp_ms=int(time.time() * 1000),
                    progress_percent=30.0 + (60.0 * (i + 1) / total_steps)
                )
            
            # Final completion
            duration_ms = int((time.time() - start_time) * 1000)
            yield TaskProgress(
                task_id=request.task_id,
                status=TaskStatus.TASK_COMPLETED.name,
                step_id="completed",
                step_type="COMPLETION",
                output_json=json.dumps({
                    "message": "Task completed successfully",
                    "duration_ms": duration_ms,
                    "capability": capability.name
                }),
                error_message="",
                timestamp_ms=int(time.time() * 1000),
                progress_percent=100.0
            )
            
        except Exception as e:
            logger.exception(f"SmolAgents execution failed: {e}")
            yield TaskProgress(
                task_id=request.task_id,
                status=TaskStatus.TASK_FAILED.name,
                step_id="error",
                step_type="ERROR",
                output_json=json.dumps({"error": str(e)}),
                error_message=str(e),
                timestamp_ms=int(time.time() * 1000),
                progress_percent=0.0
            )
        
        finally:
            # Clean up cached agent
            if request.task_id in self.agent_cache:
                del self.agent_cache[request.task_id]
    
    async def _create_smolagents_agent(self, capability: CapabilityConfig, request: TaskRequest) -> CodeAgent:
        """
        Create smolagents agent from capability configuration.
        
        AIDEV-NOTE: Converts protobuf entities to smolagents hierarchical structure.
        """
        if request.task_id in self.agent_cache:
            return self.agent_cache[request.task_id]
        
        smolagents_agent = await self._create_capability_agent(capability, request)
        self.agent_cache[request.task_id] = smolagents_agent
        
        return smolagents_agent
    
    async def _create_capability_agent(self, capability: CapabilityConfig, request: TaskRequest) -> CodeAgent:
        """
        Create capability agent from CapabilityConfig.
        
        AIDEV-NOTE: Implements the proven hierarchical structure:
        CapabilityAgent → StepAgents where each step is a specialized agent.
        """
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError("HF_TOKEN environment variable is required")
        
        # Create step agents for this capability
        step_agents = []
        for step in capability.steps:
            step_agent = await self._create_step_agent(step, hf_token)
            step_agent.name = step.id
            step_agent.description = step.instructions
            step_agents.append(step_agent)
        
        # Create capability-level agent that manages step agents
        model = InferenceClientModel("Qwen/Qwen2.5-72B-Instruct", token=hf_token)
        
        capability_agent = CodeAgent(
            tools=[],  # Capability agent delegates to step agents
            model=model,
            managed_agents=step_agents,
            additional_authorized_imports=["time", "json", "os", "sys"]
        )
        
        capability_agent.name = capability.name
        capability_agent.description = capability.description
        
        return capability_agent
    
    async def _create_step_agent(self, step, hf_token: str) -> Union[CodeAgent, ToolCallingAgent]:
        """Create step-level agent based on step type."""
        model_name = step.model or (
            "Qwen/Qwen2.5-Coder-32B-Instruct" if step.type == StepType.CODE_STEP 
            else "Qwen/Qwen2.5-72B-Instruct"
        )
        model = InferenceClientModel(model_name, token=hf_token)
        
        # Load tools for this step
        step_tools = []
        if step.tools:
            try:
                step_tools = self.tool_loader.load_tools(step.tools)
            except Exception as e:
                logger.warning(f"Failed to load some tools for step {step.id}: {e}")
        
        if step.type == StepType.CODE_STEP:
            return CodeAgent(
                tools=step_tools,
                model=model,
                additional_authorized_imports=["time", "json", "os", "sys"]
            )
        else:
            return ToolCallingAgent(
                tools=step_tools,
                model=model
            )
    
    def _load_tool_from_config_legacy(self, tool_config) -> Optional[Any]:
        """Legacy tool loading method - use ToolLoader instead."""
        try:
            tool_name = getattr(tool_config, 'name', str(tool_config))
            
            if tool_name == "python_repl":
                from smolagents import PythonInterpreterTool
                return PythonInterpreterTool()
            elif tool_name == "web_search":
                from smolagents import DuckDuckGoSearchTool
                return DuckDuckGoSearchTool()
            elif tool_name == "speech_to_text":
                from smolagents import SpeechToTextTool
                return SpeechToTextTool()
            
            logger.warning(f"Tool {tool_name} not found in mappings")
            return None
            
        except ImportError as e:
            logger.warning(f"Could not import tool {tool_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to load tool {tool_name}: {e}")
            return None
    
    def clear_cache(self):
        """Clear cached agents (useful for testing)."""
        self.agent_cache.clear()


class LegacySmolAgentsOrchestrator:
    """
    Legacy orchestrator preserved for reference and gradual migration.
    
    AIDEV-NOTE: This is the original working implementation from commit 894075b.
    Will be gradually replaced by the DDD-integrated SmolAgentsExecutionService.
    """
    
    def __init__(self):
        self.agent: Optional[CodeAgent] = None
        logger.info("LegacySmolAgentsOrchestrator initialized")
    
    def setup_agent_orchestrator(self, agent) -> None:
        """Setup agent orchestrator from legacy agent structure."""
        logger.info("Setting up legacy agent orchestrator")
        
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            logger.error("HF_TOKEN environment variable is required")
            raise EnvironmentError("HF_TOKEN environment variable is required")
        
        logger.info(f"Setting up agent hierarchy for: {agent.name}")
        
        capability_agents = []
        if hasattr(agent, 'capabilities') and agent.capabilities:
            for capability in agent.capabilities:
                capability_agent = self._create_capability_agent(capability, hf_token)
                capability_agent.name = capability.name
                capability_agent.description = capability.description or f"Handles {capability.name} capability"
                capability_agents.append(capability_agent)
        
        model = InferenceClientModel("Qwen/Qwen2.5-72B-Instruct", token=hf_token)
        
        self.agent = CodeAgent(
            tools=[],
            model=model,
            managed_agents=capability_agents,
            additional_authorized_imports=["time", "json", "os", "sys"]
        )
        
        logger.info(f"Agent created with {len(capability_agents)} capability agents")
    
    def _create_capability_agent(self, capability, hf_token: str) -> CodeAgent:
        """Create capability-level agent."""
        step_agents = []
        for step in capability.steps:
            step_agent = self._create_step_agent(step, hf_token)
            step_agent.name = step.id
            step_agent.description = step.instructions
            step_agents.append(step_agent)
        
        model = InferenceClientModel("Qwen/Qwen2.5-72B-Instruct", token=hf_token)
        
        return CodeAgent(
            tools=[],
            model=model,
            managed_agents=step_agents,
            additional_authorized_imports=["time", "json", "os", "sys"]
        )
    
    def _create_step_agent(self, step, hf_token: str) -> Union[CodeAgent, ToolCallingAgent]:
        """Create step-level agent."""
        model_name = getattr(step, 'model', None) or (
            "Qwen/Qwen2.5-Coder-32B-Instruct" if step.type == StepType.CODE_STEP 
            else "Qwen/Qwen2.5-72B-Instruct"
        )
        model = InferenceClientModel(model_name, token=hf_token)
        
        step_tools = []
        if hasattr(step, 'tools') and step.tools:
            for tool_config in step.tools:
                tool_instance = self._load_tool(tool_config)
                if tool_instance:
                    step_tools.append(tool_instance)
        
        if step.type == StepType.CODE_STEP:
            return CodeAgent(
                tools=step_tools,
                model=model,
                additional_authorized_imports=["time", "json", "os", "sys"]
            )
        else:
            return ToolCallingAgent(
                tools=step_tools,
                model=model
            )
    
    def _load_tool(self, tool_config) -> Optional[Any]:
        """Load tool from config (legacy method)."""
        try:
            tool_name = getattr(tool_config, 'name', str(tool_config))
            
            if tool_name == "python_repl":
                from smolagents import PythonInterpreterTool
                return PythonInterpreterTool()
            elif tool_name == "web_search":
                from smolagents import DuckDuckGoSearchTool
                return DuckDuckGoSearchTool()
            elif tool_name == "speech_to_text":
                from smolagents import SpeechToTextTool
                return SpeechToTextTool()
            
            logger.warning(f"Tool {tool_name} not found in mappings")
            return None
            
        except Exception as e:
            logger.error(f"Failed to load tool {tool_name}: {e}")
            return None
    
    async def execute_with_orchestrator(self, instructions) -> Dict[str, Any]:
        """Execute task with legacy orchestrator."""
        if not self.agent:
            raise RuntimeError("Agent not set up. Call setup_agent_orchestrator() first.")
        
        logger.info(f"Executing task: {instructions[:100]}...")
        
        try:
            result = await self.agent.run(instructions)
            return {
                "status": "success",
                "result": {"output": result},
            }
        except Exception as e:
            logger.exception(f"Execution failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
            }