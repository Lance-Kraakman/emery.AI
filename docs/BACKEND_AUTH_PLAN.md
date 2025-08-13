# Backend Authentication Architecture Plan

## Current Status ✅

The Python integration testing is **successfully working** with a development bypass. We have:

- ✅ **Python Client Library**: Complete client with type hints and proper error handling
- ✅ **API Endpoints**: `/api/agents/{id}/capabilities`, `/api/agents/{id}/execute`, `/api/agents/{id}/proxy`  
- ✅ **Development Testing**: Authentication bypass allows testing without OAuth
- ✅ **Webhook Integration**: Flask server for async result delivery
- ✅ **Error Handling**: Proper error propagation and logging

## Production Authentication Requirements

### 1. API Key Authentication ⭐ **RECOMMENDED**

**Implementation**: JWT-based API keys for backend applications

```typescript
// Add to schema.ts
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Human readable name
  keyHash: text("key_hash").notNull().unique(), // Hashed API key
  agentId: integer("agent_id").references(() => agents.id),
  ownerId: uuid("owner_id").references(() => users.id),
  permissions: text("permissions").array().default([]), // Scoped permissions
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Usage Flow**:
1. User creates API key in dashboard for specific agent
2. Python client includes `Authorization: Bearer <api_key>` header
3. API routes validate key and extract agent/user context
4. Rate limiting and permission scoping per key

**Benefits**:
- ✅ **Secure**: No session cookies in backend environments
- ✅ **Scoped**: API keys can be limited to specific agents/actions
- ✅ **Revokable**: Easy to revoke compromised keys
- ✅ **Auditable**: Track usage per key
- ✅ **Flexible**: Different keys for different environments/apps

### 2. OAuth App-to-App Flow 🔒 **ENTERPRISE**

**Implementation**: Backend apps authenticate as applications (not users)

```typescript
// OAuth application registration
export const oauthApps = pgTable("oauth_apps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret").notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  ownerId: uuid("owner_id").references(() => users.id),
  scopes: text("scopes").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Benefits**:
- ✅ **Standards Compliant**: OAuth 2.0 Client Credentials Flow
- ✅ **Enterprise Ready**: Proper app-to-app authentication
- ✅ **Fine-grained**: Scoped permissions per application
- ✅ **Revokable**: Owners can revoke app access

### 3. Agent API Keys 🤖 **SIMPLE**

**Implementation**: Each agent has its own API key

```python
# Python client usage
client = EmeryPythonClient(
    api_url="https://api.emery.com",
    agent_api_key="agent_abc123_key456"  # Agent-specific key
)
```

**Benefits**:
- ✅ **Simple**: One key per agent
- ✅ **Secure**: Key tied to specific agent
- ✅ **Easy Setup**: Generated when agent is created

## Recommended Implementation: API Key Authentication

### Phase 1: Core API Key System

```typescript
// /app/api/auth/api-key/middleware.ts
export async function validateApiKey(request: NextRequest): Promise<{
  userId: string;
  agentId?: number;
  permissions: string[];
} | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const apiKey = authHeader.slice(7);
  const keyHash = await hashApiKey(apiKey);
  
  const [keyRecord] = await db
    .select({
      key: apiKeys,
      user: users,
      agent: agents,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.ownerId, users.id))
    .leftJoin(agents, eq(apiKeys.agentId, agents.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);
  
  if (!keyRecord?.key || isKeyExpired(keyRecord.key)) {
    return null;
  }
  
  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRecord.key.id));
  
  return {
    userId: keyRecord.user.id,
    agentId: keyRecord.agent?.id,
    permissions: keyRecord.key.permissions || [],
  };
}
```

### Phase 2: Dashboard Integration

```typescript
// /app/dashboard/agents/[id]/api-keys/page.tsx
export default function AgentApiKeysPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>API Keys for Agent {params.id}</h1>
      <ApiKeyManager agentId={parseInt(params.id)} />
    </div>
  );
}
```

### Phase 3: Python Client Updates

```python
# backend/src/emery_client/client.py
class EmeryPythonClient:
    def __init__(
        self, 
        api_url: str, 
        api_key: str,  # New: API key instead of agent_id
        webhook_secret: Optional[str] = None,
        debug: bool = False
    ):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        
        # Set authentication headers
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'EmeryPythonClient/2.0',
        })
```

### Phase 4: Migration Strategy

1. **Backward Compatibility**: Keep development bypass for existing tests
2. **Gradual Rollout**: Support both auth methods during transition
3. **Documentation**: Update all guides and examples
4. **SDK Versioning**: Release v2.0 with new authentication

## Security Considerations

### API Key Security
- ✅ **Hashed Storage**: Never store plain text API keys
- ✅ **Secure Generation**: Cryptographically random keys
- ✅ **Rotation**: Support key rotation without downtime
- ✅ **Scope Limitation**: Keys limited to specific agents/actions
- ✅ **Rate Limiting**: Per-key rate limits
- ✅ **Audit Logging**: Log all API key usage

### Network Security
- ✅ **HTTPS Only**: Enforce TLS for all API calls
- ✅ **CORS**: Proper CORS headers for web clients
- ✅ **Headers**: Security headers (HSTS, CSP, etc.)

### Monitoring & Alerting
- ✅ **Failed Auth**: Alert on excessive failed authentication attempts
- ✅ **Unusual Usage**: Detect anomalous API usage patterns
- ✅ **Key Compromise**: Automatic key revocation on suspicious activity

## Implementation Timeline

### Week 1: Core Infrastructure
- [ ] Database schema for API keys
- [ ] Key generation and hashing utilities
- [ ] Basic validation middleware

### Week 2: API Integration  
- [ ] Update all agent API routes to support API key auth
- [ ] Maintain backward compatibility with development bypass
- [ ] Error handling and logging

### Week 3: Dashboard Features
- [ ] API key management UI
- [ ] Key creation/revocation interface
- [ ] Usage analytics dashboard

### Week 4: Python Client Updates
- [ ] Update Python client for API key authentication
- [ ] Update documentation and examples
- [ ] Release v2.0 of client library

### Week 5: Testing & Security
- [ ] Security audit of implementation
- [ ] Load testing with API keys
- [ ] Integration tests for all flows

## Future Enhancements

### Advanced Features
- **Key Scoping**: Limit keys to specific actions or services
- **Temporary Keys**: Short-lived keys for specific tasks
- **Key Hierarchies**: Master keys that can create sub-keys
- **IP Restrictions**: Limit key usage to specific IP ranges
- **Webhook Signing**: Sign webhook payloads with key-specific secrets

### Enterprise Features
- **SSO Integration**: SAML/OIDC for enterprise customers
- **RBAC Integration**: Role-based permissions for API keys
- **Audit Trails**: Comprehensive audit logs for compliance
- **Key Management**: Centralized key rotation and policy management

## Conclusion

The **API Key Authentication** approach provides the best balance of:
- Security (proper authentication without session complexity)
- Usability (simple for developers to implement)
- Scalability (no session state management)
- Flexibility (fine-grained permissions and scoping)

This aligns with industry standards for API authentication and provides a clear upgrade path from the current development setup.