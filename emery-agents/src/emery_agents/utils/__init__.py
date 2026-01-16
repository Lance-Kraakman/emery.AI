"""
Shared utilities for emery-agents.

Modules:
- _async_utils: Run async code from sync contexts
- error_classifier: Classify and handle agent errors
- error_messages: Error message templates
- toon_format: TOON format for minimal LLM token usage
- mention_parser: Parse @agent:name mentions from messages
"""

from ._async_utils import run_async_in_thread
from .toon_format import (
    to_toon,
    dict_to_toon,
    list_to_toon,
    json_to_toon,
    tables_to_toon,
    fields_to_toon,
    databases_to_toon,
    rows_to_toon,
)
from .mention_parser import (
    parse_agent_mention,
    has_agent_mention,
    extract_all_agent_mentions,
)

__all__ = [
    "run_async_in_thread",
    "to_toon",
    "dict_to_toon",
    "list_to_toon",
    "json_to_toon",
    "tables_to_toon",
    "fields_to_toon",
    "databases_to_toon",
    "rows_to_toon",
    "parse_agent_mention",
    "has_agent_mention",
    "extract_all_agent_mentions",
]
