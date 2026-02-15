"""
PII Filter — Strips personally identifiable information from text.

Uses Microsoft Presidio for NER-based PII detection and anonymization.
Only used for agent memories (shared across users). User memories skip PII.

Replaces PII with type-tagged placeholders like <PERSON>, <EMAIL_ADDRESS>, etc.
Irreversible by design — we don't need to recover PII from agent memories.
"""

from __future__ import annotations

import logging

from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

logger = logging.getLogger(__name__)

# Use en_core_web_sm (pre-installed in Docker) instead of default en_core_web_lg
_NLP_CONFIG = {
    "nlp_engine_name": "spacy",
    "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
}

DEFAULT_PII_ENTITIES: list[str] = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "US_SSN",
    "CREDIT_CARD",
    "IP_ADDRESS",
    "LOCATION",
]

# Module-level singleton (lazy-initialized)
_pii_filter: "PIIFilter | None" = None


def get_pii_filter() -> "PIIFilter":
    """Get the singleton PIIFilter instance (lazy-initialized)."""
    global _pii_filter
    if _pii_filter is None:
        _pii_filter = PIIFilter()
    return _pii_filter


class PIIFilter:
    """Strips PII from text. Stateless and thread-safe."""

    def __init__(self, entities: list[str] | None = None):
        """Initialize Presidio engines. Use get_pii_filter() for singleton access."""
        provider = NlpEngineProvider(nlp_configuration=_NLP_CONFIG)
        nlp_engine = provider.create_engine()
        self._analyzer = AnalyzerEngine(nlp_engine=nlp_engine)
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
