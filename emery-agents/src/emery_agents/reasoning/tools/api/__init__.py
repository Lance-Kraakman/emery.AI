"""Typed API layer for CRUD operations.

This module provides reusable typed APIs that both tools and services use.
Dataclasses provide type safety, API classes provide the operations.
"""

from .database_api import DatabaseAPI, Database
from .table_api import TableAPI, Table
from .app_api import AppAPI, App

__all__ = [
    "DatabaseAPI",
    "Database",
    "TableAPI",
    "Table",
    "AppAPI",
    "App",
]
