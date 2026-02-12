"""
Conftest for executors tests.

Minimal setup to avoid circular import issues.
The main conftest.py imports from emery_agents which has circular dependencies,
so we skip it for these tests.
"""

import pytest


# Minimal fixtures for testing
@pytest.fixture
def auth_config():
    """Create a test AuthConfig."""
    from emery_agents.entities.configs import AuthConfig
    return AuthConfig(api_key="test-key", org_id=1)
