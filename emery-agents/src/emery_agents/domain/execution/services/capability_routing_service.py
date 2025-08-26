"""
Capability Routing Domain Service

AIDEV-NOTE: Pure domain service for routing execution modes.
Contains business logic for determining execution strategy.
"""

from typing import Optional
from ....core.entities import CapabilityConfig
from ..entities.execution_context import ExecutionContext, ExecutionMode
from ....core.entities import TaskRequest, StepConfig
from ....core.types import StepType


class CapabilityRoutingService:
    """Domain service for capability-based routing decisions."""
    
    def determine_execution_context(self, request: TaskRequest) -> ExecutionContext:
        """
        Determine execution context from TaskRequest.
        
        Args:
            request: TaskRequest with either capability_name or instruction_config
            
        Returns:
            ExecutionContext for task execution
            
        Raises:
            ValueError: If no valid execution mode specified
        """
        if request.capability_name:
            return self._create_capability_context(request)
        elif request.instruction_config:
            return self._create_instruction_context(request)
        else:
            raise ValueError("TaskRequest must specify either capability_name or instruction_config")
    
    def find_capability_by_name(self, agent_capabilities: list[CapabilityConfig], 
                               capability_name: str) -> Optional[CapabilityConfig]:
        """
        Find specific capability by name in agent capabilities.
        
        Args:
            agent_capabilities: List of available capabilities
            capability_name: Name of capability to find
            
        Returns:
            CapabilityConfig if found, None otherwise
        """
        for capability in agent_capabilities:
            if capability.name == capability_name:
                return capability
        return None
    
    def create_dynamic_capability(self, instructions: str, tools: list = None, 
                                 servers: list = None) -> CapabilityConfig:
        """
        Create a dynamic capability from instruction configuration.
        
        Args:
            instructions: Task instructions
            tools: Optional list of tools
            servers: Optional list of servers
            
        Returns:
            CapabilityConfig for execution
        """
        # Determine step type based on tools availability
        step_type = StepType.TOOL_STEP if tools else StepType.CODE_STEP
        
        step = StepConfig(
            id="dynamic_instruction_step",
            type=step_type,
            instructions=instructions,
            model="Qwen/Qwen2.5-14B-Instruct",  # Default model
            tools=tools or [],
            servers=servers or []
        )
        
        return CapabilityConfig(
            name="dynamic_capability",
            description=f"Dynamic capability: {instructions[:100]}...",
            steps=[step]
        )
    
    def _create_capability_context(self, request: TaskRequest) -> ExecutionContext:
        """Create execution context for capability-based execution."""
        capability = self.find_capability_by_name(
            request.agent_config.capabilities, 
            request.capability_name
        )
        
        if not capability:
            raise ValueError(f"Capability '{request.capability_name}' not found")
        
        # Extract tools from capability steps
        all_tools = []
        for step in capability.steps:
            if step.tools:
                all_tools.extend([tool.name for tool in step.tools])
        
        return ExecutionContext(
            mode=ExecutionMode.CAPABILITY_BASED,
            instructions=capability.description,
            available_tools=list(set(all_tools)),  # Remove duplicates
            agent_id=request.agent_config.id if request.agent_config else None,
            organization_id=request.organization_id,
            capability_name=request.capability_name
        )
    
    def _create_instruction_context(self, request: TaskRequest) -> ExecutionContext:
        """Create execution context for instruction-based execution."""
        instruction_config = request.instruction_config
        
        # Extract tool names from instruction config
        tool_names = []
        if instruction_config.tools:
            tool_names = [tool.name for tool in instruction_config.tools]
        
        return ExecutionContext(
            mode=ExecutionMode.INSTRUCTION_BASED,
            instructions=instruction_config.instructions,
            available_tools=tool_names,
            agent_id=request.agent_config.id if request.agent_config else None,
            organization_id=request.organization_id,
            capability_name=None
        )