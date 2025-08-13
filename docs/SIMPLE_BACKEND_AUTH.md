# Simplest Secure Backend Authentication

## 🎯 Goal: Invisible OAuth Proxy

Users configure everything in frontend, backend just calls agents with a simple API key.

## 🔑 Single API Key Per Agent

### Database Schema (Minimal Addition)
```sql
-- Add just one column to existing agents table
ALTER TABLE agents ADD COLUMN api_key TEXT UNIQUE;

-- Auto-generate API key when agent is created
-- Format: orch_agent_{agent_id}_{random}
-- Example: orch_agent_123_xK9mP2nQ8wR7
```

### Frontend Changes (Dashboard)
```typescript
// /app/dashboard/agents/[id]/page.tsx
function AgentDetailsPage({ agent }) {
  return (
    <div>
      <h1>{agent.name}</h1>
      
      {/* Show API key for backend use */}
      <div className="bg-gray-100 p-4 rounded">
        <h3>Backend API Key</h3>
        <code>{agent.api_key}</code>
        <button onClick={regenerateKey}>Regenerate</button>
      </div>
      
      {/* Existing OAuth connections UI */}
      <OAuthConnectionsManager agent={agent} />
    </div>
  );
}
```

### Backend API Changes (Minimal)
```typescript
// /app/api/agents/execute/route.ts - Simplified
export async function POST(request: NextRequest) {
  // Extract API key from Authorization header
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
  
  // Find agent by API key (single query)
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.api_key, apiKey))
    .limit(1);
    
  if (!agent) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }
  
  // Execute action using agent owner's OAuth credentials
  const { service, action, params } = await request.json();
  const result = await executeWithOwnerCredentials(agent.ownerId, service, action, params);
  
  return Response.json(result);
}
```

## 🐍 Simplified Python Client

### Single Client Class
```python
# backend/src/emery_client/client.py
class EmeryPythonClient:
    """Dead simple agent client - just pass API key and call methods."""
    
    def __init__(self, agent_api_key: str, api_url: str = "https://api.emery.com"):
        self.api_key = agent_api_key
        self.api_url = api_url
        self.session = requests.Session()
        self.session.headers['Authorization'] = f'Bearer {agent_api_key}'
        
        # Auto-detect available services from agent capabilities
        self._setup_services()
    
    def _setup_services(self):
        """Auto-discover what services this agent can use."""
        resp = self.session.get(f"{self.api_url}/api/agents/capabilities")
        capabilities = resp.json()
        
        # Dynamically create service clients
        for service in capabilities['connected_services']:
            setattr(self, service['service'], ServiceClient(self, service['service']))

class ServiceClient:
    """Dynamic service client (Gmail, Slack, etc.)"""
    
    def __init__(self, client, service_name):
        self.client = client  
        self.service = service_name
        
    def __getattr__(self, action_name):
        """Allow any action: client.gmail.send_email(), client.slack.post_message(), etc."""
        def call_action(**kwargs):
            return self.client._execute_action(self.service, action_name, kwargs)
        return call_action

    def _execute_action(self, service, action, params):
        """Execute any action on any service."""
        resp = self.session.post(f"{self.api_url}/api/agents/execute", json={
            'service': service,
            'action': action, 
            'params': params
        })
        return resp.json()
```

### Usage (This is ALL developers need to know)
```python
# Initialize with agent API key (from dashboard)
client = EmeryPythonClient("orch_agent_123_xK9mP2nQ8wR7")

# Use any connected service automatically
client.gmail.send_email(to="user@example.com", subject="Hello", body="World")
client.slack.post_message(channel="#general", text="Deploy complete!")
client.github.create_issue(repo="myorg/myrepo", title="Bug", body="Fix this")

# OAuth credentials are handled invisibly
```

## 🛡️ Security Implementation

### 1. API Key Security
```typescript
// Generate secure API keys
function generateAgentApiKey(agentId: number): string {
  const prefix = 'orch_agent';
  const random = crypto.randomBytes(16).toString('base64url');
  return `${prefix}_${agentId}_${random}`;
}

// Hash API keys in database (optional for extra security)
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
```

### 2. Request Validation
```typescript
// /lib/auth/agent-auth.ts
export async function validateAgentApiKey(apiKey: string): Promise<Agent | null> {
  // Simple direct lookup (or hash lookup if using hashed keys)
  const [agent] = await db
    .select()
    .from(agents) 
    .where(eq(agents.api_key, apiKey))
    .limit(1);
    
  if (!agent) return null;
  
  // Optional: Update last_used timestamp
  await db
    .update(agents)
    .set({ lastUsedAt: new Date() })
    .where(eq(agents.id, agent.id));
    
  return agent;
}
```

### 3. OAuth Proxy Security
```typescript
// Execute actions using agent owner's OAuth credentials
async function executeWithOwnerCredentials(
  ownerId: string, 
  service: string, 
  action: string, 
  params: Record<string, any>
) {
  // Get owner's OAuth tokens for this service
  const tokens = await getOAuthTokensForUser(ownerId, service);
  
  if (!tokens) {
    throw new Error(`${service} not connected for this agent's owner`);
  }
  
  // Execute action using Pipedream Connect with owner's tokens
  return await pipedreamClient.actions.run({
    action: `${service}-${action}`,
    external_user_id: getExternalUserId(ownerId),
    configured_props: params
  });
}
```

## 📁 File Structure (Minimal Changes)

```
emery/
├── app/api/agents/
│   ├── execute/route.ts          # Single endpoint for all actions
│   └── capabilities/route.ts     # Agent discovery
├── backend/
│   └── src/emery_client/
│       ├── __init__.py
│       └── client.py             # Single file, ~100 lines
└── lib/auth/
    └── agent-auth.ts             # API key validation
```

## 🚀 Implementation Steps

### Step 1: Database (5 minutes)
```sql
-- Add API key column to agents table
ALTER TABLE agents ADD COLUMN api_key TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN last_used_at TIMESTAMP;

-- Generate keys for existing agents
UPDATE agents SET api_key = CONCAT('orch_agent_', id, '_', generate_random_string(16));
```

### Step 2: Backend API (30 minutes)  
- Single `/api/agents/execute` endpoint
- API key validation middleware
- OAuth credential proxy logic

### Step 3: Python Client (30 minutes)
- Single Python file with dynamic service discovery
- Auto-generated methods based on agent capabilities
- Simple error handling

### Step 4: Frontend UI (15 minutes)
- Show API key in agent details page
- Copy-to-clipboard functionality
- Key regeneration button

## 🎯 Developer Experience

### What Users See (Frontend)
1. Connect Gmail/Slack/GitHub via OAuth in dashboard
2. Create agent, get API key: `orch_agent_123_xK9mP2nQ8wR7`
3. Done!

### What Developers Use (Backend)
```python
# One line setup
client = EmeryPythonClient("orch_agent_123_xK9mP2nQ8wR7")

# Any connected service works automatically
client.gmail.send_email(to="user@example.com", subject="Deploy complete!")
```

### What They Don't See
- OAuth token management
- Pipedream Connect integration  
- Service discovery complexity
- Authentication flows
- Error handling details

## 🔒 Security Benefits

✅ **No OAuth Tokens in Backend**: Tokens never leave Emery
✅ **Simple Key Management**: One key per agent, easy to revoke
✅ **Automatic Service Discovery**: No hardcoded service lists
✅ **Proxy Authentication**: All requests authenticated through owner's credentials
✅ **Audit Trail**: All actions logged with agent owner context
✅ **Zero Configuration**: Backend apps need zero OAuth setup

This is the **simplest possible** implementation while maintaining enterprise-grade security! 🎯