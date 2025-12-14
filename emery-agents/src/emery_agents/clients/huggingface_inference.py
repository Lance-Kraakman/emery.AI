"""
HuggingFace Inference Client

AIDEV-NOTE: Client for HuggingFace task-specific API calls.
Handles both dedicated endpoints and Inference API based on model registry.
Used for direct skill execution (no LLM orchestration).
"""

import os
import io
import logging
from typing import Any, Dict, Optional

from huggingface_hub import InferenceClient
from PIL import Image

from .base import BaseInferenceClient, TaskResult, TaskResultType
from ..services.model_registry import get_model_metadata

logger = logging.getLogger(__name__)


# Supported task types for HuggingFace Inference API
SUPPORTED_TASK_TYPES = [
    'text-to-image',
    'speech-to-text',
    'text-to-speech',
    'object-detection',
    'image-classification',
    'summarization',
    'zero-shot-classification',
    'feature-extraction',
    'question-answering',
]


class HuggingFaceInferenceClient(BaseInferenceClient):
    """
    Client for HuggingFace task-specific API calls.

    Handles both dedicated endpoints and Inference API.
    Uses model registry to determine endpoint routing.
    """

    def __init__(self, token: Optional[str] = None):
        """
        Initialize the HuggingFace client.

        Args:
            token: HuggingFace API token. Falls back to HF_TOKEN env var.
        """
        self.token = token or os.getenv('HF_TOKEN')
        if not self.token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is required for HuggingFace API access. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        # Cache clients per model to reuse connections
        self._clients: Dict[str, InferenceClient] = {}
        logger.info("✅ HuggingFaceInferenceClient initialized")

    def _get_client(self, model_id: str) -> InferenceClient:
        """
        Get or create InferenceClient for model.

        Handles dedicated endpoints vs Inference API routing based on model registry.
        """
        if model_id in self._clients:
            return self._clients[model_id]

        metadata = get_model_metadata(model_id)
        if metadata and metadata.endpoint.type == "dedicated" and metadata.endpoint.url:
            # Dedicated endpoint - use full URL
            endpoint = metadata.endpoint.url
            logger.info(f"🔧 Using dedicated endpoint for {model_id}: {endpoint}")
        else:
            # Inference API - model ID routes automatically
            endpoint = model_id
            logger.info(f"🔧 Using HF Inference API for model: {model_id}")

        client = InferenceClient(model=endpoint, token=self.token)
        self._clients[model_id] = client
        return client

    @property
    def supported_task_types(self) -> list[str]:
        """List of task types this client supports."""
        return SUPPORTED_TASK_TYPES

    def supports_task_type(self, task_type: str) -> bool:
        """Check if this client supports a specific task type."""
        return task_type in SUPPORTED_TASK_TYPES

    async def execute_task(
        self,
        model_id: str,
        task_type: str,
        inputs: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None
    ) -> TaskResult:
        """
        Execute a task based on task_type.

        Routes to appropriate HF Inference method based on task type.
        """
        params = parameters or {}
        logger.info(f"🚀 Executing {task_type} with model {model_id}")

        match task_type:
            case 'text-to-image':
                return await self._text_to_image(model_id, inputs, params)

            case 'speech-to-text':
                return await self._speech_to_text(model_id, inputs, params)

            case 'text-to-speech':
                return await self._text_to_speech(model_id, inputs, params)

            case 'object-detection':
                return await self._object_detection(model_id, inputs, params)

            case 'image-classification':
                return await self._image_classification(model_id, inputs, params)

            case 'summarization':
                return await self._summarization(model_id, inputs, params)

            case 'zero-shot-classification':
                return await self._zero_shot_classification(model_id, inputs, params)

            case 'feature-extraction':
                return await self._feature_extraction(model_id, inputs, params)

            case 'question-answering':
                return await self._question_answering(model_id, inputs, params)

            case _:
                raise ValueError(f"Unsupported task type: {task_type}")

    # === Task-Specific Methods ===

    async def _text_to_image(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Generate image from text prompt."""
        prompt = inputs.get("prompt", "")
        if not prompt:
            raise ValueError("text-to-image requires 'prompt' input")

        logger.info(f"🎨 Generating image: '{prompt[:50]}...'")
        client = self._get_client(model_id)

        # Call HF text_to_image
        image: Image.Image = client.text_to_image(
            prompt=prompt,
            negative_prompt=inputs.get("negative_prompt") or params.get("negative_prompt"),
            num_inference_steps=int(params.get("num_inference_steps", 4)),
            guidance_scale=float(params.get("guidance_scale", 0.0)),
            width=int(params.get("width", 1024)),
            height=int(params.get("height", 1024)),
        )

        # Convert PIL Image to PNG bytes
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()

        logger.info(f"✅ Generated image: {len(image_bytes)} bytes")
        return TaskResult(
            type=TaskResultType.IMAGE,
            data=image_bytes,
            metadata={"format": "png", "width": image.width, "height": image.height}
        )

    async def _speech_to_text(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Transcribe audio to text."""
        audio = inputs.get("audio")
        if not audio:
            raise ValueError("speech-to-text requires 'audio' input (bytes)")

        logger.info(f"🎤 Transcribing audio: {len(audio)} bytes")
        client = self._get_client(model_id)

        result = client.automatic_speech_recognition(audio=audio)
        text = result.text
        logger.info(f"✅ Transcribed: {len(text)} chars")

        return TaskResult(
            type=TaskResultType.TEXT,
            data=text,
            metadata={"model": model_id}
        )

    async def _text_to_speech(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Generate audio from text."""
        text = inputs.get("text", "")
        if not text:
            raise ValueError("text-to-speech requires 'text' input")

        logger.info(f"🔊 Generating speech: '{text[:50]}...'")
        client = self._get_client(model_id)

        audio = client.text_to_speech(text=text)

        logger.info(f"✅ Generated audio: {len(audio)} bytes")
        return TaskResult(
            type=TaskResultType.AUDIO,
            data=audio,
            metadata={"format": "wav", "model": model_id}
        )

    async def _object_detection(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Detect objects in image."""
        image = inputs.get("image")
        if not image:
            raise ValueError("object-detection requires 'image' input (bytes)")

        logger.info(f"🔍 Detecting objects: {len(image)} bytes")
        client = self._get_client(model_id)

        results = client.object_detection(image=image)

        # Filter by threshold if provided
        threshold = float(params.get("threshold", 0.5))
        filtered = [
            {"label": r.label, "score": r.score, "box": {"xmin": r.box.xmin, "ymin": r.box.ymin, "xmax": r.box.xmax, "ymax": r.box.ymax}}
            for r in results
            if r.score >= threshold
        ]

        logger.info(f"✅ Detected {len(filtered)} objects (threshold={threshold})")
        return TaskResult(
            type=TaskResultType.JSON,
            data=filtered,
            metadata={"count": len(filtered), "threshold": threshold}
        )

    async def _image_classification(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Classify image."""
        image = inputs.get("image")
        if not image:
            raise ValueError("image-classification requires 'image' input (bytes)")

        logger.info(f"🏷️ Classifying image: {len(image)} bytes")
        client = self._get_client(model_id)

        results = client.image_classification(image=image)

        # Return top K results as dicts
        top_k = int(params.get("top_k", 5))
        top_results = [{"label": r.label, "score": r.score} for r in results[:top_k]]

        logger.info(f"✅ Classification: top = {top_results[0]['label'] if top_results else 'none'}")
        return TaskResult(
            type=TaskResultType.JSON,
            data=top_results,
            metadata={"top_k": top_k}
        )

    async def _summarization(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Summarize text."""
        text = inputs.get("text", "")
        if not text:
            raise ValueError("summarization requires 'text' input")

        logger.info(f"📝 Summarizing: {len(text)} chars")
        client = self._get_client(model_id)

        # HuggingFace summarization uses generate_parameters for length control
        generate_params = {
            "max_length": int(params.get("max_length", 150)),
            "min_length": int(params.get("min_length", 30))
        }
        result = client.summarization(
            text=text,
            generate_parameters=generate_params
        )

        summary = result.summary_text
        logger.info(f"✅ Summary: {len(summary)} chars")

        return TaskResult(
            type=TaskResultType.TEXT,
            data=summary,
            metadata={"original_length": len(text), "summary_length": len(summary)}
        )

    async def _zero_shot_classification(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Classify text into provided labels."""
        text = inputs.get("text", "")
        candidate_labels = inputs.get("candidate_labels", [])

        if not text:
            raise ValueError("zero-shot-classification requires 'text' input")
        if not candidate_labels:
            raise ValueError("zero-shot-classification requires 'candidate_labels' input")

        logger.info(f"🎯 Zero-shot classifying: '{text[:50]}...' into {candidate_labels}")
        client = self._get_client(model_id)

        results = client.zero_shot_classification(
            text=text,
            candidate_labels=candidate_labels
        )

        # Convert to dict format for consistency
        labels = [r.label for r in results]
        scores = [r.score for r in results]
        result_dict: Dict[str, Any] = {"labels": labels, "scores": scores}
        top_label = labels[0] if labels else "?"

        logger.info(f"✅ Top label: {top_label}")
        return TaskResult(
            type=TaskResultType.JSON,
            data=result_dict,
            metadata={"labels_count": len(candidate_labels)}
        )

    async def _feature_extraction(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Generate text embeddings."""
        text = inputs.get("text", "")
        if not text:
            raise ValueError("feature-extraction requires 'text' input")

        logger.info(f"🔢 Generating embeddings: '{text[:50]}...'")
        client = self._get_client(model_id)

        result = client.feature_extraction(text=text)

        # Handle different response formats
        if isinstance(result, list):
            if isinstance(result[0], list):
                # Nested array: [[0.1, 0.2, ...]]
                embedding = result[0]
            else:
                # Flat array: [0.1, 0.2, ...]
                embedding = result
        else:
            embedding = list(result)

        logger.info(f"✅ Generated embedding: {len(embedding)} dimensions")
        return TaskResult(
            type=TaskResultType.EMBEDDING,
            data=embedding,
            metadata={"dimensions": len(embedding)}
        )

    async def _question_answering(
        self,
        model_id: str,
        inputs: Dict[str, Any],
        params: Dict[str, Any]
    ) -> TaskResult:
        """Extract answer from context for a question."""
        question = inputs.get("question", "")
        context = inputs.get("context", "")

        if not question:
            raise ValueError("question-answering requires 'question' input")
        if not context:
            raise ValueError("question-answering requires 'context' input")

        logger.info(f"❓ Question answering: '{question}'")
        client = self._get_client(model_id)

        # Returns single object or list depending on model
        result = client.question_answering(
            question=question,
            context=context
        )

        # Handle both single result and list of results
        if isinstance(result, list):
            first = result[0] if result else None
            if first is None:
                result_dict: Dict[str, Any] = {"answer": "", "score": 0.0, "start": 0, "end": 0}
            else:
                result_dict = {"answer": first.answer, "score": first.score, "start": first.start, "end": first.end}
        else:
            result_dict = {"answer": result.answer, "score": result.score, "start": result.start, "end": result.end}

        logger.info(f"✅ Answer: {result_dict['answer']}")
        return TaskResult(
            type=TaskResultType.JSON,
            data=result_dict,
            metadata={"score": result_dict["score"]}
        )
