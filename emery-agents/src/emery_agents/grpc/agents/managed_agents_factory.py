"""
Managed Agent Factory

Creates specialized agents (skill_builder, document_builder, etc.)
with consistent tool and model configuration.

Extracted from chat_processing_service.py for single responsibility.
"""

import logging
from dataclasses import dataclass
from typing import Any, List, Optional

from smolagents import ToolCallingAgent

from ...agents.interrupt_aware_agent import InterruptAwareToolCallingAgent
from ...agents.chat_planner_agent import create_chat_planner_agent
from ...agents.skill_builder_agent import create_skill_builder_agent
from ...agents.document_builder_agent import create_document_builder_agent
from ...agents.table_builder_agent import create_table_builder_agent
from ...agents.schema_builder_agent import create_schema_builder_agent
from ...agents.research_agent import create_research_agent
from ...tools.tool_executor import create_tool_executor
from ...services.tool_provider import ToolProvider
from ...services.model_provider import SmolagentsModelProvider

logger = logging.getLogger(__name__)


@dataclass
class ManagedAgentConfig:
    """Configuration for creating managed agents."""
    tool_provider: ToolProvider
    org_model: Optional[str] = None
    api_key: Optional[str] = None
    max_steps: int = 25


class ManagedAgentsFactory:
    """
    Factory for creating managed agents with consistent configuration.

    Centralizes agent creation logic that was previously scattered
    throughout chat_processing_service.py.
    """

    def __init__(self, model_provider: SmolagentsModelProvider):
        """
        Initialize factory with model provider.

        Args:
            model_provider: Provider for LLM model instances
        """
        self.model_provider = model_provider

    def create_chat_planner(
        self,
        smolagents_tools: List[Any],
        org_model: Optional[str] = None,
        has_images: bool = False,
        managed_agents: Optional[List[Any]] = None,
        session_attachments: Optional[List[Any]] = None
    ) -> InterruptAwareToolCallingAgent:
        """
        Create Chat Planner orchestrator agent with managed agents.

        Uses create_chat_planner_agent for proper template-based instructions
        and interrupt propagation from managed agents.

        Args:
            smolagents_tools: List of tools available to the agent
            org_model: Organization-level model override
            has_images: Whether request contains images (for vision model selection)
            managed_agents: List of managed sub-agents
            session_attachments: Optional list of file attachments available in session
        """
        model = self.model_provider.get_model(
            model_id=self.model_provider.resolve_model_selection(
                org_model=org_model,
                has_images=has_images
            )
        )

        return create_chat_planner_agent(
            tools=smolagents_tools,
            model=model,
            managed_agents=managed_agents,
            context_type="interactive",
            max_steps=10,
            session_attachments=session_attachments
        )

    def create_skill_builder(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Skill Builder agent with native planning for HITL workflow.

        This agent runs as a TOP-LEVEL agent (not managed agent) so that
        interrupt() works natively for human-in-the-loop approval.

        Uses ToolExecutorTool to delegate tool calls to a sub-agent with
        proper instructions.
        """
        tools = tool_provider.get_skill_builder_tools()
        skill_crud_tool = tools[0]

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        tool_executor = create_tool_executor(
            tools=[skill_crud_tool],
            model=model,
            max_steps=3
        )

        skill_builder = create_skill_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=10
        )

        logger.info("Created Skill Builder agent with ToolExecutor sub-agent")
        return skill_builder

    def create_document_builder(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Document Builder agent with native planning for HITL workflow.

        This agent runs as a TOP-LEVEL agent (not managed agent) so that
        interrupt() works natively for human-in-the-loop approval.

        Uses ToolExecutorTool to delegate tool calls to a sub-agent with
        proper instructions.
        """
        tools = tool_provider.get_document_builder_tools()
        document_crud_tool = tools[0]

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        tool_executor = create_tool_executor(
            tools=[document_crud_tool],
            model=model,
            max_steps=3
        )

        document_builder = create_document_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=10
        )

        logger.info("Created Document Builder agent with ToolExecutor sub-agent")
        return document_builder

    def create_table_builder(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Table Builder agent for single table operations (autonomous).

        This agent executes directly without HITL approval - designed for
        quick schema changes like adding/deleting fields.
        """
        tools = tool_provider.get_table_builder_tools()
        table_crud_tool, field_crud_tool = tools[0], tools[1]

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        tool_executor = create_tool_executor(
            tools=[field_crud_tool, table_crud_tool],
            model=model,
            max_steps=3
        )

        table_builder = create_table_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=6
        )

        logger.info("Created Table Builder agent (autonomous) with ToolExecutor sub-agent")
        return table_builder

    def create_schema_builder(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Schema Builder agent for complex schema design (HITL).

        This agent uses HITL workflow for designing schemas from requirements:
        - Analyzes unstructured data (questionnaires, forms, specs)
        - Proposes table structure with all fields
        - Waits for user approval
        - Batch creates fields on approval
        """
        tools = tool_provider.get_schema_builder_tools()
        database_crud_tool, table_crud_tool, field_crud_tool = tools[0], tools[1], tools[2]

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        tool_executor = create_tool_executor(
            tools=[field_crud_tool, table_crud_tool, database_crud_tool],
            model=model,
            max_steps=8
        )

        schema_builder = create_schema_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=15
        )

        logger.info("Created Schema Builder agent (HITL) with ToolExecutor sub-agent")
        return schema_builder

    def create_research_agent(
        self,
        org_model: Optional[str] = None,
    ) -> ToolCallingAgent:
        """
        Create Research agent for web search and information gathering.

        Research agent is READ-ONLY - no HITL approval needed.
        Uses DuckDuckGoSearchTool and VisitWebpageTool.
        """
        model = self.model_provider.get_model(
            self.model_provider.resolve_model_selection(org_model=org_model)
        )

        research_agent = create_research_agent(
            model=model,
            max_steps=10,
        )

        logger.info("Created Research agent (read-only)")
        return research_agent
