"""
Embedding Generation Tool

Generates vector embeddings for text using HuggingFace sentence-transformers models.
"""

from typing import List, Union, Dict, Any, Optional
from sentence_transformers import SentenceTransformer


class EmbeddingTool:
    """Generate text embeddings using HuggingFace models."""

    # Cache models to avoid reloading
    _model_cache: Dict[str, SentenceTransformer] = {}

    # Default model configuration
    DEFAULT_MODEL = "sentence-transformers/all-mpnet-base-v2"

    # Supported models with their dimensions
    SUPPORTED_MODELS = {
        "sentence-transformers/all-mpnet-base-v2": 768,
        "sentence-transformers/all-MiniLM-L6-v2": 384,
        "sentence-transformers/all-MiniLM-L12-v2": 384,
    }

    def __init__(self):
        self.default_model = self.DEFAULT_MODEL

    def execute(
        self,
        text: Union[str, List[str]],
        model: Optional[str] = None,
        normalize: bool = True
    ) -> Dict[str, Any]:
        """
        Generate embedding(s) for text.

        Args:
            text: Single text string or list of text strings to embed
            model: HuggingFace model ID (default: all-mpnet-base-v2)
            normalize: Apply L2 normalization to embeddings (default: True)

        Returns:
            Dictionary containing:
                - embeddings: Single embedding vector or list of embedding vectors
                - dimension: Integer dimension of embedding vectors
                - model: String model ID that was used

        Examples:
            # Single text
            result = tool.execute("Hello world")
            # result = {"embeddings": [0.1, 0.2, ...], "dimension": 768, "model": "..."}

            # Batch processing
            result = tool.execute(["Text 1", "Text 2", "Text 3"])
            # result = {"embeddings": [[0.1, ...], [0.2, ...], [0.3, ...]], "dimension": 768, "model": "..."}
        """
        model_id = model or self.default_model

        # Validate model if in supported list
        if model_id in self.SUPPORTED_MODELS:
            expected_dim = self.SUPPORTED_MODELS[model_id]
        else:
            # Allow custom models, dimension will be determined from output
            expected_dim = None

        # Load model (cached)
        if model_id not in self._model_cache:
            try:
                self._model_cache[model_id] = SentenceTransformer(model_id)
            except Exception as e:
                raise ValueError(f"Failed to load model '{model_id}': {str(e)}")

        model_instance = self._model_cache[model_id]

        # Generate embeddings
        is_batch = isinstance(text, list)
        texts = text if is_batch else [text]

        # Filter out empty strings
        non_empty_texts = [t for t in texts if t and t.strip()]
        if not non_empty_texts:
            # Return empty embeddings if no valid text
            if is_batch:
                return {
                    "embeddings": [],
                    "dimension": expected_dim or 0,
                    "model": model_id
                }
            else:
                return {
                    "embeddings": [],
                    "dimension": expected_dim or 0,
                    "model": model_id
                }

        try:
            embeddings = model_instance.encode(
                non_empty_texts,
                normalize_embeddings=normalize,
                convert_to_numpy=True,
                show_progress_bar=False  # Disable progress bar for API use
            )
        except Exception as e:
            raise RuntimeError(f"Failed to generate embeddings: {str(e)}")

        # Convert to list of lists
        embedding_list = embeddings.tolist()

        # Get actual dimension from output
        actual_dim = len(embedding_list[0]) if embedding_list else (expected_dim or 0)

        # Validate dimension if we know what to expect
        if expected_dim is not None and actual_dim != expected_dim:
            raise ValueError(
                f"Dimension mismatch: expected {expected_dim} but got {actual_dim} "
                f"for model '{model_id}'"
            )

        return {
            "embeddings": embedding_list if is_batch else embedding_list[0],
            "dimension": actual_dim,
            "model": model_id
        }


# Tool registration metadata for the system
TOOL_METADATA = {
    "name": "generate_embedding",
    "description": "Generate vector embeddings for text using HuggingFace sentence-transformer models",
    "category": "ai",
    "parameters": {
        "text": {
            "type": "string or array",
            "required": True,
            "description": "Text string or array of text strings to embed"
        },
        "model": {
            "type": "string",
            "required": False,
            "default": "sentence-transformers/all-mpnet-base-v2",
            "description": "HuggingFace model ID (supports custom models)"
        },
        "normalize": {
            "type": "boolean",
            "required": False,
            "default": True,
            "description": "Apply L2 normalization to embeddings"
        }
    },
    "returns": {
        "embeddings": {
            "type": "array or nested array",
            "description": "Embedding vector(s) as float arrays"
        },
        "dimension": {
            "type": "integer",
            "description": "Dimension of embedding vectors"
        },
        "model": {
            "type": "string",
            "description": "Model ID that was used"
        }
    },
    "supported_models": {
        "all-mpnet-base-v2": {"dimension": 768, "description": "High quality, default"},
        "all-MiniLM-L6-v2": {"dimension": 384, "description": "Fast, lightweight"},
        "all-MiniLM-L12-v2": {"dimension": 384, "description": "Balanced performance"},
    }
}
