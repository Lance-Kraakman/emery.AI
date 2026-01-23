"""
Capability Discovery Tools - Tools for planner to discover capabilities.

Two-tier search:
1. search_capabilities: Searches ACTIVE capabilities (org's agents + skills)
2. search_available: Searches AVAILABLE capabilities (templates + integrations)

Active = domains ["emery", "user"] (system agents + org's custom stuff)
Available = everything else (integrations, templates, marketplace)

Additional tools:
- list_capabilities: List by domain or type
- get_capability: Get full details for a specific capability
"""

import logging
from typing import Optional

from smolagents import Tool

from ..models.capability import Capability, CapabilityType
from ..services.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)

# Domains considered "active" (org's stuff + system agents)
ACTIVE_DOMAINS = {"emery", "user"}


class SearchCapabilitiesTool(Tool):
    """
    Search ACTIVE capabilities (org's agents + skills).

    Searches only in active domains (emery, user) - things the org
    has created or that are always available system agents.

    Use search_available for integrations and templates.
    """

    name = "search_capabilities"
    description = (
        "Search org's active capabilities (agents and skills). "
        "Returns system agents and org's custom skills ranked by relevance. "
        "Use search_available for integrations and templates."
    )
    inputs = {
        "query": {
            "type": "string",
            "description": "Search query describing what you need (e.g., 'create database tables', 'analyze data')",
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
        limit: Optional[int] = None,
    ) -> str:
        """Search active capabilities (org's agents + skills)."""
        actual_limit = limit if limit is not None else 5

        # Filter to active domains only
        all_caps = self.registry.all()
        active_caps = [c for c in all_caps if c.domain in ACTIVE_DOMAINS]

        if not active_caps:
            return f"No active capabilities found. Use search_available for integrations."

        # Search within active capabilities using keyword matching
        # (semantic search would be better but requires embedding each time)
        query_lower = query.lower()
        matches = [c for c in active_caps if c.matches_query(query)]

        if not matches:
            # No matches - show what's available
            return f"No active capabilities match '{query}'. Available: {[c.name for c in active_caps[:5]]}"

        matches = matches[:actual_limit]
        return self._format_results(matches, "active")

    def _format_results(self, capabilities: list[Capability], tier: str) -> str:
        """Format search results compactly."""
        lines = [f"Found {len(capabilities)} {tier} capabilities:"]
        for cap in capabilities:
            desc = cap.description[:60] + "..." if len(cap.description) > 60 else cap.description
            lines.append(f"→ {cap.id} - {desc}")
        return "\n".join(lines)


class SearchAvailableTool(Tool):
    """
    Search AVAILABLE capabilities (integrations + templates).

    Searches all non-active domains - integrations (gmail, slack, etc.),
    templates, and marketplace items that could be enabled.
    """

    name = "search_available"
    description = (
        "Search available integrations and templates. "
        "Returns capabilities that could be added to the org. "
        "Use search_capabilities first for org's existing agents/skills."
    )
    inputs = {
        "query": {
            "type": "string",
            "description": "Search query (e.g., 'send email', 'slack notifications')",
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
        limit: Optional[int] = None,
    ) -> str:
        """Search available capabilities (integrations + templates)."""
        actual_limit = limit if limit is not None else 5

        # Filter to non-active domains
        all_caps = self.registry.all()
        available_caps = [c for c in all_caps if c.domain not in ACTIVE_DOMAINS]

        if not available_caps:
            return "No integrations or templates registered in the system."

        # Search within available capabilities
        matches = [c for c in available_caps if c.matches_query(query)]

        if not matches:
            domains = list(set(c.domain for c in available_caps))[:5]
            return f"No available capabilities match '{query}'. Domains: {domains}"

        matches = matches[:actual_limit]
        return self._format_results(matches)

    def _format_results(self, capabilities: list[Capability]) -> str:
        """Format search results compactly."""
        lines = [f"Found {len(capabilities)} available capabilities:"]
        for cap in capabilities:
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
        """Format capability details with planning guidance."""
        from ..prompts import get_capability_instructions

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

        # Add planning guidance if available
        planning_guide = get_capability_instructions(cap.id, mode="planning")
        if planning_guide:
            lines.append(f"\n{planning_guide}")

        return "\n".join(lines)


def create_discovery_tools(registry: CapabilityRegistry) -> list[Tool]:
    """
    Create all capability discovery tools for a registry.

    Two-tier search:
    - search_capabilities: Active (org's agents + skills)
    - search_available: Available (integrations + templates)

    Plus exploration tools:
    - list_capabilities: Browse by domain/type
    - get_capability: Get full details

    Args:
        registry: The capability registry to search

    Returns:
        List of discovery tools [search_active, search_available, list, get]
    """
    return [
        SearchCapabilitiesTool(registry),
        SearchAvailableTool(registry),
        ListCapabilitiesTool(registry),
        GetCapabilityTool(registry),
    ]
