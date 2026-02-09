"""
Agent Descriptors - Simple dataclasses for agent capabilities.

These replace the smolagents-based ManagedAgentsFactory agents.
The descriptors are only used for prompt templates (name + description),
not for actual execution (which uses DSPy ExecutorModule).
"""

from dataclasses import dataclass


@dataclass
class AgentDescriptor:
    """Simple descriptor for agent capabilities - used in prompts only."""

    name: str
    description: str


def get_builder_descriptors() -> list[AgentDescriptor]:
    """
    Return descriptors for all builder agents.

    These are used to populate the chat_planner prompt template
    so the LLM knows what specialists are available.
    """
    return [
        AgentDescriptor(
            name="skill_builder",
            description="Creates and configures skills for agents",
        ),
        AgentDescriptor(
            name="skill_executor",
            description="Executes existing skills by ID using skill_crud",
        ),
        AgentDescriptor(
            name="document_builder",
            description="Creates and edits documents with structured content",
        ),
        AgentDescriptor(
            name="table_builder",
            description="Quick table modifications - adds/removes fields on existing tables",
        ),
        AgentDescriptor(
            name="schema_builder",
            description="Designs complex database schemas from requirements - creates databases, tables, and fields",
        ),
        AgentDescriptor(
            name="app_builder",
            description="Creates apps with pages and views for data visualization",
        ),
        AgentDescriptor(
            name="page_builder",
            description="Creates visual pages with Puck blocks and layouts",
        ),
        AgentDescriptor(
            name="agent_builder",
            description="Creates and configures AI agents with skills",
        ),
        AgentDescriptor(
            name="system_designer",
            description="Designs holistic automation systems - orchestrates schema, app, agent, and skill builders",
        ),
        AgentDescriptor(
            name="research_agent",
            description="Searches the web and Emery platform for information",
        ),
        AgentDescriptor(
            name="discover_tools",
            description="Discovers available integrations and checks OAuth connections",
        ),
        AgentDescriptor(
            name="executor",
            description="Executes filesystem operations in agent workspace - read, search, write, and edit files using bash, glob, grep, read_file, write_file, edit_file tools",
        ),
    ]


__all__ = ["AgentDescriptor", "get_builder_descriptors"]
