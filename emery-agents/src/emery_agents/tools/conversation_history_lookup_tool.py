"""
Conversation History Lookup Tool

In-memory search of conversation history (chat messages).
Source: User and assistant messages from the chat session.

Used during PLANNING to resolve references like:
- "option 1", "option 2"
- "what you said earlier"
- "your suggestion"
- "the plan you proposed"

NOT for step execution results - use ExecutionContext for that.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from smolagents import Tool

logger = logging.getLogger(__name__)


class ConversationHistoryLookupTool(Tool):  # type: ignore[misc]
    """
    In-memory search of conversation history (chat messages).

    Source: User and assistant messages from the chat session.
    NOT for step execution results - use ExecutionContext for that.
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "search_conversation"
    description = """Search prior conversation for referenced content.

Use when user mentions:
- "option 1", "option 2", etc.
- "what you said", "earlier", "above"
- "your suggestion", "the plan you proposed"
- References to previous discussion

This searches CHAT MESSAGES, not execution results.

Example:
{
    "query": "option 1",
    "role_filter": "assistant"
}
"""

    inputs = {
        "query": {
            "type": "string",
            "description": "Keywords to search for in conversation history",
        },
        "role_filter": {
            "type": "string",
            "description": "Filter by message role: 'all', 'user', or 'assistant'. Defaults to 'all'.",
            "nullable": True,
        },
        "limit": {
            "type": "integer",
            "description": "Maximum number of matches to return. Defaults to 5.",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self, conversation_history: List[Any]) -> None:
        """
        Initialize with conversation history.

        Args:
            conversation_history: List of message objects from the chat session.
                                  Expected to have 'role' and 'content' attributes.
        """
        super().__init__()
        self._history = conversation_history

    def forward(
        self,
        query: str,
        role_filter: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> str:
        """
        Search conversation history for content matching the query.

        Args:
            query: Keywords to search for
            role_filter: Filter by role ('all', 'user', 'assistant')
            limit: Maximum matches to return

        Returns:
            JSON string of matching messages, or "No matches" message
        """
        role_filter = role_filter or "all"
        limit = limit or 5
        query_lower = query.lower()

        matches: List[Dict[str, Any]] = []

        for msg in self._history:
            # Skip if role filter doesn't match
            msg_role = self._get_role(msg)
            if role_filter != "all" and msg_role != role_filter:
                continue

            # Extract text content
            text = self._extract_text(msg)
            if not text:
                continue

            # Check for query match (case insensitive)
            if query_lower in text.lower():
                matches.append({
                    "role": msg_role,
                    "content": text[:500],  # Truncate for token efficiency
                    "match_preview": self._get_match_preview(text, query_lower),
                })

                if len(matches) >= limit:
                    break

        if not matches:
            logger.info(f"🔍 Conversation search: no matches for '{query}'")
            return f"No matches found for '{query}' in conversation history"

        logger.info(f"🔍 Conversation search: found {len(matches)} matches for '{query}'")
        return json.dumps(matches, indent=2)

    def _get_role(self, msg: Any) -> str:
        """Extract role from message object."""
        if hasattr(msg, 'role'):
            return str(msg.role)
        if isinstance(msg, dict):
            return str(msg.get('role', 'unknown'))
        return 'unknown'

    def _extract_text(self, msg: Any) -> str:
        """Extract text content from message object."""
        # Handle object with content attribute
        if hasattr(msg, 'content'):
            content = msg.content
            # Content might be a list of content blocks
            if isinstance(content, list):
                text_parts = []
                for block in content:
                    if hasattr(block, 'text'):
                        text_parts.append(block.text)
                    elif isinstance(block, dict) and 'text' in block:
                        text_parts.append(block['text'])
                    elif isinstance(block, str):
                        text_parts.append(block)
                return ' '.join(text_parts)
            if isinstance(content, str):
                return content

        # Handle dict
        if isinstance(msg, dict):
            content = msg.get('content', '')
            if isinstance(content, list):
                text_parts = []
                for block in content:
                    if isinstance(block, dict) and 'text' in block:
                        text_parts.append(block['text'])
                    elif isinstance(block, str):
                        text_parts.append(block)
                return ' '.join(text_parts)
            return str(content)

        return str(msg)

    def _get_match_preview(self, text: str, query: str, context_chars: int = 100) -> str:
        """Get a preview of the match with surrounding context."""
        text_lower = text.lower()
        idx = text_lower.find(query)
        if idx == -1:
            return text[:200]

        # Get context around the match
        start = max(0, idx - context_chars)
        end = min(len(text), idx + len(query) + context_chars)

        preview = text[start:end]
        if start > 0:
            preview = "..." + preview
        if end < len(text):
            preview = preview + "..."

        return preview
