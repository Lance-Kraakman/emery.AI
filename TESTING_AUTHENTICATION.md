# 🔐 Authentication Testing Guide

This guide clarifies how authentication works in Emery testing and provides clear examples for different testing scenarios.

## 🏗️ Authentication Architecture

### 1. Development Test Bypass
- **Header**: `x-test-user-id: 550e8400-e29b-41d4-a716-446655440000`
- **Usage**: Development-only, bypasses NextAuth
- **APIs**: Agent execution, capabilities, worker status
- **⚠️ Limitation**: Only works in `NODE_ENV=development`

### 2. User API Keys
- **Format**: `user_<48-hex-chars>`
- **Purpose**: Management APIs (agents, tables, tasks, scheduler)
- **Authorization**: `Bearer user_abc123...`
- **Scope**: Full user permissions within organization

### 3. Agent API Keys
- **Format**: `ag_<random-string>`
- **Purpose**: OAuth proxy calls (`/api/agents/proxy`)
- **Authorization**: `Bearer ag_abc123...`
- **Scope**: OAuth delegation for specific agent

### 4. NextAuth Sessions
- **Purpose**: Frontend authentication
- **Method**: OAuth (GitHub, Google) with cookies
- **Scope**: Full UI access

## 🧪 Testing Scenarios

### Scenario 1: Quick Development Testing
**Use Case**: Testing API routes during development
**Method**: Development test bypass

```bash
# Test agent capabilities
curl -H "x-test-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  http://localhost:3000/api/agents/1/capabilities

# Test agent execution  
curl -X POST \
  -H "x-test-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"action":"test","params":{}}' \
  http://localhost:3000/api/agents/1/execute
```

### Scenario 2: User Management Testing
**Use Case**: Testing agent/table creation, scheduler management
**Method**: User API keys

```bash
# First, create a test user and get API key
npx tsx scripts/integration-test-final.ts

# Example output:
📋 Use this configuration for integration tests:
const USER_ACCOUNT_ID = 'ef5b5ea0-19bf-4e8c-bb03-4f027130efd7';
const USER_ORGANIZATION_ID = 1;

🔐 API Key Authentication:
export USER_API_KEY="user_2c254018f6828a8569816162dfb20b9a470cbd4beeb89890"

# Then use the API key:
curl -H "Authorization: Bearer user_2c254018f6828a8569816162dfb20b9a470cbd4beeb89890" \
  http://localhost:3000/api/agents
```

### Scenario 3: Python Client Testing
**Use Case**: Testing OAuth proxy and Python integrations
**Method**: Agent API keys

```bash
# Prerequisites: 
# 1. Agent must exist with API key
# 2. User must have OAuth connections

# Run Python integration test
cd backend
uv run scripts/test_integration.py <agent_id>

# Python client usage
from emery_client.simple_client import EmeryPythonClient

client = EmeryPythonClient("ag_abc123...", "http://localhost:3000")
result = client.gmail.send_email(...)
```

### Scenario 4: Frontend E2E Testing
**Use Case**: Testing complete UI workflows
**Method**: NextAuth with real OAuth

```bash
# 1. Start development server
pnpm dev

# 2. Login via browser at http://localhost:3000
# 3. Connect OAuth services at /connections
# 4. Create agents via UI at /agents
# 5. Test agent workflows
```

## 🔧 Setup Instructions

### Step 1: Database Setup
```bash
docker-compose up -d
pnpm db:migrate
```

### Step 2: Create Test User with API Key
```bash
# Run this to get a test user with API key
npx tsx scripts/integration-test-final.ts

# Or create manually:
npx tsx scripts/setup-user-auth.ts
```

### Step 3: Connect OAuth Services (for OAuth proxy testing)
1. Open http://localhost:3000/connections
2. Login with GitHub/Google  
3. Connect Gmail, Slack, GitHub as needed
4. Note: OAuth connections belong to the logged-in user

### Step 4: Create Test Agent
```bash
# Using User API Key
curl -X POST \
  -H "Authorization: Bearer user_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "role": "assistant", 
    "description": "Integration test agent",
    "tools": [{"name": "gmail_send_email"}]
  }' \
  http://localhost:3000/api/agents

# Response includes agent API key:
{
  "success": true,
  "data": {
    "id": 1,
    "apiKey": "ag_def456...",
    ...
  }
}
```

## 📊 Current Test Scripts

### Frontend/API Tests
- **`scripts/integration-test-final.ts`** ✅ Complete auth flow
- **`scripts/integration-test-api-auth.ts`** ✅ User API key testing  
- **`scripts/manual-scheduler-test.ts`** ⚠️ Uses test user bypass

### Python Tests  
- **`backend/scripts/test_integration.py`** ✅ Agent API key testing
- **`test_system_integration.py`** ✅ Complete workflow

### Cleanup Scripts
- **`scripts/cleanup-test-users-v2.ts`** ✅ Remove orphaned test users
- **`scripts/debug-auth.ts`** ✅ Inspect auth state

## 🚨 Common Issues

### Issue 1: "Unauthorized" in development
**Cause**: Missing `x-test-user-id` header or wrong UUID
**Fix**: Use exact UUID `550e8400-e29b-41d4-a716-446655440000`

### Issue 2: "Agent not found" with agent API key  
**Cause**: Agent doesn't exist or wrong agent ID
**Fix**: Create agent first, use correct agent ID in API calls

### Issue 3: "OAuth service not connected"
**Cause**: User hasn't connected required OAuth service
**Fix**: Visit `/connections` and connect Gmail/Slack/GitHub

### Issue 4: Python client 403 errors
**Cause**: Using wrong API key or missing agent ownership
**Fix**: Use agent API key (starts with `ag_`), ensure agent belongs to connected user

## 💡 Best Practices

### For Development
1. Use `x-test-user-id` header for quick API testing
2. Keep the test UUID consistent across all development scripts
3. Mock external services to avoid OAuth requirements

### For Integration Testing  
1. Create dedicated test users with API keys
2. Use real OAuth connections for proxy testing
3. Clean up test data after test runs
4. Test both user management and agent execution flows

### For Python Clients
1. Always use agent API keys (not user API keys)
2. Ensure agent owner has required OAuth connections
3. Handle webhook timeouts gracefully
4. Test both sync and async execution patterns

## 🔄 Authentication Flow Diagram

```
Frontend (Browser)
    ↓ NextAuth OAuth
NextJS Session 
    ↓ Creates agents
Agent with API Key
    ↓ OAuth proxy calls
External APIs (Gmail, Slack, etc.)

Python Client
    ↓ Agent API Key
Agent OAuth Proxy
    ↓ User's OAuth tokens
External APIs (Gmail, Slack, etc.)

Management APIs  
    ↓ User API Key
NextJS API Routes
    ↓ Database operations
Emery Database
```

## 📝 Environment Variables

```bash
# Required for development testing
NODE_ENV=development

# Required for OAuth proxy
PIPEDREAM_CLIENT_ID=your_client_id
PIPEDREAM_CLIENT_SECRET=your_secret  
PIPEDREAM_API_KEY=your_api_key
PIPEDREAM_PROJECT_ID=your_project_id

# Optional for webhook security
WEBHOOK_SECRET=your_webhook_secret
```

This guide provides clear patterns for all testing scenarios while maintaining security boundaries between different authentication methods.