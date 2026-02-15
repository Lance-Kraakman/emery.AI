"""mem0 custom providers with usage tracking."""

from __future__ import annotations

import contextvars
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Generator

import dspy
from mem0.embeddings.base import EmbeddingBase, BaseEmbedderConfig
from mem0.llms.base import LLMBase, BaseLlmConfig
from mem0.utils.factory import EmbedderFactory, LlmFactory

from ..analysis.embedding_usage import get_current_tracker, set_current_tracker
from ..analysis.embeddings import get_embedding
from ..analysis.llm_usage import record_from_lm

if TYPE_CHECKING:
    from ..analysis.token_accumulator import TokenAccumulator

_llm_tracker: contextvars.ContextVar[Any] = contextvars.ContextVar("_mem0_llm_tracker")
_current_lm: contextvars.ContextVar[dspy.LM] = contextvars.ContextVar("_mem0_lm")


class TrackedEmbedder(EmbeddingBase):
    def __init__(self, config: Any = None) -> None:
        self.config = BaseEmbedderConfig(embedding_dims=768)

    def embed(self, text: str, memory_action: str | None = None) -> list[float]:  # type: ignore[override]
        return list(get_embedding(text, tracker=get_current_tracker()))


class TrackedLLM(LLMBase):
    def __init__(self, config: Any = None) -> None:
        self.config = BaseLlmConfig()

    def generate_response(  # type: ignore[override]
        self,
        messages: list[dict[str, str]],
        tools: list[Any] | None = None,
        tool_choice: str = "auto",
        **kwargs: Any,
    ) -> str:
        lm = _current_lm.get()  # Raises LookupError if not set
        response = lm(messages=messages)
        record_from_lm(lm, _llm_tracker.get())
        if not response:
            raise RuntimeError("LLM returned empty response")
        return str(response[0])


def register_tracked_providers() -> None:
    """Patch mem0 factories to support 'tracked' provider."""
    original_embedder_create = EmbedderFactory.create
    original_llm_create = LlmFactory.create

    def patched_embedder_create(  # type: ignore[no-untyped-def]
        provider_name, config, vector_config
    ):
        if provider_name == "tracked":
            return TrackedEmbedder()
        return original_embedder_create(provider_name, config, vector_config)

    def patched_llm_create(provider_name, config):  # type: ignore[no-untyped-def]
        if provider_name == "tracked":
            return TrackedLLM()
        return original_llm_create(provider_name, config)

    EmbedderFactory.create = patched_embedder_create  # type: ignore[method-assign]
    LlmFactory.create = patched_llm_create  # type: ignore[method-assign]


@contextmanager
def memory_tracking_scope(
    token_accumulator: TokenAccumulator,
    lm: dspy.LM,
) -> Generator[None, None, None]:
    with set_current_tracker(token_accumulator.get_embedding_tracker()):
        llm_token = _llm_tracker.set(token_accumulator.get_llm_tracker())
        lm_token = _current_lm.set(lm)
        try:
            yield
        finally:
            _llm_tracker.reset(llm_token)
            _current_lm.reset(lm_token)


# Register on module load
register_tracked_providers()
