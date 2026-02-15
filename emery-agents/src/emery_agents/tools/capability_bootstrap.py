"""
Capability Bootstrap — Populates CapabilityRegistry from various sources.

Three population sources:
1. System agents (from agent descriptors) — called once at service startup
2. User skills (from workspace context) — called per-request
3. External tools (from gRPC) — called per-request

Capabilities are retrieved for planning via CapabilityRetriever
(reasoning/modules/retrievers.py) which uses DSPy's FAISS-backed search.
"""

from __future__ import annotations

import logging
from typing import Any

import dspy

from ..entities.models.capability import Capability, CapabilityType
from ..entities.workspace import WorkspaceSkill
from ..grpc.agents.agent_descriptors import get_builder_descriptors
from .capability_registry import CapabilityRegistry
from .integrations.pipedream import PIPEDREAM_METADATA

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
    "executor": {
        "actions": ["read", "write", "search", "edit", "execute"],
        "entities": ["files", "directories", "workspace", "code", "content"],
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


def populate_integration_services(registry: CapabilityRegistry) -> int:
    """Register all Pipedream services as integration-level capabilities.

    Groups 13K+ tools into ~3K service-level entries (one per service).
    Called once at startup alongside populate_system_agents().

    Embeddings are computed lazily on first search (cached in registry).
    """
    by_service: dict[str, list[dict[str, Any]]] = {}
    for tool_id, meta in PIPEDREAM_METADATA.items():
        app = meta.get("app", "")
        if app:
            by_service.setdefault(app, []).append({"id": tool_id, **meta})

    count = 0
    for service, tools in by_service.items():
        tool_descs = [
            t.get("description", "")[:80] for t in tools[:5] if t.get("description")
        ]
        summary = (
            f"{service} integration ({len(tools)} actions): {'; '.join(tool_descs)}"
        )

        capability = Capability(
            id=f"integration:{service}",
            name=service,
            type=CapabilityType.TOOL,
            domain=service,
            description=summary,
            actions=[t["id"] for t in tools[:10]],
            entities=[service],
        )
        registry.register(capability)
        count += 1

    logger.info(f"Registered {count} integration service capabilities")
    return count


def populate_user_skills(
    registry: CapabilityRegistry,
    skills: list[WorkspaceSkill],
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
        if not skill.id or not skill.name:
            continue

        capability = Capability(
            id=f"skill:{skill.id}",
            name=skill.name,
            type=CapabilityType.SKILL,
            domain="user",
            description=skill.description or skill.name,
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
    external_tools: list[dspy.Tool],
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
    # Clear stale per-request tool registrations (preserves integration: services)
    registry.clear_by_id_prefix("tool:")

    count = 0
    for tool in external_tools:
        if not tool.name:
            continue

        # Derive domain from tool name (e.g., "gmail_send_email" → "gmail")
        domain = tool.name.split("_")[0] if "_" in tool.name else "external"

        capability = Capability(
            id=f"tool:{tool.name}",
            name=tool.name,
            type=CapabilityType.TOOL,
            domain=domain,
            description=getattr(tool, "description", "") or "",
            actions=["execute"],
            entities=[],
        )
        registry.register(capability)
        registry.enable_for_org(capability.id, org_id)
        count += 1

    logger.info(f"Registered {count} external tool capabilities for org {org_id}")
    return count
