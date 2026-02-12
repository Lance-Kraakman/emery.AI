"""Test fixtures and configuration."""

import os
import pytest
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock, patch


@pytest.fixture
def sample_tool_config() -> Dict[str, Any]:
    """Basic tool configuration."""
    return {"name": "test_tool", "version": "1.0.0"}


@pytest.fixture
def sample_server_config() -> Dict[str, Any]:
    """Basic server configuration."""
    return {"name": "test_server", "endpoint": "http://localhost:8000"}


@pytest.fixture
def mock_emery_client():
    """Mock Emery client integration."""
    client = Mock()
    client.report_execution_result = AsyncMock()
    return client


@pytest.fixture
def temp_working_dir(tmp_path):
    """Temporary working directory."""
    return tmp_path / "emery_test_workspace"


@pytest.fixture
def hf_token():
    """Provide HF token for tests."""
    return "test-token"


@pytest.fixture
def mock_hf_env(hf_token):
    """Mock HF_TOKEN environment variable."""
    with patch.dict(os.environ, {"HF_TOKEN": hf_token}):
        yield


@pytest.fixture
def pipedream_env():
    """Mock Pipedream environment variables."""
    with patch.dict(os.environ, {"PIPEDREAM_API_KEY": "test-api-key"}):
        yield
