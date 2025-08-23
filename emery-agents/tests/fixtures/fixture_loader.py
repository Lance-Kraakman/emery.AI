"""
Fixture Loader for Real Agent Testing

AIDEV-NOTE: Converts JSON test fixtures to protobuf-compatible entities
for real agent execution testing.
"""

import json
import os
from typing import List, Dict, Any

# Import just the core entities without the full package
import sys
src_path = os.path.join(os.path.dirname(__file__), '..', '..', 'src')
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from emery_agents.core.entities import (
    AgentConfig, CapabilityConfig, StepConfig, ToolConfig, ServerConfig,
    TaskRequest, InstructionConfig, TriggerData
)
from emery_agents.core.types import StepType


class FixtureLoader:
    """Loads and converts JSON fixtures to domain entities."""
    
    def __init__(self, fixtures_dir: str = None):
        if fixtures_dir is None:
            fixtures_dir = os.path.dirname(__file__)
        self.fixtures_dir = fixtures_dir
    
    def load_agents(self) -> List[AgentConfig]:
        """Load agents from JSON fixture."""
        agents_path = os.path.join(self.fixtures_dir, "agents.json")
        
        with open(agents_path, 'r') as f:
            agents_data = json.load(f)
        
        agents = []
        for agent_data in agents_data:
            agent = self._convert_agent_from_json(agent_data)
            agents.append(agent)
        
        return agents
    
    def load_tasks(self) -> List[Dict[str, Any]]:
        """Load tasks from JSON fixture."""
        tasks_path = os.path.join(self.fixtures_dir, "tasks.json")
        
        with open(tasks_path, 'r') as f:
            tasks_data = json.load(f)
        
        return tasks_data
    
    def create_task_request(self, task_data: Dict[str, Any], agent_config: AgentConfig) -> TaskRequest:
        """Convert task JSON data to TaskRequest entity."""
        
        # Handle instruction_config if present
        instruction_config = None
        capability_name = None
        
        if "instructions" in task_data and isinstance(task_data["instructions"], dict):
            instructions_data = task_data["instructions"]
            
            # Convert tools if present
            tools = []
            if "tools" in instructions_data:
                for tool_data in instructions_data["tools"]:
                    tools.append(ToolConfig(
                        name=tool_data["name"],
                        version=tool_data.get("version", "1.0"),
                        config=tool_data.get("config", {})
                    ))
            
            # Convert servers if present
            servers = []
            if "servers" in instructions_data:
                for server_data in instructions_data["servers"]:
                    servers.append(ServerConfig(
                        name=server_data["name"],
                        endpoint=server_data.get("endpoint", ""),
                        config=server_data.get("config", {})
                    ))
            
            instruction_config = InstructionConfig(
                instructions=instructions_data["instructions"],
                tools=tools,
                servers=servers
            )
        
        # Use capability_name if instruction_config not available
        if instruction_config is None and "capabilityName" in task_data:
            capability_name = task_data["capabilityName"]
        
        return TaskRequest(
            task_id=task_data["id"],
            agent_id=task_data["agentId"],
            agent_config=agent_config,
            trigger_data=TriggerData(payload={}),
            organization_id="test_org",
            owner_id="test_user",
            timeout_seconds=300,
            name=task_data["name"],
            capability_name=capability_name,
            instruction_config=instruction_config
        )
    
    def find_agent_by_id(self, agent_id: int, agents: List[AgentConfig]) -> AgentConfig:
        """Find agent by ID in the agents list."""
        # Since AgentConfig doesn't have id, we'll match by position for now
        # In real scenario, you'd have a proper ID field
        if agent_id <= len(agents):
            return agents[agent_id - 1]  # Assuming 1-based IDs
        raise ValueError(f"Agent with ID {agent_id} not found")
    
    def _convert_agent_from_json(self, agent_data: Dict[str, Any]) -> AgentConfig:
        """Convert JSON agent data to AgentConfig entity."""
        
        # Convert tools
        tools = []
        if "tools" in agent_data:
            for tool_data in agent_data["tools"]:
                tools.append(ToolConfig(
                    name=tool_data["name"],
                    version=tool_data.get("version", "1.0"),
                    config=tool_data.get("config", {})
                ))
        
        # Convert servers
        servers = []
        if "servers" in agent_data:
            for server_data in agent_data["servers"]:
                servers.append(ServerConfig(
                    name=server_data["name"],
                    endpoint=server_data.get("endpoint", ""),
                    config=server_data.get("config", {})
                ))
        
        # Convert capabilities
        capabilities = []
        if "capabilities" in agent_data:
            for cap_data in agent_data["capabilities"]:
                capability = self._convert_capability_from_json(cap_data)
                capabilities.append(capability)
        
        return AgentConfig(
            name=agent_data["name"],
            role=agent_data.get("role", "assistant"),
            description=agent_data.get("description", ""),
            persona=agent_data.get("persona", "Helpful assistant"),
            tools=tools,
            servers=servers,
            capabilities=capabilities
        )
    
    def _convert_capability_from_json(self, cap_data: Dict[str, Any]) -> CapabilityConfig:
        """Convert JSON capability data to CapabilityConfig entity."""
        
        steps = []
        for step_data in cap_data["steps"]:
            step = self._convert_step_from_json(step_data)
            steps.append(step)
        
        return CapabilityConfig(
            name=cap_data["name"],
            description=cap_data.get("description", ""),
            steps=steps
        )
    
    def _convert_step_from_json(self, step_data: Dict[str, Any]) -> StepConfig:
        """Convert JSON step data to StepConfig entity."""
        
        # Convert step type
        step_type_str = step_data["type"]
        if step_type_str == "CODE_STEP":
            step_type = StepType.CODE_STEP
        elif step_type_str == "TOOL_STEP":
            step_type = StepType.TOOL_STEP
        else:
            raise ValueError(f"Unknown step type: {step_type_str}")
        
        # Convert tools
        tools = []
        if "tools" in step_data:
            for tool_data in step_data["tools"]:
                tools.append(ToolConfig(
                    name=tool_data["name"],
                    version=tool_data.get("version", "1.0"),
                    config=tool_data.get("config", {})
                ))
        
        # Convert servers
        servers = []
        if "servers" in step_data:
            for server_data in step_data["servers"]:
                servers.append(ServerConfig(
                    name=server_data["name"],
                    endpoint=server_data.get("endpoint", ""),
                    config=server_data.get("config", {})
                ))
        
        return StepConfig(
            id=step_data["id"],
            type=step_type,
            instructions=step_data["instructions"],
            model=step_data.get("model", "Qwen/Qwen2.5-72B-Instruct"),  # Default model
            tools=tools,
            servers=servers
        )
    
    def get_test_scenarios(self) -> List[Dict[str, Any]]:
        """Get predefined test scenarios combining agents and tasks."""
        agents = self.load_agents()
        tasks = self.load_tasks()
        
        scenarios = []
        
        for task_data in tasks:
            try:
                agent_config = self.find_agent_by_id(task_data["agentId"], agents)
                task_request = self.create_task_request(task_data, agent_config)
                
                scenarios.append({
                    "name": f"{agent_config.name} - {task_data['name']}",
                    "description": f"Agent: {agent_config.role} | Task: {task_data['name']}",
                    "agent": agent_config,
                    "task": task_request,
                    "execution_mode": "capability" if task_request.capability_name else "instruction",
                    "expected_status": task_data.get("status", "pending")
                })
            except Exception as e:
                print(f"Warning: Failed to create scenario for task {task_data.get('id', 'unknown')}: {e}")
        
        return scenarios