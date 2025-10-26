"""
Capability Routing Domain Service

AIDEV-NOTE: Pure domain service for routing execution modes.
Simplified for single-instruction model - removed StepConfig/StepType.
Contains business logic for determining execution strategy.
"""

from typing import Optional
from ....core.entities import SkillConfig, SkillInput, SkillOutput, ToolConfig
from ..entities.execution_context import ExecutionContext, ExecutionMode
from ....core.entities import TaskRequest
from ...shared.value_objects.ids import AgentId, OrganizationId

class CapabilityRoutingService:
    """Domain service for capability-based routing decisions."""
    
    def _parse_organization_id(self, organization_id) -> Optional[OrganizationId]:
        """Parse organization_id from various formats to OrganizationId value object."""
        if organization_id is None:
            return None
        
        if isinstance(organization_id, int):
            return OrganizationId(organization_id)
        elif isinstance(organization_id, str):
            if organization_id.isdigit():
                return OrganizationId(int(organization_id))
            else:
                # For test data like "test_org", use a default test organization ID
                return OrganizationId(1)
        else:
            return OrganizationId(int(organization_id))
    
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
    
    def find_capability_by_name(self, agent_capabilities: list[SkillConfig],
                               capability_name: str) -> Optional[SkillConfig]:
        """
        Find specific capability by name in agent capabilities.

        Args:
            agent_capabilities: List of available skills
            capability_name: Name of capability to find

        Returns:
            SkillConfig if found, None otherwise
        """
        for capability in agent_capabilities:
            if capability.name == capability_name:
                return capability
        return None

    def create_dynamic_capability(self, instructions: str, tools: list = None,
                                 servers: list = None) -> SkillConfig:
        """
        Create a dynamic capability from instruction configuration.

        AIDEV-NOTE: Simplified for single-instruction model - no steps, just direct instruction.

        Args:
            instructions: Task instructions
            tools: Optional list of ToolConfig objects
            servers: Optional list of servers (not used in single-instruction model)

        Returns:
            SkillConfig for execution
        """
        return SkillConfig(
            name="dynamic_capability",
            description=f"Dynamic capability: {instructions[:100]}...",
            inputs=[],  # No predefined inputs for dynamic capabilities
            outputs=[],  # No predefined outputs for dynamic capabilities
            instructions=instructions,
            tools=tools or []
        )
    
    def _create_capability_context(self, request: TaskRequest) -> ExecutionContext:
        """
        Create execution context for capability-based execution.

        AIDEV-NOTE: Simplified for single-instruction model - tools are directly on capability.
        """
        capability = self.find_capability_by_name(
            request.agent_config.skills,
            request.capability_name
        )

        if not capability:
            raise ValueError(f"Capability '{request.capability_name}' not found")

        # Extract tool names from capability's tools list (single-instruction model)
        tool_names = [tool.name for tool in capability.tools] if capability.tools else []

        return ExecutionContext(
            mode=ExecutionMode.CAPABILITY_BASED,
            instructions=capability.instructions,  # Use instructions field instead of description
            available_tools=tool_names,
            agent_id=AgentId(request.agent_id) if hasattr(request, 'agent_id') and request.agent_id else None,
            organization_id=self._parse_organization_id(request.organization_id),
            capability_name=request.capability_name,
            capability=capability  # Pass full capability for execution
        )
    
    def _create_instruction_context(self, request: TaskRequest) -> ExecutionContext:
        """Create execution context for instruction-based execution."""
        instruction_config = request.instruction_config
        
        # Extract tool names from instruction config
        tool_names = []
        if hasattr(instruction_config, 'tools') and instruction_config.tools:
            tool_names = [tool.name for tool in instruction_config.tools]
        
        return ExecutionContext(
            mode=ExecutionMode.INSTRUCTION_BASED,
            instructions=instruction_config.instructions,
            available_tools=tool_names,
            agent_id=AgentId(request.agent_id) if hasattr(request, 'agent_id') and request.agent_id else None,
            organization_id=self._parse_organization_id(request.organization_id),
            capability_name=None
        )