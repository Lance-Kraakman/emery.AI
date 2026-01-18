"""
Managed Agent Factory

Creates specialized agents (skill_builder, document_builder, etc.)
with consistent tool and model configuration.

Extracted from chat_processing_service.py for single responsibility.
"""

import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from smolagents import ToolCallingAgent

from ...agents.interrupt_aware_agent import InterruptAwareToolCallingAgent
from ...agents.chat_planner_agent import create_chat_planner_agent
from ...agents.skill_builder_agent import create_skill_builder_agent
from ...agents.document_builder_agent import create_document_builder_agent
from ...agents.table_builder_agent import create_table_builder_agent
from ...agents.schema_builder_agent import create_schema_builder_agent
from ...agents.research_agent import create_research_agent
from ...agents.research_emery_agent import create_research_emery_agent
from ...agents.app_builder_agent import create_app_builder_agent
from ...agents.agent_builder_agent import create_agent_builder_agent
from ...agents.page_builder_agent import create_page_builder_agent
from ...agents.agent_executor_agent import create_agent_executor
from ...agents.system_designer_agent import create_system_designer_agent
from ...tools.tool_executor import create_tool_executor
from ...tools.block_schema_tool import BlockSchemaTool
from ...services.tool_provider import ToolProvider
from ...services.model_provider import SmolagentsModelProvider
from ...services.agent_api_service import AgentAPIService
from ...services.research_tools_provider import get_research_tools

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

    def _get_research_tools(self) -> List[Any]:
        """
        Get research tools for parent/orchestrator agents.

        Returns DuckDuckGoSearchTool and VisitWebpageTool for gathering context
        before planning. Parent agents use these to analyze reference URLs,
        research domain patterns, and gather information for comprehensive
        planning that covers sub-agent work.

        Returns:
            List of research tools, empty if unavailable
        """
        try:
            research_tools = get_research_tools()
            if research_tools:
                logger.debug(f"Research tools available: {[t.name for t in research_tools]}")
            return research_tools
        except Exception as e:
            logger.warning(f"Could not get research tools: {e}")
            return []

    def create_chat_planner(
        self,
        smolagents_tools: List[Any],
        org_model: Optional[str] = None,
        has_images: bool = False,
        managed_agents: Optional[List[Any]] = None,
        user_agents: Optional[List[Dict[str, Any]]] = None,
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
            user_agents: Metadata about user-defined agents (for template display)
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
            user_agents=user_agents,
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
        - Uses research tools to understand domain patterns
        - Proposes table structure with all fields
        - Waits for user approval
        - Batch creates fields on approval

        AIDEV-NOTE: As an orchestrator agent, schema_builder gets research tools
        (DuckDuckGoSearchTool, VisitWebpageTool) to gather context before planning.
        This enables comprehensive planning that covers table_builder work.
        """
        tools = tool_provider.get_schema_builder_tools()
        database_crud_tool, table_crud_tool, field_crud_tool = tools[0], tools[1], tools[2]

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        tool_executor = create_tool_executor(
            tools=[field_crud_tool, table_crud_tool, database_crud_tool],
            model=model,
            max_steps=8
        )

        # Add research tools for context gathering before planning
        research_tools = self._get_research_tools()

        schema_builder = create_schema_builder_agent(
            tools=[tool_executor] + research_tools,
            model=model,
            max_steps=15
        )

        logger.info(f"Created Schema Builder agent (HITL) with ToolExecutor + {len(research_tools)} research tools")
        return schema_builder

    def create_research_agent(
        self,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        org_model: Optional[str] = None,
    ) -> ToolCallingAgent:
        """
        Create Research agent for web search and information gathering.

        Research agent is READ-ONLY - no HITL approval needed.
        Uses DuckDuckGoSearchTool and VisitWebpageTool.

        When api_key and organization_id are provided, ResearchEmery is
        automatically created as a managed agent for system introspection.
        """
        model = self.model_provider.get_model(
            self.model_provider.resolve_model_selection(org_model=org_model)
        )

        research_agent = create_research_agent(
            model=model,
            max_steps=10,
            api_key=api_key,
            organization_id=organization_id,
        )

        logger.info("Created Research agent (read-only) with ResearchEmery sub-agent")
        return research_agent

    def create_research_emery(
        self,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        org_model: Optional[str] = None,
    ) -> ToolCallingAgent:
        """
        Create ResearchEmery agent for system introspection.

        ResearchEmery agent is READ-ONLY - no HITL approval needed.
        Uses system_research tool to query Emery platform resources
        (agents, skills, tasks, tables, apps, audit).

        AIDEV-NOTE: Can be used as a managed agent of ResearchAgent for
        combined web + system research capabilities.
        """
        model = self.model_provider.get_model(
            self.model_provider.resolve_model_selection(org_model=org_model)
        )

        research_emery = create_research_emery_agent(
            model=model,
            api_key=api_key,
            organization_id=organization_id,
            max_steps=10,
        )

        logger.info("Created ResearchEmery agent (read-only system introspection)")
        return research_emery

    def create_app_builder(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create an App Builder agent with native planning for HITL workflow.

        This agent runs as a TOP-LEVEL agent (not managed agent) so that
        interrupt() works natively for human-in-the-loop approval.

        Uses ToolExecutorTool to delegate tool calls to a sub-agent with
        proper instructions.

        Includes page_builder as a managed_agent for delegating complex page
        creation tasks (especially when reference URLs are provided).

        AIDEV-NOTE: As an orchestrator agent, app_builder gets research tools
        (DuckDuckGoSearchTool, VisitWebpageTool) to gather context before planning.
        This enables comprehensive planning that covers page_builder work, including
        analyzing reference URLs and asking HITL questions about page content.
        """
        tools = tool_provider.get_app_builder_tools()
        app_crud_tool, page_crud_tool = tools[0], tools[1]

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        tool_executor = create_tool_executor(
            tools=[app_crud_tool, page_crud_tool],
            model=model,
            max_steps=5
        )

        # Add research tools for context gathering before planning
        research_tools = self._get_research_tools()

        # Add block_schema tool for on-demand block schema access and validation
        block_schema_tool = BlockSchemaTool()

        # Create page_builder as managed agent for complex page creation
        # page_builder has research capability and full Puck block knowledge
        page_builder = self.create_page_builder(tool_provider, org_model)

        app_builder = create_app_builder_agent(
            tools=[tool_executor, block_schema_tool] + research_tools,
            model=model,
            max_steps=10,
            managed_agents=[page_builder],
        )

        logger.info(f"Created App Builder agent with ToolExecutor + block_schema + {len(research_tools)} research tools + page_builder")
        return app_builder

    def create_page_builder(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Page Builder agent with native planning for HITL workflow.

        This agent specializes in creating Puck visual pages with proper block types.
        Unlike app_builder (which uses tool_executor wrapper), page_builder gets
        page_crud DIRECTLY so it receives the full page_crud.j2 instructions
        including the complete Puck block schema.

        Optionally includes research_agent as a managed agent for analyzing
        reference URLs when creating pages.

        AIDEV-NOTE: The key difference from app_builder is that this agent gets
        the page_crud tool directly (not wrapped in tool_executor). This ensures
        build_agent_instructions() includes page_crud.j2 with all 38 block types,
        preventing hallucination of block names like "HeroSection" vs "Hero".
        """
        # Get page_crud tool directly (not via tool_executor)
        page_crud_tool = tool_provider.get("page_crud")

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        # Create research_agent as managed agent for URL analysis
        research_agent = None
        try:
            research_agent = self.create_research_agent(
                api_key=tool_provider.api_key,
                organization_id=tool_provider.organization_id,
                org_model=org_model
            )
            logger.info("   Added research_agent for URL analysis")
        except Exception as e:
            logger.warning(f"   Could not create research_agent: {e}")

        # Add block_schema tool for on-demand block schema access and validation
        block_schema_tool = BlockSchemaTool()

        # Pass page_crud directly so agent gets full block schema in instructions
        managed_agents = [research_agent] if research_agent else None
        page_builder = create_page_builder_agent(
            tools=[page_crud_tool, block_schema_tool],  # Direct tools with block validation
            model=model,
            max_steps=15,
            managed_agents=managed_agents,
        )

        logger.info("Created Page Builder agent with page_crud + block_schema + research_agent")
        return page_builder

    def create_agent_builder(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create an Agent Builder agent with native planning for HITL workflow.

        This agent runs as a TOP-LEVEL agent (not managed agent) so that
        interrupt() works natively for human-in-the-loop approval.

        Uses ToolExecutorTool to delegate tool calls to a sub-agent with
        proper instructions.
        """
        tools = tool_provider.get_agent_builder_tools()
        agent_crud_tool, skill_crud_tool = tools[0], tools[1]

        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        tool_executor = create_tool_executor(
            tools=[agent_crud_tool, skill_crud_tool],
            model=model,
            max_steps=5
        )

        agent_builder = create_agent_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=10
        )

        logger.info("Created Agent Builder agent with ToolExecutor sub-agent")
        return agent_builder

    def create_system_designer(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None,
        managed_agents: Optional[List[Any]] = None,
    ) -> ToolCallingAgent:
        """
        Create a System Designer agent for holistic automation system design.

        This is the TOP-LEVEL ORCHESTRATOR that sits above specialized builders.
        It understands the full Emery ecosystem (agents -> skills -> databases ->
        views -> apps) and designs holistic solutions before delegating.

        System Designer has:
        - research_agent (managed agent) for web search + system introspection
        - Other builders as managed_agents for delegation

        AIDEV-NOTE: System Designer does NOT have CRUD tools directly.
        It delegates to specialized builders via cascade planning.

        AIDEV-NOTE: Uses research_agent instead of separate research tools +
        research_emery. research_agent already combines both (web search tools +
        research_emery as its own managed agent).
        """
        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        # Create research_agent for combined web + system research
        # research_agent has: web_search, visit_webpage tools + research_emery as managed agent
        research_agent = self.create_research_agent(
            api_key=tool_provider.api_key,
            organization_id=tool_provider.organization_id,
            org_model=org_model
        )

        # Build managed agents list: research_agent + any provided builders
        all_managed_agents = [research_agent]
        if managed_agents:
            all_managed_agents.extend(managed_agents)

        system_designer = create_system_designer_agent(
            tools=[],  # No direct tools - delegates to research_agent
            model=model,
            max_steps=15,
            managed_agents=all_managed_agents,
        )

        agent_names = [a.name for a in all_managed_agents if hasattr(a, 'name')]
        logger.info(f"Created System Designer agent with managed agents: {agent_names}")
        return system_designer

    def create_agent_executor(
        self,
        agent_config: Dict[str, Any],
        skills: List[Dict[str, Any]],
        tool_provider: ToolProvider,
        org_model: Optional[str] = None,
        skill_executor_callback: Optional[Callable] = None,
    ) -> ToolCallingAgent:
        """
        Create AgentExecutor for a user-defined agent.

        This creates a dynamic ToolCallingAgent at runtime that wraps a
        user-defined Agent entity with its skills and data access.

        AIDEV-NOTE: Unlike other managed agents, AgentExecutor is created
        dynamically from database entities, not static configurations.

        Args:
            agent_config: Agent entity data (id, name, persona, databaseId, etc.)
            skills: List of skill definitions for this agent
            tool_provider: Provider for data access tools (row_crud)
            org_model: Organization-level model override
            skill_executor_callback: Callback to execute skills

        Returns:
            Configured ToolCallingAgent for the user-defined agent
        """
        model = self.model_provider.get_model(
            self.model_provider.resolve_model_selection(org_model=org_model)
        )

        # Create scoped row_crud if agent has databaseId
        additional_tools = []
        database_id = agent_config.get("databaseId")
        if database_id:
            # Get row_crud tool scoped to agent's database
            # This allows the agent to interact with its linked data
            try:
                row_crud = tool_provider.get_scoped_row_crud(database_id=database_id)
                additional_tools.append(row_crud)
                logger.info(f"   Added row_crud scoped to database {database_id}")
            except Exception as e:
                logger.warning(f"   Could not create scoped row_crud: {e}")

        agent_executor = create_agent_executor(
            agent_config=agent_config,
            skills=skills,
            model=model,
            api_key=tool_provider.api_key,
            organization_id=tool_provider.organization_id,
            additional_tools=additional_tools,
            skill_executor_callback=skill_executor_callback,
            max_steps=15,
        )

        logger.info(f"Created AgentExecutor for agent: {agent_config.get('name')}")
        return agent_executor

    async def load_user_agents(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None,
    ) -> tuple[List[ToolCallingAgent], List[Dict[str, Any]]]:
        """
        Load all user-defined agents for this organization.

        Uses AgentAPIService for consistent API access with RLS headers
        and observability. Returns BOTH executors (for managed_agents list)
        and metadata (for template display).

        AIDEV-NOTE: This method replaces the inline _load_user_agents() that was
        previously in chat_processing_service.py. Centralizing here:
        - Keeps all agent creation in the factory
        - Reuses create_agent_executor() method
        - Shares AgentAPIService with mention_routing

        Args:
            tool_provider: Provider for auth context and tool creation
            org_model: Optional organization-level model override

        Returns:
            Tuple of:
            - List of AgentExecutor instances (for managed_agents list)
            - List of agent metadata dicts (for template display)
        """
        api_service = AgentAPIService(
            api_key=tool_provider.api_key,
            organization_id=tool_provider.organization_id,
        )

        # Fetch all agents with their skills
        agents_with_skills = await api_service.fetch_agents_with_skills()

        if not agents_with_skills:
            logger.info("[USER-AGENTS] No user-defined agents found for organization")
            return [], []

        user_agent_executors: List[ToolCallingAgent] = []
        user_agents_metadata: List[Dict[str, Any]] = []

        for agent_data, skills_data in agents_with_skills:
            try:
                # Convert to raw dicts for create_agent_executor
                agent_config = agent_data.raw
                skills = [s.raw for s in skills_data]

                # Create AgentExecutor using existing factory method
                executor = self.create_agent_executor(
                    agent_config=agent_config,
                    skills=skills,
                    tool_provider=tool_provider,
                    org_model=org_model,
                )
                user_agent_executors.append(executor)

                # Build metadata for template display
                skill_names = [s.name for s in skills_data]
                user_agents_metadata.append({
                    'id': agent_data.id,
                    'name': agent_data.name,
                    'description': agent_data.description,
                    'skillNames': skill_names,
                })

                logger.info(f"[USER-AGENTS] Loaded: {agent_data.name} ({len(skills_data)} skills)")

            except Exception as e:
                logger.warning(f"[USER-AGENTS] Failed to create AgentExecutor for {agent_data.name}: {e}")
                continue

        logger.info(f"[USER-AGENTS] Total: {len(user_agent_executors)} agents loaded")
        return user_agent_executors, user_agents_metadata

    def create_all_agents(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> List[Any]:
        """
        Create all managed agents for plan generation.

        Returns list of all available managed agents. Used by GeneratePlan
        to provide agent info to the planner for routing decisions.

        Args:
            tool_provider: Provider for agent-specific tools
            org_model: Organization-level model override

        Returns:
            List of managed agent instances
        """
        agents = []

        # Create each managed agent (skip any that fail)
        try:
            agents.append(self.create_skill_builder(tool_provider, org_model))
        except Exception as e:
            logger.warning(f"Failed to create skill_builder: {e}")

        try:
            agents.append(self.create_document_builder(tool_provider, org_model))
        except Exception as e:
            logger.warning(f"Failed to create document_builder: {e}")

        try:
            agents.append(self.create_table_builder(tool_provider, org_model))
        except Exception as e:
            logger.warning(f"Failed to create table_builder: {e}")

        try:
            agents.append(self.create_schema_builder(tool_provider, org_model))
        except Exception as e:
            logger.warning(f"Failed to create schema_builder: {e}")

        try:
            agents.append(self.create_app_builder(tool_provider, org_model))
        except Exception as e:
            logger.warning(f"Failed to create app_builder: {e}")

        try:
            agents.append(self.create_page_builder(tool_provider, org_model))
        except Exception as e:
            logger.warning(f"Failed to create page_builder: {e}")

        try:
            agents.append(self.create_agent_builder(tool_provider, org_model))
        except Exception as e:
            logger.warning(f"Failed to create agent_builder: {e}")

        try:
            agents.append(self.create_research_agent(
                api_key=tool_provider.api_key,
                organization_id=tool_provider.organization_id,
                org_model=org_model
            ))
        except Exception as e:
            logger.warning(f"Failed to create research_agent: {e}")

        logger.info(f"Created {len(agents)} managed agents for plan generation")
        return agents

    def get_agent_factories(
        self,
        tool_provider: ToolProvider,
        org_model: Optional[str] = None
    ) -> Dict[str, Callable[..., Any]]:
        """
        Return factory functions for cascade planning.

        These factories can be called with custom parameters (planning_callback,
        planning_only, extra_tools) by SubAgentPlanner during cascade planning.

        AIDEV-NOTE: The factory functions accept **kwargs to allow SubAgentPlanner
        to inject planning callbacks. The underlying agent creation functions
        have been updated to accept these optional parameters.

        Args:
            tool_provider: Provider for agent-specific tools
            org_model: Organization-level model override

        Returns:
            Dict mapping agent names to factory functions
        """
        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        def schema_builder_factory(**kwargs: Any) -> Any:
            """Factory for schema_builder with cascade planning support.

            AIDEV-NOTE: Includes research tools for comprehensive planning.
            """
            tools = tool_provider.get_schema_builder_tools()
            database_crud, table_crud, field_crud = tools[0], tools[1], tools[2]
            tool_executor = create_tool_executor(
                tools=[field_crud, table_crud, database_crud],
                model=model,
                max_steps=8
            )
            # Add research tools for context gathering
            research_tools = self._get_research_tools()
            return create_schema_builder_agent(
                tools=[tool_executor] + research_tools,
                model=model,
                max_steps=15,
                **kwargs  # Accept planning_callback, planning_only, extra_tools
            )

        def table_builder_factory(**kwargs: Any) -> Any:
            """Factory for table_builder with cascade planning support."""
            tools = tool_provider.get_table_builder_tools()
            table_crud, field_crud = tools[0], tools[1]
            tool_executor = create_tool_executor(
                tools=[field_crud, table_crud],
                model=model,
                max_steps=3
            )
            return create_table_builder_agent(
                tools=[tool_executor],
                model=model,
                max_steps=6,
                **kwargs
            )

        def document_builder_factory(**kwargs: Any) -> Any:
            """Factory for document_builder with cascade planning support."""
            tools = tool_provider.get_document_builder_tools()
            document_crud = tools[0]
            tool_executor = create_tool_executor(
                tools=[document_crud],
                model=model,
                max_steps=3
            )
            return create_document_builder_agent(
                tools=[tool_executor],
                model=model,
                max_steps=10,
                **kwargs
            )

        def skill_builder_factory(**kwargs: Any) -> Any:
            """Factory for skill_builder with cascade planning support."""
            tools = tool_provider.get_skill_builder_tools()
            skill_crud = tools[0]
            tool_executor = create_tool_executor(
                tools=[skill_crud],
                model=model,
                max_steps=3
            )
            return create_skill_builder_agent(
                tools=[tool_executor],
                model=model,
                max_steps=10,
                **kwargs
            )

        def research_agent_factory(**kwargs: Any) -> Any:
            """Factory for research_agent with cascade planning support."""
            # AIDEV-NOTE: Pass api_key and organization_id from tool_provider
            # to auto-create ResearchEmery as managed agent for system introspection
            return create_research_agent(
                model=model,
                max_steps=10,
                api_key=kwargs.pop('api_key', tool_provider.api_key),
                organization_id=kwargs.pop('organization_id', tool_provider.organization_id),
                **kwargs
            )

        def research_emery_factory(**kwargs: Any) -> Any:
            """Factory for research_emery with cascade planning support."""
            # AIDEV-NOTE: api_key and organization_id can be passed via kwargs
            # if needed for auth context during cascade planning
            return create_research_emery_agent(
                model=model,
                api_key=kwargs.pop('api_key', None),
                organization_id=kwargs.pop('organization_id', None),
                max_steps=10,
                **kwargs
            )

        def app_builder_factory(**kwargs: Any) -> Any:
            """Factory for app_builder with cascade planning support.

            AIDEV-NOTE: Includes research tools for comprehensive planning
            and page_builder as managed_agent for delegation.
            """
            tools = tool_provider.get_app_builder_tools()
            app_crud, page_crud = tools[0], tools[1]
            tool_executor = create_tool_executor(
                tools=[app_crud, page_crud],
                model=model,
                max_steps=5
            )

            # Add research tools for context gathering
            research_tools = self._get_research_tools()

            # Add block_schema tool for on-demand block schema access and validation
            block_schema_tool = BlockSchemaTool()

            # Create page_builder as managed agent
            page_builder = page_builder_factory(**kwargs)

            return create_app_builder_agent(
                tools=[tool_executor, block_schema_tool] + research_tools,
                model=model,
                max_steps=10,
                managed_agents=[page_builder],
                **kwargs
            )

        def agent_builder_factory(**kwargs: Any) -> Any:
            """Factory for agent_builder with cascade planning support."""
            tools = tool_provider.get_agent_builder_tools()
            agent_crud, skill_crud = tools[0], tools[1]
            tool_executor = create_tool_executor(
                tools=[agent_crud, skill_crud],
                model=model,
                max_steps=5
            )
            return create_agent_builder_agent(
                tools=[tool_executor],
                model=model,
                max_steps=10,
                **kwargs
            )

        def page_builder_factory(**kwargs: Any) -> Any:
            """Factory for page_builder with cascade planning support.

            AIDEV-NOTE: page_builder gets page_crud DIRECTLY (not via tool_executor)
            plus block_schema tool for on-demand schema access and validation.
            """
            page_crud = tool_provider.get("page_crud")

            # Add block_schema tool for on-demand block schema access and validation
            block_schema_tool = BlockSchemaTool()

            # Create research_agent as managed agent for URL analysis
            managed_agents = None
            try:
                research = create_research_agent(
                    model=model,
                    max_steps=10,
                    api_key=kwargs.pop('api_key', tool_provider.api_key),
                    organization_id=kwargs.pop('organization_id', tool_provider.organization_id),
                )
                managed_agents = [research]
            except Exception:
                pass  # Research is optional

            return create_page_builder_agent(
                tools=[page_crud, block_schema_tool],
                model=model,
                max_steps=15,
                managed_agents=managed_agents,
                **kwargs
            )

        def system_designer_factory(**kwargs: Any) -> Any:
            """Factory for system_designer with cascade planning support.

            AIDEV-NOTE: system_designer is the TOP-LEVEL ORCHESTRATOR that
            understands the full Emery ecosystem. It has:
            - research_agent as managed agent (combines web search + system introspection)
            - NO CRUD tools (delegates to specialized builders)

            Uses research_agent instead of separate research tools + research_emery.
            """
            # Create research_agent for combined web + system research
            research_agent = research_agent_factory(**kwargs)

            return create_system_designer_agent(
                tools=[],  # No direct tools - delegates to research_agent
                model=model,
                max_steps=15,
                managed_agents=[research_agent],
                **kwargs
            )

        return {
            "schema_builder": schema_builder_factory,
            "table_builder": table_builder_factory,
            "document_builder": document_builder_factory,
            "skill_builder": skill_builder_factory,
            "research_agent": research_agent_factory,
            "research_emery": research_emery_factory,
            "app_builder": app_builder_factory,
            "agent_builder": agent_builder_factory,
            "page_builder": page_builder_factory,
            "system_designer": system_designer_factory,
        }
