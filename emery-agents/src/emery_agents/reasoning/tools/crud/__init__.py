"""
CRUD tool factories for DSPy.

Each factory function creates a tool function with auth captured in closure.
"""

from __future__ import annotations

from .tables import create_table_crud
from .fields import create_field_crud
from .rows import create_row_crud
from .databases import create_database_crud
from .agents import create_agent_crud
from .documents import create_document_crud
from .files import create_file_crud
from .skills import create_skill_crud
from .teams import create_team_crud
from .views import create_view_crud
from .apps import create_app_crud, create_page_crud

__all__ = [
    "create_table_crud",
    "create_field_crud",
    "create_row_crud",
    "create_database_crud",
    "create_agent_crud",
    "create_document_crud",
    "create_file_crud",
    "create_skill_crud",
    "create_team_crud",
    "create_view_crud",
    "create_app_crud",
    "create_page_crud",
]
