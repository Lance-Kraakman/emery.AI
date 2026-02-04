"""
Mention Parser - Detect @agent:name, @skill:name, and @tool:name mentions in messages.

Parses mention patterns from user messages to enable direct routing
to user-defined agents, skills, and external tools.

Patterns: @agent:name, @skill:name, @tool:name
- Case-insensitive match
- Supports hyphens and underscores in names
- Returns cleaned text with mention removed
- For skills: optionally parses "with input1: value1, input2: value2"
"""

import re
from dataclasses import dataclass
from typing import Optional, Tuple, Dict

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


# ============================================================================
# SKILL MENTION PARSING
# ============================================================================

# Pattern matches @skill:name where name contains alphanumerics, hyphens, or underscores
SKILL_MENTION_PATTERN = re.compile(r'@skill:([a-zA-Z0-9_-]+)', re.IGNORECASE)

# Pattern to extract "with key1: value1, key2: value2" after skill mention
SKILL_INPUTS_PATTERN = re.compile(
    r'@skill:[a-zA-Z0-9_-]+\s+with\s+(.+)',
    re.IGNORECASE | re.DOTALL
)


@dataclass
class SkillInvocation:
    """Represents a parsed @skill:name invocation with optional inputs."""
    skill_name: str
    inputs: Dict[str, str]
    cleaned_task: str  # Task text with @skill mention removed


def parse_skill_mention(text: str) -> Tuple[str, Optional[str]]:
    """
    Parse @skill:name mention from text.

    Args:
        text: The message text to parse

    Returns:
        Tuple of (cleaned_text, skill_name):
        - cleaned_text: Original text with @skill:name removed
        - skill_name: The extracted skill name, or None if no mention found

    Examples:
        >>> parse_skill_mention("@skill:generate-summary with name: John")
        ('with name: John', 'generate-summary')

        >>> parse_skill_mention("Hello world")
        ('Hello world', None)
    """
    match = SKILL_MENTION_PATTERN.search(text)
    if match:
        skill_name = match.group(1)
        # Remove the mention from text and clean up whitespace
        cleaned_text = SKILL_MENTION_PATTERN.sub('', text).strip()
        # Normalize multiple spaces to single space
        cleaned_text = ' '.join(cleaned_text.split())
        return (cleaned_text, skill_name)
    return (text, None)


def parse_skill_inputs(inputs_str: str) -> Dict[str, str]:
    """
    Parse "key1: value1, key2: value2" format into a dictionary.

    Handles:
    - Simple values: "name: John, age: 25"
    - Quoted values: 'name: "John Doe", role: "Software Engineer"'
    - Values with commas in quotes: 'list: "a, b, c"'

    Args:
        inputs_str: The inputs string after "with" keyword

    Returns:
        Dictionary of input name -> value

    Examples:
        >>> parse_skill_inputs("name: John, age: 25")
        {'name': 'John', 'age': '25'}

        >>> parse_skill_inputs('name: "John Doe", age: 25')
        {'name': 'John Doe', 'age': '25'}
    """
    inputs: Dict[str, str] = {}
    if not inputs_str:
        return inputs

    # Simple parsing: split by comma, then by colon
    # This handles most cases; for complex quoted values, we'd need a proper parser
    current_key: Optional[str] = None
    current_value_parts: list[str] = []
    in_quotes = False
    quote_char: Optional[str] = None

    i = 0
    while i < len(inputs_str):
        char = inputs_str[i]

        # Handle quotes
        if char in ('"', "'") and not in_quotes:
            in_quotes = True
            quote_char = char
            i += 1
            continue
        elif char == quote_char and in_quotes:
            in_quotes = False
            quote_char = None
            i += 1
            continue

        # Handle colon (key-value separator) - only when not in quotes
        if char == ':' and not in_quotes and current_key is None:
            # Everything before this is the key
            key_part = inputs_str[:i].strip()
            # Find the last comma or start to get just the key name
            last_comma = key_part.rfind(',')
            if last_comma >= 0:
                current_key = key_part[last_comma + 1:].strip()
            else:
                current_key = key_part.strip()
            inputs_str = inputs_str[i + 1:]  # Move past the colon
            i = 0
            continue

        # Handle comma (value separator) - only when not in quotes
        if char == ',' and not in_quotes and current_key is not None:
            # Everything before this is the value for current_key
            value = inputs_str[:i].strip()
            inputs[current_key] = value
            current_key = None
            inputs_str = inputs_str[i + 1:].strip()  # Move past the comma
            i = 0
            continue

        i += 1

    # Handle the last key-value pair
    if current_key is not None:
        value = inputs_str.strip()
        inputs[current_key] = value
    elif inputs_str.strip() and ':' in inputs_str:
        # Handle simple case where we have remaining "key: value"
        parts = inputs_str.split(':', 1)
        if len(parts) == 2:
            key = parts[0].strip()
            value = parts[1].strip()
            if key:
                inputs[key] = value

    return inputs


def parse_skill_invocation(text: str) -> Optional[SkillInvocation]:
    """
    Parse @skill:name invocation with optional inputs.

    Supports formats:
    - "@skill:generate-summary"
    - "@skill:generate-summary with name: John, age: 25"
    - "@skill:generate-summary with name: John"

    Args:
        text: The message text to parse

    Returns:
        SkillInvocation if skill mention found, None otherwise

    Examples:
        >>> inv = parse_skill_invocation("@skill:generate-summary with name: John, age: 25")
        >>> inv.skill_name
        'generate-summary'
        >>> inv.inputs
        {'name': 'John', 'age': '25'}
    """
    cleaned_text, skill_name = parse_skill_mention(text)
    if not skill_name:
        return None

    # Try to extract inputs from "with key: value" format
    inputs: Dict[str, str] = {}
    inputs_match = SKILL_INPUTS_PATTERN.search(text)
    if inputs_match:
        inputs_str = inputs_match.group(1)
        inputs = parse_skill_inputs(inputs_str)
        # Remove "with ..." from cleaned_text
        cleaned_text = re.sub(r'\s*with\s+.+', '', cleaned_text, flags=re.IGNORECASE | re.DOTALL).strip()

    return SkillInvocation(
        skill_name=skill_name,
        inputs=inputs,
        cleaned_task=cleaned_text,
    )


def has_skill_mention(text: str) -> bool:
    """
    Check if text contains a @skill:name mention.

    Args:
        text: The message text to check

    Returns:
        True if a @skill:name mention is found, False otherwise
    """
    return SKILL_MENTION_PATTERN.search(text) is not None


# ============================================================================
# TOOL MENTION PARSING
# ============================================================================

# Pattern matches @tool:name where name contains alphanumerics, hyphens, or underscores
TOOL_MENTION_PATTERN = re.compile(r'@tool:([a-zA-Z0-9_-]+)', re.IGNORECASE)


def parse_tool_mention(text: str) -> Tuple[str, Optional[str]]:
    """
    Parse @tool:name mention from text.

    Args:
        text: The message text to parse

    Returns:
        Tuple of (cleaned_text, tool_name):
        - cleaned_text: Original text with @tool:name removed
        - tool_name: The extracted tool name, or None if no mention found

    Examples:
        >>> parse_tool_mention("@tool:gmail-create-draft send email to John")
        ('send email to John', 'gmail-create-draft')

        >>> parse_tool_mention("Hello world")
        ('Hello world', None)
    """
    match = TOOL_MENTION_PATTERN.search(text)
    if match:
        tool_name = match.group(1)
        cleaned_text = TOOL_MENTION_PATTERN.sub('', text).strip()
        cleaned_text = ' '.join(cleaned_text.split())
        return (cleaned_text, tool_name)
    return (text, None)


def has_tool_mention(text: str) -> bool:
    """
    Check if text contains a @tool:name mention.

    Args:
        text: The message text to check

    Returns:
        True if a @tool:name mention is found, False otherwise
    """
    return TOOL_MENTION_PATTERN.search(text) is not None


# ============================================================================
# MULTI-MENTION DETECTION
# ============================================================================

def count_all_mentions(text: str) -> int:
    """Count total @agent + @skill + @tool mentions in text.

    Used to detect multi-mention messages that should go through the full
    coordinator pipeline (triage → plan → execute) instead of single-mention shortcut.
    """
    return (
        len(AGENT_MENTION_PATTERN.findall(text))
        + len(SKILL_MENTION_PATTERN.findall(text))
        + len(TOOL_MENTION_PATTERN.findall(text))
    )
