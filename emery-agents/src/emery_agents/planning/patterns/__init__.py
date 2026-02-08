"""
Planning patterns organized by capability.

Each module defines patterns for a specific capability or domain.
"""

from emery_agents.planning.patterns.agent_patterns import AGENT_PATTERNS
from emery_agents.planning.patterns.app_patterns import APP_PATTERNS
from emery_agents.planning.patterns.data_patterns import DATA_PATTERNS
from emery_agents.planning.patterns.integration_patterns import INTEGRATION_PATTERNS
from emery_agents.planning.patterns.schema_patterns import SCHEMA_PATTERNS
from emery_agents.planning.patterns.skill_patterns import SKILL_PATTERNS

# All patterns for bulk registration
ALL_PATTERNS = [
    *SCHEMA_PATTERNS,
    *INTEGRATION_PATTERNS,
    *APP_PATTERNS,
    *SKILL_PATTERNS,
    *AGENT_PATTERNS,
    *DATA_PATTERNS,
]

__all__ = [
    "SCHEMA_PATTERNS",
    "INTEGRATION_PATTERNS",
    "APP_PATTERNS",
    "SKILL_PATTERNS",
    "AGENT_PATTERNS",
    "DATA_PATTERNS",
    "ALL_PATTERNS",
]
