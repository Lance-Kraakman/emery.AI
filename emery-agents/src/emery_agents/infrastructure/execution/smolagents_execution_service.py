"""
SmolAgents Execution Service

AIDEV-NOTE: Ports the working SmolAgentsOrchestrator to DDD execution service.
This replaces MockAgentService with real smolagents execution using the hierarchical
Agent → CapabilityAgents → StepAgents structure.
"""

import logging
import os
from typing import Dict, Any, List, Optional, Union

from smolagents import CodeAgent, ToolCallingAgent
from smolagents.models import InferenceClientModel

from ...domain.agents.entities.agent import Agent
from ...domain.agents.value_objects.execution_context import ExecutionContext
from ...domain.agents.repositories.agent_execution_repository import (
    AgentExecutionRequest, AgentExecutionResult
)

logger = logging.getLogger(__name__)

# Legacy types for conversion compatibility
class StepType:
    CODE_STEP = "CODE_STEP"
    TOOL_STEP = "TOOL_STEP"

class SmolAgentsExecutionService:
    """
    Real smolagents execution service for DDD architecture.
    
    AIDEV-NOTE: Converts DDD domain entities to smolagents hierarchical structure
    and executes real agent tasks using the proven orchestrator pattern.
    """
    
    def __init__(self):
        self.agent_cache: Dict[int, CodeAgent] = {}
        logger.info("SmolAgentsExecutionService initialized")
    
    async def execute_task(self, request: AgentExecutionRequest) -> AgentExecutionResult:
        """
        Execute agent task using real smolagents.
        
        AIDEV-NOTE: Main entry point that converts DDD request to smolagents execution.
        """
        logger.info(f"Executing task for agent {request.agent_id.value}: {request.instructions[:50]}...")
        
        try:
            # Get or create smolagents agent
            smolagents_agent = await self._get_or_create_smolagents_agent(request)
            
            # Execute using smolagents
            result = await smolagents_agent.run(request.instructions)
            
            # Convert result to DDD format
            return AgentExecutionResult(
                success=True,
                execution_id=request.execution_id,
                status="completed",
                output_data={"output": result},
                duration_ms=0  # TODO: Add timing
            )
            
        except Exception as e:
            logger.exception(f"SmolAgents execution failed: {e}")
            return AgentExecutionResult(
                success=False,
                execution_id=request.execution_id,
                status="failed",
                error=str(e)
            )
    
    async def _get_or_create_smolagents_agent(self, request: AgentExecutionRequest) -> CodeAgent:
        """
        Get cached smolagents agent or create new one from DDD agent entity.
        
        AIDEV-NOTE: Converts DDD Agent entity to smolagents hierarchical structure.
        """
        agent_id = request.agent_id.value
        
        if agent_id in self.agent_cache:
            return self.agent_cache[agent_id]
        
        # TODO: Get agent from repository - for now create a basic agent
        smolagents_agent = await self._create_smolagents_agent_from_request(request)
        self.agent_cache[agent_id] = smolagents_agent
        
        return smolagents_agent
    
    async def _create_smolagents_agent_from_request(self, request: AgentExecutionRequest) -> CodeAgent:
        """
        Create smolagents agent from execution request.
        
        AIDEV-NOTE: This is a simplified version. In full implementation,
        this would load the full Agent entity and convert capabilities to 
        the hierarchical Agent → CapabilityAgents → StepAgents structure.
        """
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError("HF_TOKEN environment variable is required")
        
        model = InferenceClientModel("Qwen/Qwen2.5-72B-Instruct", token=hf_token)
        
        # For now, create a simple agent with tools from request
        tools = []
        if request.tools:
            for tool_config in request.tools:
                tool_instance = self._load_tool_from_config(tool_config)
                if tool_instance:
                    tools.append(tool_instance)
        
        return CodeAgent(
            tools=tools,
            model=model,
            managed_agents=[],  # TODO: Add capability agents
            additional_authorized_imports=["time", "json", "os", "sys"]
        )
    
    def _load_tool_from_config(self, tool_config) -> Optional[Any]:
        """
        Load tool from configuration.
        
        AIDEV-NOTE: Simplified tool loading. Full implementation would use
        the ported ToolRegistry and ToolConfigConverter.
        """
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