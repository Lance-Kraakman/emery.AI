"""
Simple hierarchical smolagents integration that directly models our system.

Architecture mirrors our system exactly:
Agent (CodeAgent)
  └── managed_agents: {capability_name: CapabilityAgent, ...}
      └── Each CapabilityAgent (CodeAgent)  
          └── managed_agents: [StepAgent1, StepAgent2, ...]
              └── Each StepAgent (CodeAgent/ToolCallingAgent) with step-specific tools/servers

ONE AGENT CALL: agent.run(instructions) - smolagents handles all internal routing
"""

import logging
import os
from typing import Dict, Any, List, Optional

# Constants
DEFAULT_HF_MODEL_CODE = "Qwen/Qwen2.5-Coder-32B-Instruct"
DEFAULT_HF_MODEL_GENERAL = "Qwen/Qwen2.5-72B-Instruct"

from ..core.types import (
    StepType, Agent, CapabilityConfig, TaskInstructions, 
    ContextData, CapabilityExecutionResult, OrchestratorResult
)
from smolagents import CodeAgent, ToolCallingAgent
from smolagents.models import InferenceClientModel
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env file if it exists
env_path = "/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/.env.local"
if os.path.exists(env_path):
    load_dotenv(env_path)
    logger.info(f"Loaded .env file from {env_path}")


class SmolAgentsOrchestrator:
    """
    Simple smolagents orchestrator that directly models our system architecture.
    
    Creates: Agent → CapabilityAgents → StepAgents hierarchy
    """
    
    def __init__(self):
        self.agent: Optional[CodeAgent] = None
        logger.info("SmolAgentsOrchestrator initialized")
    
    def setup_agent_orchestrator(self, agent: Agent) -> None:
        """
        Set up the agent hierarchy that directly mirrors our system structure.
        
        Args:
            agent: Agent configuration with capabilities → steps → tools/servers
        """
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError("HF_TOKEN environment variable is required")
        
        logger.info(f"Setting up agent hierarchy for: {agent.name}")
        
        # Create capability agents
        capability_agents = []
        if agent.capabilities:
            for capability in agent.capabilities:
                capability_agent = self._create_capability_agent(capability, hf_token)
                capability_agent.name = capability.name
                capability_agent.description = capability.description or f"Handles {capability.name} capability"
                capability_agents.append(capability_agent)
                logger.info(f"Created capability agent: {capability.name} with {len(capability.steps)} steps")
        
        # Create the top-level agent
        model = InferenceClientModel(DEFAULT_HF_MODEL_GENERAL, token=hf_token)
        
        self.agent = CodeAgent(
            tools=[],
            model=model,
            managed_agents=capability_agents,
            additional_authorized_imports=["time", "json", "os", "sys"]
        )
        
        logger.info(f"Agent created with {len(capability_agents)} capability agents")
    
    def _create_capability_agent(self, capability: CapabilityConfig, hf_token: str) -> CodeAgent:
        """Create a capability agent with managed step agents."""
        
        # Create step agents for this capability
        step_agents = []
        for step in capability.steps:
            step_agent = self._create_step_agent(step, hf_token)
            step_agent.name = step.id
            step_agent.description = step.instructions
            step_agents.append(step_agent)
            logger.debug(f"Created step agent: {step.id} ({step.type.value})")
        
        # Create capability agent with step agents as managed_agents
        model = InferenceClientModel(DEFAULT_HF_MODEL_GENERAL, token=hf_token)
        
        capability_agent = CodeAgent(
            tools=[],
            model=model,
            managed_agents=step_agents,
            additional_authorized_imports=["time", "json", "os", "sys"]
        )
        
        return capability_agent
    
    def _create_step_agent(self, step, hf_token: str) -> CodeAgent | ToolCallingAgent:
        """Create a step agent with step-specific tools and servers."""
        
        # Choose model based on step
        model_name = step.model or (
            DEFAULT_HF_MODEL_CODE if step.type == StepType.CODE_STEP 
            else DEFAULT_HF_MODEL_GENERAL
        )
        model = InferenceClientModel(model_name, token=hf_token)
        
        # Load step-specific tools
        step_tools = []
        if step.tools:
            for tool_config in step.tools:
                tool_instance = self._load_tool(tool_config)
                if tool_instance:
                    step_tools.append(tool_instance)
                    logger.debug(f"Loaded tool: {tool_config.name}")
        
        # Create appropriate agent type
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
    
    def _load_tool(self, tool_config):
        """Load a tool instance from configuration."""
        tool_name = tool_config.name if hasattr(tool_config, 'name') else str(tool_config)
        
        try:
            # Basic tool mappings - expand as needed
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
    
    async def execute_with_orchestrator(
        self, 
        instructions: TaskInstructions,
        trigger_data: ContextData
    ) -> OrchestratorResult:
        """
        Execute instructions using the hierarchical agent system.
        
        ONE AGENT CALL - smolagents handles all internal routing through the hierarchy.
        """
        if not self.agent:
            raise RuntimeError("Agent not set up. Call setup_agent_orchestrator() first.")
        
        logger.info(f"Executing task: {instructions.instructions[:100]}...")
        
        try:
            # Single agent call - smolagents manages the hierarchy internally
            result = await self.agent.run(instructions.instructions)
            
            return {
                "status": "success",
                "selected_capability": "smolagents_managed",
                "result": {
                    "capability_used": "smolagents_hierarchy",
                    "status": "completed",
                    "output": result,
                    "agent_type": "HierarchicalAgent"
                },
                "orchestrator": "smolagents_hierarchy"
            }
            
        except Exception as e:
            logger.exception(f"Execution failed: {e}")
            
            return {
                "status": "failed",
                "error": str(e),
                "result": {
                    "capability_used": "smolagents_hierarchy", 
                    "status": "failed",
                    "error": str(e),
                    "agent_type": "HierarchicalAgent"
                },
                "orchestrator": "smolagents_hierarchy"
            }


# AIDEV-NOTE: Simplified architecture directly models our system structure
# AIDEV-NOTE: Agent → CapabilityAgents → StepAgents with tools at step level
# AIDEV-NOTE: One agent call, smolagents handles all internal context and routing