# Backend - Python Testing & Integration

This directory contains Python-based testing scripts and integration tools for the Orchastrate system.

## Overview

The backend directory provides Python tools for testing and integrating with the Orchastrate Next.js API routes. This is specifically for Python applications that need to use Orchastrate agents with OAuth credential delegation.

## Architecture

```
backend/
├── CLAUDE.md              # This file
├── CLAUDE.local.md         # Development guidelines
├── pyproject.toml          # uv-based Python project configuration
├── src/
│   └── orchastrate_client/ # Python client library
│       ├── __init__.py
│       ├── client.py       # Main OrchastratePythonClient
│       ├── gmail.py        # Gmail integration examples
│       └── types.py        # Type definitions
├── tests/                  # Unit tests
│   ├── __init__.py
│   ├── test_client.py
│   └── test_gmail.py
└── scripts/                # Manual testing scripts
    ├── __init__.py
    └── test_integration.py  # Integration test runner
```

## Setup

### Prerequisites
- Python 3.11+
- uv package manager

### Installation
```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install project dependencies
cd backend
uv sync
```

### Development
```bash
# Activate virtual environment
source .venv/bin/activate

# Run integration tests
uv run scripts/test_integration.py <agent_id>

# Run unit tests
uv run pytest tests/

# Type checking
uv run mypy src/
```

## Integration with Orchastrate

### Next.js API Routes
The Python client integrates with these Next.js API routes:

- `POST /api/agents/{id}/execute` - Execute Pipedream actions using agent owner's OAuth credentials
- `POST /api/agents/{id}/proxy` - Proxy authenticated API requests without exposing tokens
- `GET /api/agents/{id}/capabilities` - Discover connected services and available actions

### Authentication & Security
- **Agent Ownership**: Only agent owners can execute actions through their agents
- **OAuth Delegation**: OAuth credentials remain in Next.js environment, never exposed to Python
- **Webhook Security**: HMAC signature verification for webhook payloads
- **Audit Logging**: All agent actions logged with execution IDs

## Usage Examples

### Basic Client Usage
```python
from orchastrate_client import OrchastratePythonClient

# Initialize client
client = OrchastratePythonClient(
    api_url="http://localhost:3000",
    agent_id=1
)

# Get agent capabilities
capabilities = client.get_capabilities()
print(f"Connected services: {[s.service for s in capabilities.connected_services]}")

# Execute action
result = client.execute_action("gmail-send-email", {
    "to": "test@example.com",
    "subject": "Test Email",
    "body": "Hello from Orchastrate agent!"
})
```

### Gmail Integration
```python
from orchastrate_client.gmail import GmailIntegration

gmail = GmailIntegration(client)

# Send email
gmail.send_email(
    to="recipient@example.com",
    subject="Python Integration Test",
    body="This email was sent via Orchastrate agent!"
)

# Get messages
messages = gmail.get_messages(query="is:unread", max_results=5)

# Proxy API call
profile = gmail.get_profile()
```

### Webhook Integration
```python
# Start webhook server for async results
webhook_url = client.start_webhook_server(port=3001)

# Execute action with webhook callback
result = client.execute_action("gmail-get-messages", {
    "query": "is:inbox",
    "maxResults": 10
}, use_webhook=True)

# Webhook results will be delivered to the server
```

## Testing

### Integration Tests
Run integration tests against a running Orchastrate instance:

```bash
# Ensure Orchastrate is running
cd ..
pnpm dev

# Run integration tests
cd backend
uv run scripts/test_integration.py 1  # Replace 1 with actual agent ID
```

### Unit Tests
```bash
uv run pytest tests/ -v
```

## Development Guidelines

### Code Style
- Use dataclasses for structured data
- Include comprehensive type hints
- Follow PEP 8 naming conventions
- Add AIDEV-* anchor comments for complex code

### Error Handling
- Use custom exception classes for API errors
- Include context in error messages
- Log errors with appropriate levels

### Testing
- Write meaningful unit tests, avoid excessive mocking
- Test actual API integration scenarios
- Include webhook delivery testing
- Verify HMAC signature validation

## Security Considerations

- **No Token Storage**: OAuth tokens never stored in Python environment
- **HMAC Verification**: All webhook payloads verified with HMAC signatures
- **Agent Ownership**: Strict validation of agent ownership before any operations
- **Timeout Handling**: All API calls include reasonable timeouts
- **Audit Trail**: All operations logged for security audit

## Troubleshooting

### Common Issues

1. **Agent Not Found**: Ensure agent ID exists and you have ownership
2. **OAuth Not Connected**: Connect required services via `/dashboard/connections`
3. **Webhook Timeouts**: Check webhook server is accessible from Next.js app
4. **Permission Denied**: Verify agent ownership and RBAC permissions

### Debug Mode
```python
import logging
logging.basicConfig(level=logging.DEBUG)

client = OrchastratePythonClient(api_url="...", agent_id=1, debug=True)
```

### Environment Variables
```bash
export ORCHASTRATE_API="http://localhost:3000"
export WEBHOOK_SECRET="your-webhook-secret"
export LOG_LEVEL="DEBUG"
```