"""
Tool Profiles — Domain-Based Tool Selection

Reduces the tool surface for direct execution by selecting only relevant
CRUD tools based on triage analysis (intent + entities). Discovery tools
are always included — inline research is the correct behavior for direct mode.

Fallback: all tools when task type is unclear.
"""

from __future__ import annotations

import logging
from typing import Any

import dspy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool groups by domain
# ---------------------------------------------------------------------------

# Schema operations: table/field/database management
SCHEMA_TOOLS = {"table_crud", "field_crud", "database_crud"}

# Data operations: row/record management
DATA_TOOLS = {"row_crud", "table_crud"}

# App building: apps, pages, views
APP_TOOLS = {"app_crud", "page_crud", "view_crud"}

# Automation: skills, agents
AUTOMATION_TOOLS = {"skill_crud", "agent_crud"}

# Content: documents, files
CONTENT_TOOLS = {"document_crud", "file_crud"}

# Administrative
ADMIN_TOOLS = {"team_crud"}

# Discovery tools — always included in direct execution
# Note: search_capabilities and search_knowledge removed - KNNFewShot with
# TOOL_EXAMPLES provides tool selection, KnowledgeRetriever handles knowledge search
DISCOVERY_TOOL_NAMES = {
    "system_research",
    "workspace_overview",
    "search_external",
    "web_search",
    "memory_crud",
    "conversation_history",
    "search_planning_patterns",
}

# Non-CRUD tools that should always pass through (ask_question, memory, etc.)
PASSTHROUGH_TOOL_NAMES = {"ask_question", "memory_crud", "conversation_history"}
