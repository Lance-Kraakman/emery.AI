"""
Skill Configuration Entity

AIDEV-NOTE: Domain entity for agent skill configuration.
Simplified single-instruction model - removed multi-step workflow.
Matches the protobuf SkillConfig message exactly.
"""

from dataclasses import dataclass, field
from typing import List
from emery_agents.core.entities import ToolConfig


@dataclass
class SkillInput:
    """
    Skill input parameter.

    AIDEV-NOTE: Matches protobuf message SkillInput {
        string name = 1;
        bool required = 2;
    }
    """
    name: str
    required: bool


@dataclass
class SkillOutput:
    """
    Skill output value.

    AIDEV-NOTE: Matches protobuf message SkillOutput {
        string name = 1;
    }
    """
    name: str


@dataclass
class SkillConfig:
    """
    Agent skill configuration with single-instruction model.

    AIDEV-NOTE: Simplified from multi-step workflow to single instruction block.
    Matches protobuf message SkillConfig {
        string name = 1;
        string description = 2;
        repeated SkillInput inputs = 3;
        repeated SkillOutput outputs = 4;
        string instructions = 5;
        repeated ToolConfig tools = 6;
    }
    """

    name: str
    description: str
    inputs: List[SkillInput] = field(default_factory=list)
    outputs: List[SkillOutput] = field(default_factory=list)
    instructions: str = ""
    tools: List[ToolConfig] = field(default_factory=list)

    def __post_init__(self):
        """Validate skill configuration."""
        if not self.name or not self.name.strip():
            raise ValueError("Skill name cannot be empty")

        if not self.description or not self.description.strip():
            raise ValueError("Skill description cannot be empty")

        if not self.instructions or not self.instructions.strip():
            raise ValueError("Skill instructions cannot be empty")

        # Validate inputs have non-empty names
        for i, skill_input in enumerate(self.inputs):
            if not skill_input.name or not skill_input.name.strip():
                raise ValueError(f"Input {i} must have a non-empty name")

        # Validate outputs have non-empty names
        for i, skill_output in enumerate(self.outputs):
            if not skill_output.name or not skill_output.name.strip():
                raise ValueError(f"Output {i} must have a non-empty name")

    @property
    def normalized_name(self) -> str:
        """Get normalized skill name."""
        return self.name.strip().lower().replace(" ", "_")

    @property
    def required_inputs(self) -> List[SkillInput]:
        """Get list of required inputs."""
        return [inp for inp in self.inputs if inp.required]

    @property
    def optional_inputs(self) -> List[SkillInput]:
        """Get list of optional inputs."""
        return [inp for inp in self.inputs if not inp.required]

    @classmethod
    def from_dict(cls, data: dict) -> "SkillConfig":
        """Create SkillConfig from dictionary (protobuf conversion)."""
        return cls(
            name=data["name"],
            description=data["description"],
            inputs=[
                SkillInput(name=inp["name"], required=inp["required"])
                for inp in data.get("inputs", [])
            ],
            outputs=[
                SkillOutput(name=out["name"])
                for out in data.get("outputs", [])
            ],
            instructions=data.get("instructions", ""),
            tools=[
                ToolConfig(
                    name=tool["name"],
                    version=tool.get("version", "1.0"),
                    config=tool.get("config", {})
                )
                for tool in data.get("tools", [])
            ]
        )

    def to_dict(self) -> dict:
        """Convert to dictionary (protobuf conversion)."""
        return {
            "name": self.name,
            "description": self.description,
            "inputs": [
                {"name": inp.name, "required": inp.required}
                for inp in self.inputs
            ],
            "outputs": [
                {"name": out.name}
                for out in self.outputs
            ],
            "instructions": self.instructions,
            "tools": [
                {
                    "name": tool.name,
                    "version": tool.version,
                    "config": tool.config
                }
                for tool in self.tools
            ]
        }
