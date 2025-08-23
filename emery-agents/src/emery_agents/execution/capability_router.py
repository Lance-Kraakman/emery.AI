"""
Capability Router for Dual Execution Modes

AIDEV-NOTE: Routes between capability-based and instruction-based execution.
Handles the oneof execution_mode from protobuf TaskRequest.
"""

from typing import Optional
from ..core.entities import TaskRequest, CapabilityConfig, InstructionConfig


class CapabilityRouter:
    """Routes execution based on TaskRequest execution mode."""
    
    def route_execution(self, request: TaskRequest) -> CapabilityConfig:
        """
        Route execution based on request mode.
        
        Args:
            request: TaskRequest with either capability_name or instruction_config
            
        Returns:
            CapabilityConfig to execute
            
        Raises:
            ValueError: If no valid execution mode specified or capability not found
        """
        if request.capability_name:
            return self._find_capability(request)
        elif request.instruction_config:
            return self._auto_route_instructions(request)
        else:
            raise ValueError("TaskRequest must specify either capability_name or instruction_config")
    
    def _find_capability(self, request: TaskRequest) -> CapabilityConfig:
        """Find specific capability by name in agent config."""
        for capability in request.agent_config.capabilities:
            if capability.name == request.capability_name:
                return capability
        
        raise ValueError(f"Capability '{request.capability_name}' not found in agent config")
    
    def _auto_route_instructions(self, request: TaskRequest) -> CapabilityConfig:
        """
        Auto-route instructions to appropriate capability.
        
        AIDEV-TODO: Implement intelligent routing logic.
        For now, create a dynamic capability from instruction_config.
        """
        instruction_config = request.instruction_config
        
        # Create a dynamic capability from instruction config
        # AIDEV-NOTE: This creates a single-step capability for instruction execution
        from ..core.entities import StepConfig
        from ..core.types import StepType
        
        step = StepConfig(
            id="instruction_step",
            type=StepType.TOOL_STEP if instruction_config.tools else StepType.CODE_STEP,
            instructions=instruction_config.instructions,
            model="Qwen/Qwen2.5-72B-Instruct",  # Default model (HuggingFace)
            tools=instruction_config.tools,
            servers=instruction_config.servers
        )
        
        return CapabilityConfig(
            name="auto_routed_capability",
            description=f"Auto-routed capability for: {instruction_config.instructions[:100]}...",
            steps=[step]
        )