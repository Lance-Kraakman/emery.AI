"""
Capability Discovery Tools - Tools for planner to discover capabilities.

Two-tier search based on org's enabled capabilities:
- search_org: Searches capabilities enabled for the org
- search_integrations: Searches capabilities NOT enabled (available to add)

Plus exploration tools:
- list_capabilities: Browse by domain/type
- get_capability: Get full details
"""

import logging
from typing import Optional

from smolagents import Tool

from ..models.capability import Capability, CapabilityType
from ..services.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)


def _format_capabilities(capabilities: list[Capability], include_domain: bool = False) -> str:
    """Format capabilities for display. Shared by all search tools."""
    if not capabilities:
        return "No capabilities found."

    lines = [f"Found {len(capabilities)} capabilities:"]
    for cap in capabilities:
        desc = cap.description[:60] + "..." if len(cap.description) > 60 else cap.description
        if include_domain:
            lines.append(f"→ {cap.id} - {desc} [{cap.domain}]")
        else:
            lines.append(f"→ {cap.id} - {desc}")
    return "\n".join(lines)


class SearchOrgTool(Tool):
    """
    Search org's enabled capabilities.

    Searches agents, skills, and integrations that are enabled for this org.
    Use search_integrations for capabilities that could be added.
    """

    name = "search_org"
    description = (
        "Search org's enabled capabilities (agents, skills, connected integrations). "
        "Use search_integrations for capabilities that could be added."
    )
    inputs = {
        "query": {
            "type": "string",
            "description": "Search query (e.g., 'create tables', 'send email')",
        },
        "limit": {
            "type": "integer",
            "description": "Maximum results (default 5)",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self, registry: CapabilityRegistry, org_id: str):
        super().__init__()
        self.registry = registry
        self.org_id = org_id

    def forward(self, query: str, limit: Optional[int] = None) -> str:
        """Search org's enabled capabilities."""
        actual_limit = limit if limit is not None else 5

        matches = self.registry.search_enabled(query, self.org_id, limit=actual_limit)

        if not matches:
            enabled = self.registry.get_enabled(self.org_id)
            if enabled:
                names = [c.name for c in enabled[:5]]
                return f"No match for '{query}'. Enabled: {names}"
            else:
                return f"No enabled capabilities. Use search_integrations to find available ones."

        return _format_capabilities(matches)


class SearchIntegrationsTool(Tool):
    """
    Search available integrations and templates.

    Searches capabilities NOT enabled for this org - things that could be added.
    Use search_org for capabilities already enabled.
    """

    name = "search_integrations"
    description = (
        "Search available integrations and templates (not yet enabled). "
        "Use search_org for org's enabled capabilities."
    )
    inputs = {
        "query": {
            "type": "string",
            "description": "Search query (e.g., 'send sms', 'slack notifications')",
        },
        "limit": {
            "type": "integer",
            "description": "Maximum results (default 5)",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self, registry: CapabilityRegistry, org_id: str):
        super().__init__()
        self.registry = registry
        self.org_id = org_id

    def forward(self, query: str, limit: Optional[int] = None) -> str:
        """Search available capabilities (not enabled for org)."""
        actual_limit = limit if limit is not None else 5

        matches = self.registry.search_available(query, self.org_id, limit=actual_limit)

        if not matches:
            available = self.registry.get_available(self.org_id)
            if available:
                domains = list(set(c.domain for c in available))[:5]
                return f"No match for '{query}'. Available domains: {domains}"
            else:
                return "No available integrations in the system."

        return _format_capabilities(matches, include_domain=True)


class ListCapabilitiesTool(Tool):
    """
    List capabilities by domain or type.

    Use to explore what's available before searching.
    """

    name = "list_capabilities"
    description = (
        "List capabilities by domain or type. "
        "Use to explore what's available."
    )
    inputs = {
        "domain": {
            "type": "string",
            "description": "Domain to list (emery, gmail, slack, etc.)",
            "nullable": True,
        },
        "type": {
            "type": "string",
            "description": "Type filter: 'agent', 'skill', or 'tool'",
            "nullable": True,
        },
        "limit": {
            "type": "integer",
            "description": "Maximum results (default 10)",
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

        caps = caps[:actual_limit]
        lines = [f"Capabilities ({context}): {len(caps)} shown"]
        for cap in caps:
            lines.append(f"- {cap.id}: {cap.name}")
        return "\n".join(lines)


class GetCapabilityTool(Tool):
    """
    Get detailed information about a specific capability.

    Use after search to understand what a capability does.
    """

    name = "get_capability"
    description = (
        "Get full details about a capability by ID. "
        "Use after searching to understand what it does."
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
            all_ids = [c.id for c in self.registry.all()]
            similar = [id for id in all_ids if capability_id.split(":")[-1] in id][:3]
            if similar:
                return f"Not found: '{capability_id}'. Did you mean: {similar}?"
            return f"Not found: '{capability_id}'"

        return self._format_details(cap)

    def _format_details(self, cap: Capability) -> str:
        """Format capability details."""
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

        if cap.metadata.get("skills"):
            skills = cap.metadata["skills"]
            lines.append(f"\nSkills: {len(skills)} available")
            for skill in skills[:5]:
                lines.append(f"  - {skill.get('name', 'unnamed')}")

        if cap.metadata.get("inputs"):
            inputs = cap.metadata["inputs"]
            lines.append(f"\nInputs: {len(inputs)} required")
            for inp in inputs[:5]:
                lines.append(f"  - {inp.get('name', 'unnamed')} ({inp.get('type', 'any')})")

        planning_guide = get_capability_instructions(cap.id, mode="planning")
        if planning_guide:
            lines.append(f"\n{planning_guide}")

        return "\n".join(lines)


def create_discovery_tools(
    registry: CapabilityRegistry,
    org_id: Optional[str] = None,
) -> list[Tool]:
    """
    Create capability discovery tools for a registry.

    Args:
        registry: The capability registry
        org_id: Organization ID for two-tier search. If None, org-specific
                tools are not included.

    Returns:
        List of discovery tools
    """
    tools: list[Tool] = []

    # Org-specific search tools (require org_id)
    if org_id:
        tools.append(SearchOrgTool(registry, org_id))
        tools.append(SearchIntegrationsTool(registry, org_id))

    # General tools (no org_id needed)
    tools.append(ListCapabilitiesTool(registry))
    tools.append(GetCapabilityTool(registry))

    return tools
