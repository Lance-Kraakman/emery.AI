"""
Capability Discovery Tools - Tools for planner to discover capabilities.

These tools allow the planner to search and explore the capability registry
without loading all 30K+ capabilities into context at once.

Three tools:
- search_capabilities: Semantic search by description
- list_capabilities: List by domain or type
- get_capability: Get full details for a specific capability
"""

import logging
from typing import Optional

from smolagents import Tool

from ..models.capability import Capability, CapabilityType
from ..services.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)


class SearchCapabilitiesTool(Tool):
    """
    Search capabilities by semantic similarity.

    Uses embeddings to find capabilities that match the query semantically,
    handling synonyms and related concepts.
    """

    name = "search_capabilities"
    description = (
        "Search for capabilities by description. Returns agents, skills, and tools "
        "ranked by relevance. Use this to find the right capability for a task."
    )
    inputs = {
        "query": {
            "type": "string",
            "description": "Search query describing what you need (e.g., 'create database tables', 'send email')",
        },
        "domain": {
            "type": "string",
            "description": "Optional domain filter (emery, gmail, slack, etc.)",
            "nullable": True,
        },
        "limit": {
            "type": "integer",
            "description": "Maximum results to return (default 5)",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self, registry: CapabilityRegistry):
        super().__init__()
        self.registry = registry

    def forward(
        self,
        query: str,
        domain: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> str:
        """Search for capabilities matching the query."""
        actual_limit = limit if limit is not None else 5

        results = self.registry.search(
            query,
            domain=domain,
            limit=actual_limit,
        )

        if not results:
            return f"No capabilities found for query: '{query}'"

        return self._format_results(results)

    def _format_results(self, capabilities: list[Capability]) -> str:
        """Format search results compactly."""
        lines = [f"Found {len(capabilities)} capabilities:"]
        for cap in capabilities:
            # Compact format: id - description [domain]
            desc = cap.description[:60] + "..." if len(cap.description) > 60 else cap.description
            lines.append(f"→ {cap.id} - {desc} [{cap.domain}]")
        return "\n".join(lines)


class ListCapabilitiesTool(Tool):
    """
    List capabilities by domain or type.

    Use to see what's available in a specific domain (emery, gmail, etc.)
    or of a specific type (agent, skill, tool).
    """

    name = "list_capabilities"
    description = (
        "List available capabilities by domain or type. "
        "Use to explore what's available before searching."
    )
    inputs = {
        "domain": {
            "type": "string",
            "description": "Domain to list (emery, gmail, slack, user, web, etc.)",
            "nullable": True,
        },
        "type": {
            "type": "string",
            "description": "Type filter: 'agent', 'skill', or 'tool'",
            "nullable": True,
        },
        "limit": {
            "type": "integer",
            "description": "Maximum results to return (default 10)",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self, registry: CapabilityRegistry):
        super().__init__()
        self.registry = registry

    def forward(
        self,
        domain: Optional[str] = None,
        type: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> str:
        """List capabilities by domain or type."""
        actual_limit = limit if limit is not None else 10

        if domain:
            caps = self.registry.by_domain(domain)
            context = f"domain='{domain}'"
        elif type:
            try:
                cap_type = CapabilityType(type.lower())
                caps = self.registry.by_type(cap_type)
                context = f"type='{type}'"
            except ValueError:
                return f"Invalid type: '{type}'. Use 'agent', 'skill', or 'tool'."
        else:
            caps = self.registry.all()
            context = "all"

        if not caps:
            return f"No capabilities found ({context})"

        # Limit results
        caps = caps[:actual_limit]

        return self._format_list(caps, context, len(self.registry.all()))

    def _format_list(
        self, capabilities: list[Capability], context: str, total: int
    ) -> str:
        """Format capability list."""
        lines = [f"Capabilities ({context}): {len(capabilities)} of {total} total"]
        for cap in capabilities:
            lines.append(f"- {cap.id}: {cap.name}")
        return "\n".join(lines)


class GetCapabilityTool(Tool):
    """
    Get detailed information about a specific capability.

    Use after search/list to get full details about a capability
    before using it in a plan.
    """

    name = "get_capability"
    description = (
        "Get full details about a capability by ID. "
        "Use after searching to understand what a capability can do."
    )
    inputs = {
        "capability_id": {
            "type": "string",
            "description": "Capability ID (e.g., 'agent:schema_builder', 'tool:gmail-send')",
        },
    }
    output_type = "string"

    def __init__(self, registry: CapabilityRegistry):
        super().__init__()
        self.registry = registry

    def forward(self, capability_id: str) -> str:
        """Get detailed info about a capability."""
        cap = self.registry.get(capability_id)

        if not cap:
            # Suggest similar IDs if not found
            all_ids = [c.id for c in self.registry.all()]
            similar = [id for id in all_ids if capability_id.split(":")[-1] in id]
            if similar:
                return f"Capability not found: '{capability_id}'. Did you mean: {similar[:3]}?"
            return f"Capability not found: '{capability_id}'"

        return self._format_details(cap)

    def _format_details(self, cap: Capability) -> str:
        """Format capability details."""
        lines = [
            f"## {cap.name}",
            f"ID: {cap.id}",
            f"Type: {cap.type.value.upper()}",
            f"Domain: {cap.domain}",
            f"Actions: {', '.join(cap.actions)}",
        ]

        if cap.entities:
            lines.append(f"Entities: {', '.join(cap.entities)}")

        lines.append(f"\n{cap.description}")

        # Add metadata if present
        if cap.metadata.get("skills"):
            skills = cap.metadata["skills"]
            lines.append(f"\nSkills: {len(skills)} available")
            for skill in skills[:5]:  # Show first 5
                name = skill.get("name", "unnamed")
                lines.append(f"  - {name}")

        if cap.metadata.get("inputs"):
            inputs = cap.metadata["inputs"]
            lines.append(f"\nInputs: {len(inputs)} required")
            for inp in inputs[:5]:
                name = inp.get("name", "unnamed")
                inp_type = inp.get("type", "any")
                lines.append(f"  - {name} ({inp_type})")

        return "\n".join(lines)


def create_discovery_tools(registry: CapabilityRegistry) -> list[Tool]:
    """
    Create all capability discovery tools for a registry.

    Args:
        registry: The capability registry to search

    Returns:
        List of discovery tools [search, list, get]
    """
    return [
        SearchCapabilitiesTool(registry),
        ListCapabilitiesTool(registry),
        GetCapabilityTool(registry),
    ]
