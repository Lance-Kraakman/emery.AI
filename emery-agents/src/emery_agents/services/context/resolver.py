"""
Context Resolver Service

Resolves context mappings for agent/skill/step execution.
Respects hierarchy: agent -> skill -> step (later levels override).
"""

from emery_agents.entities.models.context_mapping import (
    ContextMapping,
    ResolvedContext,
)


class ContextResolver:
    """
    Resolves context mappings for agent/skill/step execution.

    Respects hierarchy: agent -> skill -> step
    Later levels can override earlier levels for the same table.
    """

    def __init__(self, grpc_client=None):
        """
        Initialize context resolver.

        Args:
            grpc_client: Optional gRPC client for fetching mappings from Next.js
        """
        self.grpc_client = grpc_client

    async def resolve_context(
        self,
        organization_id: int,
        agent_id: int,
        skill_id: int | None = None,
        step_id: str | None = None,
    ) -> ResolvedContext:
        """
        Resolve all context mappings for execution.

        Merges mappings respecting hierarchy: agent -> skill -> step
        Later levels override earlier levels for the same table.

        Args:
            organization_id: Organization ID
            agent_id: Agent ID
            skill_id: Optional skill ID (if executing a skill)
            step_id: Optional step ID (if executing a specific agentic node)

        Returns:
            ResolvedContext with merged mappings
        """
        if self.grpc_client:
            return await self._resolve_via_grpc(
                organization_id, agent_id, skill_id, step_id
            )
        else:
            # Return empty context if no gRPC client
            return ResolvedContext(
                mappings=[],
                agent_mappings=[],
                skill_mappings=[],
                step_mappings=[],
            )

    async def _resolve_via_grpc(
        self,
        organization_id: int,
        agent_id: int,
        skill_id: int | None,
        step_id: str | None,
    ) -> ResolvedContext:
        """Resolve context mappings via gRPC call to Next.js."""
        # Fetch mappings via gRPC
        response = await self.grpc_client.get_context_mappings(
            organization_id=organization_id,
            agent_id=agent_id,
            skill_id=skill_id,
            step_id=step_id,
        )

        # Convert proto messages to domain objects
        agent_mappings = [ContextMapping.from_proto(m) for m in response.agent_mappings]
        skill_mappings = [ContextMapping.from_proto(m) for m in response.skill_mappings]
        step_mappings = [ContextMapping.from_proto(m) for m in response.step_mappings]

        # Merge with hierarchy priority
        merged = self._merge_mappings(agent_mappings, skill_mappings, step_mappings)

        return ResolvedContext(
            mappings=merged,
            agent_mappings=agent_mappings,
            skill_mappings=skill_mappings,
            step_mappings=step_mappings,
        )

    def _merge_mappings(
        self,
        agent_mappings: list[ContextMapping],
        skill_mappings: list[ContextMapping],
        step_mappings: list[ContextMapping],
    ) -> list[ContextMapping]:
        """
        Merge mappings with hierarchy priority.

        Later levels override earlier levels for the same table.
        Priority: step > skill > agent
        """
        by_table_id: dict[int, ContextMapping] = {}

        # Agent level (lowest priority)
        for mapping in agent_mappings:
            by_table_id[mapping.table_id] = mapping

        # Skill level (overrides agent)
        for mapping in skill_mappings:
            by_table_id[mapping.table_id] = mapping

        # Step level (highest priority)
        for mapping in step_mappings:
            by_table_id[mapping.table_id] = mapping

        return list(by_table_id.values())

    def resolve_context_sync(
        self,
        agent_mappings: list[ContextMapping],
        skill_mappings: list[ContextMapping] | None = None,
        step_mappings: list[ContextMapping] | None = None,
    ) -> ResolvedContext:
        """
        Synchronous version of resolve_context for use with pre-fetched mappings.

        Args:
            agent_mappings: Agent-level context mappings
            skill_mappings: Optional skill-level context mappings
            step_mappings: Optional step-level context mappings

        Returns:
            ResolvedContext with merged mappings
        """
        skill_mappings = skill_mappings or []
        step_mappings = step_mappings or []

        merged = self._merge_mappings(agent_mappings, skill_mappings, step_mappings)

        return ResolvedContext(
            mappings=merged,
            agent_mappings=agent_mappings,
            skill_mappings=skill_mappings,
            step_mappings=step_mappings,
        )
