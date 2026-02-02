"""
Capability Bootstrap — Populates CapabilityRegistry from various sources.

Three population sources:
1. System agents (from agent descriptors) — called once at service startup
2. User skills (from workspace context) — called per-request
3. External tools (from gRPC) — called per-request

AIDEV-NOTE: The registry was fully built but never populated. This module
bridges agent_descriptors + workspace data + external tools into Capability
objects that power search_capabilities and _get_capability_guidance().
"""

from __future__ import annotations

import logging
from typing import Any

from .capability_registry import CapabilityRegistry
from ..entities.models.capability import Capability, CapabilityType
from ..grpc.agents.agent_descriptors import get_builder_descriptors

logger = logging.getLogger(__name__)


# Actions and entities for each system agent. These enrich the sparse
# AgentDescriptor (name + description) into searchable Capability objects.
AGENT_METADATA: dict[str, dict[str, list[str]]] = {
    "schema_builder": {
        "actions": ["create", "update", "delete"],
        "entities": ["databases", "tables", "fields"],
    },
    "app_builder": {
        "actions": ["create", "update"],
        "entities": ["apps", "pages", "views", "dashboards"],
    },
    "table_builder": {
        "actions": ["add", "remove", "update"],
        "entities": ["fields", "tables"],
    },
    "skill_builder": {
        "actions": ["create", "configure"],
        "entities": ["skills", "automations"],
    },
    "skill_executor": {
        "actions": ["execute", "run", "trigger"],
        "entities": ["skills"],
    },
    "document_builder": {
        "actions": ["create", "edit"],
        "entities": ["documents", "reports", "templates"],
    },
    "agent_builder": {
        "actions": ["create", "configure"],
        "entities": ["agents", "skills"],
    },
    "page_builder": {
        "actions": ["create", "layout"],
        "entities": ["pages", "blocks", "layouts"],
    },
    "view_builder": {
        "actions": ["create", "configure"],
        "entities": ["views", "grids", "forms"],
    },
    "system_designer": {
        "actions": ["design", "orchestrate", "analyze"],
        "entities": ["systems", "workflows"],
    },
    "research_agent": {
        "actions": ["search", "research", "analyze"],
        "entities": ["information", "web"],
    },
    "discover_tools": {
        "actions": ["discover", "list", "check"],
        "entities": ["integrations", "connections"],
    },
}


def populate_system_agents(registry: CapabilityRegistry) -> int:
    """Register system agent capabilities from agent descriptors.

    Called once at service startup. Maps each AgentDescriptor to a Capability
    with enriched metadata from AGENT_METADATA.

    Safe to call multiple times — dict-keyed by ID, so duplicates are overwritten.
    """
    count = 0
    for desc in get_builder_descriptors():
        meta = AGENT_METADATA.get(desc.name, {"actions": [], "entities": []})
        capability = Capability(
            id=f"agent:{desc.name}",
            name=desc.name,
            type=CapabilityType.AGENT,
            domain="emery",
            description=desc.description,
            actions=meta["actions"],
            entities=meta["entities"],
        )
        registry.register(capability)
        count += 1

    logger.info(f"Registered {count} system agent capabilities")
    return count


def populate_user_skills(
    registry: CapabilityRegistry,
    skills: list[Any],
    org_id: str,
) -> int:
    """Register user-defined skills as capabilities.

    Called per-request with workspace data. Clears previous SKILL registrations
    before re-registering to avoid stale entries.

    Args:
        registry: The capability registry to populate
        skills: WorkspaceSkill objects from workspace context
        org_id: Organization ID string for per-org enabling
    """
    # Clear stale skill registrations
    registry.clear_by_type(CapabilityType.SKILL)

    count = 0
    for skill in skills:
        skill_id = getattr(skill, "id", None)
        skill_name = getattr(skill, "name", "")
        skill_desc = getattr(skill, "description", "") or skill_name

        if not skill_id or not skill_name:
            continue

        capability = Capability(
            id=f"skill:{skill_id}",
            name=skill_name,
            type=CapabilityType.SKILL,
            domain="user",
            description=skill_desc,
            actions=["execute"],
            entities=[],
        )
        registry.register(capability)
        registry.enable_for_org(capability.id, org_id)
        count += 1

    logger.info(f"Registered {count} user skill capabilities for org {org_id}")
    return count


def populate_external_tools(
    registry: CapabilityRegistry,
    external_tools: list[Any],
    org_id: str,
) -> int:
    """Register external tools (Pipedream, dynamic skills) as capabilities.

    Called per-request with tools from gRPC request. Clears previous TOOL
    registrations before re-registering.

    Args:
        registry: The capability registry to populate
        external_tools: dspy.Tool instances from gRPC
        org_id: Organization ID string for per-org enabling
    """
    # Clear stale tool registrations
    registry.clear_by_type(CapabilityType.TOOL)

    count = 0
    for tool in external_tools:
        tool_name = getattr(tool, "name", None)
        tool_desc = getattr(tool, "desc", "") or getattr(tool, "description", "")

        if not tool_name:
            continue

        # Derive domain from tool name (e.g., "gmail_send_email" → "gmail")
        domain = tool_name.split("_")[0] if "_" in tool_name else "external"

        capability = Capability(
            id=f"tool:{tool_name}",
            name=tool_name,
            type=CapabilityType.TOOL,
            domain=domain,
            description=tool_desc,
            actions=["execute"],
            entities=[],
        )
        registry.register(capability)
        registry.enable_for_org(capability.id, org_id)
        count += 1

    logger.info(f"Registered {count} external tool capabilities for org {org_id}")
    return count
