"""
Execution tool factories for DSPy.

These tools enable agents to execute actions.

NOTE: To avoid circular imports, import directly from submodules:
- from emery_agents.tools.execution.bash import create_bash_tool
- from emery_agents.tools.execution.skill import SkillTool
- from emery_agents.tools.execution.skill_invoker import create_skill_invoker_tools
"""

from __future__ import annotations
