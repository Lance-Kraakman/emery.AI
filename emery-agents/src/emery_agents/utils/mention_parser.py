"""
Mention Parser - Detect @agent:name mentions in messages.

AIDEV-NOTE: Parses @agent:name patterns from user messages to enable
direct routing to user-defined agents.

Pattern: @agent:agent-name or @agent:agent_name
- Case-insensitive match
- Supports hyphens and underscores in names
- Returns cleaned text with mention removed
"""

import re
from typing import Optional, Tuple

# Pattern matches @agent:name where name contains alphanumerics, hyphens, or underscores
AGENT_MENTION_PATTERN = re.compile(r'@agent:([a-zA-Z0-9_-]+)', re.IGNORECASE)


def parse_agent_mention(text: str) -> Tuple[str, Optional[str]]:
    """
    Parse @agent:name mention from text.

    Args:
        text: The message text to parse

    Returns:
        Tuple of (cleaned_text, agent_name):
        - cleaned_text: Original text with @agent:name removed
        - agent_name: The extracted agent name, or None if no mention found

    Examples:
        >>> parse_agent_mention("@agent:sales-bot send email to John")
        ('send email to John', 'sales-bot')

        >>> parse_agent_mention("Hello world")
        ('Hello world', None)

        >>> parse_agent_mention("Ask @agent:my_assistant about the weather")
        ('Ask  about the weather', 'my_assistant')
    """
    match = AGENT_MENTION_PATTERN.search(text)
    if match:
        agent_name = match.group(1)
        # Remove the mention from text and clean up whitespace
        cleaned_text = AGENT_MENTION_PATTERN.sub('', text).strip()
        # Normalize multiple spaces to single space
        cleaned_text = ' '.join(cleaned_text.split())
        return (cleaned_text, agent_name)
    return (text, None)


def has_agent_mention(text: str) -> bool:
    """
    Check if text contains an @agent:name mention.

    Args:
        text: The message text to check

    Returns:
        True if an @agent:name mention is found, False otherwise
    """
    return AGENT_MENTION_PATTERN.search(text) is not None


def extract_all_agent_mentions(text: str) -> list[str]:
    """
    Extract all @agent:name mentions from text.

    Useful for messages that may mention multiple agents.

    Args:
        text: The message text to parse

    Returns:
        List of agent names mentioned (may be empty)
    """
    return AGENT_MENTION_PATTERN.findall(text)
