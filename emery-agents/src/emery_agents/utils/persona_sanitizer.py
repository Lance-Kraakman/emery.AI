"""
Persona Sanitizer - Defensive processing for user-provided agent content.

AIDEV-NOTE: This module provides layered defense against prompt injection attacks
in user-defined agent personas and descriptions:

1. Control character removal
2. Whitespace normalization
3. Length truncation with word boundary preservation
4. Suspicious pattern detection and logging (monitoring, not blocking)

Security patterns detected (logged for monitoring):
- "ignore all previous instructions"
- "disregard instructions"
- "you are now"
- "new instructions:"
- "system:"
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MAX_PERSONA_LENGTH = 2000
MAX_DESCRIPTION_LENGTH = 500

# Patterns that may indicate prompt injection attempts
# These are logged for monitoring but NOT blocked (to avoid false positives)
SUSPICIOUS_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|above|prior)",
    r"disregard\s+(all\s+)?(previous|instructions)",
    r"forget\s+(everything|all|previous)",
    r"you\s+are\s+now",
    r"new\s+instructions?:",
    r"system\s*:",
    r"<\s*/?\s*system\s*>",
    r"assistant\s*:",
    r"human\s*:",
]


def sanitize_user_content(
    content: Optional[str],
    max_length: int,
    field_name: str = "content"
) -> str:
    """
    Sanitize user-provided content with defensive processing.

    Args:
        content: Raw user content (may be None)
        max_length: Maximum allowed length
        field_name: Name for logging purposes

    Returns:
        Sanitized content string (empty string if input is None)
    """
    if not content:
        return ""

    # 1. Remove control characters (except newlines/tabs)
    sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', content)

    # 2. Normalize horizontal whitespace (collapse multiple spaces/tabs)
    sanitized = re.sub(r'[ \t]+', ' ', sanitized)

    # 3. Normalize vertical whitespace (max 2 consecutive newlines)
    sanitized = re.sub(r'\n{3,}', '\n\n', sanitized)

    # 4. Strip leading/trailing whitespace
    sanitized = sanitized.strip()

    # 5. Truncate if too long, preserving word boundaries
    if len(sanitized) > max_length:
        logger.warning(
            f"[SECURITY] Truncating {field_name} from {len(sanitized)} to {max_length} chars"
        )
        # Find last space before max_length for clean truncation
        truncated = sanitized[:max_length]
        last_space = truncated.rfind(' ')
        if last_space > max_length * 0.8:  # Only use space if it's not too far back
            sanitized = truncated[:last_space] + "..."
        else:
            sanitized = truncated + "..."

    # 6. Log suspicious patterns (monitoring only - don't block)
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, sanitized, re.IGNORECASE):
            logger.warning(
                f"[SECURITY] Suspicious pattern detected in {field_name}: "
                f"matched '{pattern[:40]}...'"
            )
            break  # Only log first match to avoid log spam

    return sanitized


def sanitize_persona(persona: Optional[str]) -> str:
    """
    Sanitize user-defined agent persona.

    Args:
        persona: Raw persona text from agent configuration

    Returns:
        Sanitized persona (max 2000 chars)
    """
    return sanitize_user_content(persona, MAX_PERSONA_LENGTH, "persona")


def sanitize_description(description: Optional[str]) -> str:
    """
    Sanitize user-defined agent or skill description.

    Args:
        description: Raw description text

    Returns:
        Sanitized description (max 500 chars)
    """
    return sanitize_user_content(description, MAX_DESCRIPTION_LENGTH, "description")
