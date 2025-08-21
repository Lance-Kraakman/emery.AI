import logging
import os
from typing import Dict, Any, List, Optional, Union

from smolagents import CodeAgent, ToolCallingAgent
from smolagents.models import InferenceClientModel

from ..core.types import (
    StepType, Agent, CapabilityConfig, TaskInstructions, OrchestratorResult, ToolConfig
)
from ..tools.converters import ToolConfigConverter
from ..tools import tool_registry

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

logger.info("hello from orcha")

class SmolAgentsOrchestrator:
    def __init__(self):
        self.agent: Optional[CodeAgent] = None
        logger.info("SmolAgentsOrchestrator initialized")
    
    def setup_agent_orchestrator(self, agent: Agent) -> None:
        logger.info("Setting up agent orchestrator")
        logger.info(f"Environment variables present: {list(os.environ.keys())}")
        
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            logger.error("HF_TOKEN environment variable is required. Get your token from https://huggingface.co/settings/tokens")
            raise EnvironmentError("HF_TOKEN environment variable is required. Get your token from https://huggingface.co/settings/tokens")
        
        logger.info(f"HF_TOKEN found: {hf_token[:10]}...")
        
        logger.info(f"Setting up agent hierarchy for: {agent.name}")
        
        capability_agents = []
        if agent.capabilities:
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
    
    def _create_capability_agent(self, capability: CapabilityConfig, hf_token: str) -> CodeAgent:
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
    
    def _create_step_agent(self, step, hf_token: str) -> CodeAgent | ToolCallingAgent:
        model_name = step.model or ("Qwen/Qwen2.5-Coder-32B-Instruct" if step.type == StepType.CODE_STEP else "Qwen/Qwen2.5-72B-Instruct")
        model = InferenceClientModel(model_name, token=hf_token)
        
        step_tools = []
        if step.tools:
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
    
    def _load_tool(self, tool_config: Union[ToolConfig, Dict[str, Any]]) -> Optional[Any]:
        """Load tool using the centralized tool registry."""
        tool_name = ToolConfigConverter.get_tool_name(tool_config)
        
        try:
            # Convert tool config to registry format
            config_dict = ToolConfigConverter.from_agent_config(tool_config)
            
            # Find tool type by name
            tool_type = ToolConfigConverter.find_tool_type_by_name(tool_name)
            if not tool_type:
                logger.warning(f"Tool {tool_name} not found in registry")
                return None
            
            logger.info(f"Creating tool {tool_name} via registry")
            return tool_registry.create_tool_instance(tool_type, config_dict)
            
        except Exception as e:
            logger.error(f"Failed to load tool {tool_name}: {e}")
            return None
    
    async def execute_with_orchestrator(
        self, 
        instructions: TaskInstructions,
    ) -> OrchestratorResult:
        if not self.agent:
            raise RuntimeError("Agent not set up. Call setup_agent_orchestrator() first.")
        
        logger.info(f"Executing task: {instructions.instructions[:100]}...")
        
        try:
            result = await self.agent.run(instructions.instructions)
            return {
                "status": "success",
                "result": {
                    "output": result,
                },
            }
        except Exception as e:
            logger.exception(f"Execution failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
            }
