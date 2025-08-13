# Test Suite

Comprehensive testing for Emery Agents system.

## Test Structure

- `test_types.py` - Type definition validation
- `test_runner.py` - Core orchestrator functionality  
- `test_smolagents.py` - SmolAgents integration
- `test_grpc.py` - gRPC server communication
- `test_integration.py` - End-to-end integration tests
- `fixtures/` - Test data and configurations

## Running Tests

### All Tests
```bash
uv run pytest tests/ -v
```

### Specific Test Categories  
```bash
# Unit tests only
uv run run_tests.py unit -v

# Integration tests
uv run run_tests.py integration

# SmolAgents integration (requires HF_TOKEN)
export HF_TOKEN="your_token"
uv run run_tests.py smolagents

# gRPC tests  
uv run run_tests.py grpc

# All tests with coverage
uv run run_tests.py all --coverage
```

### Direct pytest Usage
```bash
# Specific test file
uv run pytest tests/test_types.py -v

# With coverage
uv run pytest tests/ --cov=src/emery_agents --cov-report=html
```

## Environment Setup

### Required Environment Variables
```bash
# For SmolAgents tests
export HF_TOKEN="your_huggingface_token"

# For integration tests
export EMERY_API_URL="http://localhost:3000"
export TEST_ORGANIZATION_ID="test_org"
```

### Test Database
Integration tests use temporary directories and in-memory state - no external database required.

## Writing Tests

### Fixtures
Common test fixtures available in `conftest.py`:
- `sample_agent` - Basic agent configuration
- `sample_capability` - Capability with steps
- `mock_integrations` - Mocked external services

### Example Test
```python
import pytest
from emery_agents.core.runner import AgentRunner
from emery_agents.core.types import Agent, CapabilityConfig

@pytest.mark.asyncio
async def test_capability_execution(sample_agent, mock_integrations):
    runner = AgentRunner(**mock_integrations)
    result = await runner.execute_capability(
        sample_agent, 
        "test_capability",
        {"test": "data"}
    )
    assert result.status == TaskStatus.COMPLETED
```

## Test Data

Test configurations in `fixtures/` directory:
- `agents.json` - Sample agent configurations
- `capabilities.json` - Sample capability definitions
- `tasks.json` - Sample task configurations

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch pushes
- Release tags

### GitHub Actions
```yaml
- name: Run tests
  run: |
    export HF_TOKEN="${{ secrets.HF_TOKEN }}"
    uv run pytest tests/ --cov=src/emery_agents
```