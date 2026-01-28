"""
PII Filter — Strips personally identifiable information from text.

Uses Microsoft Presidio for NER-based PII detection and anonymization.
Only used for agent memories (shared across users). User memories skip PII.

Replaces PII with type-tagged placeholders like <PERSON>, <EMAIL_ADDRESS>, etc.
Irreversible by design — we don't need to recover PII from agent memories.
"""

import logging
from typing import List

from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

logger = logging.getLogger(__name__)

# Default PII entities to detect and redact
DEFAULT_PII_ENTITIES: List[str] = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "US_SSN",
    "CREDIT_CARD",
    "IP_ADDRESS",
    "LOCATION",
]


class PIIFilter:
    """Strips PII from text before storage. Used for agent memories (shared)."""

    def __init__(self, entities: List[str] | None = None):
        """
        Initialize PII filter with Presidio engines.

        Args:
            entities: PII entity types to detect. Defaults to DEFAULT_PII_ENTITIES.
        """
        self._analyzer = AnalyzerEngine()
        self._anonymizer = AnonymizerEngine()  # type: ignore[no-untyped-call]
        self._entities = entities or DEFAULT_PII_ENTITIES
        logger.info(f"PIIFilter initialized with {len(self._entities)} entity types")

    def redact(self, text: str) -> str:
        """Remove PII from text, replacing with type placeholders.

        Args:
            text: Input text potentially containing PII.

        Returns:
            Text with PII replaced by type placeholders (e.g., <PERSON>).
        """
        if not text:
            return text

        try:
            results = self._analyzer.analyze(
                text=text,
                language="en",
                entities=self._entities,
            )
            if not results:
                return text

            anonymized = self._anonymizer.anonymize(
                text=text,
                analyzer_results=results,  # type: ignore[arg-type]
            )
            return anonymized.text
        except Exception as e:
            logger.warning(f"PII redaction failed, returning original text: {e}")
            return text
