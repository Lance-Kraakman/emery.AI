# Unified Token Authentication System

This document describes the unified token system used for authentication across the platform.

## Overview

All tokens are stored in the `api_tokens` table with a consistent schema. Tokens are stored as SHA-256 hashes - plaintext is only available at generation time and must be securely stored by the client.

## Token Types

| Token Type | Prefix | Purpose | TTL | Scopes |
|------------|--------|---------|-----|--------|
| Device | `device_` | Tauri desktop sync | None (stable) | `workspace:sync`, `agent:stream` |
| Callback | `cb_` | Agent/skill execution | 1 hour | `agent:callback` |
| User API | `user_` | User automation | None | `user:read`, `user:write`, `agent:read`, `agent:write` |
| Agent API | `agent_` | Agent identity (webhooks, proxy) | None | `agent:execute`, `oauth:proxy` |
| Published Agent | `pk_` | External API access | None | `task:execute`, `skill:execute` |

## Token Flows

### 1. Device Token Flow (Tauri Desktop Sync)

Used by the Tauri desktop app for workspace synchronization.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tauri     │     │  Next.js    │     │  Database   │
│   Desktop   │     │  Server     │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  Device Flow      │                   │
       │  (code polling)   │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │  getOrCreateDeviceToken()
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Return existing or create new
       │                   │<──────────────────│
       │                   │                   │
       │  device_xxx token │                   │
       │<──────────────────│                   │
       │                   │                   │
       │  Use for sync     │                   │
       │──────────────────>│                   │
       │                   │  validateToken()  │
       │                   │──────────────────>│
       │                   │                   │
```

**Key Files:**
- `src/app/api/auth/device/verify/route.ts` - Device flow verification
- `src/app/api/user/refresh-api-key/route.ts` - Token refresh endpoint

**Important:** Device tokens are stable and do NOT get rotated when agents/skills execute. This ensures Tauri sync remains functional.

### 2. Agent API Key Flow (Webhooks & OAuth Proxy)

Used for agent identity in webhook triggers and OAuth proxy calls.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  External   │     │  Next.js    │     │  Database   │
│  Service    │     │  Server     │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  POST /api/webhooks/[agentId]         │
       │  Authorization: Bearer agent_xxx      │
       │──────────────────>│                   │
       │                   │                   │
       │                   │  validateToken()  │
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Check agentId matches
       │                   │<──────────────────│
       │                   │                   │
       │                   │  Execute webhook task
       │                   │                   │
```

**Key Files:**
- `src/app/api/webhooks/[agentId]/route.ts` - Webhook endpoint
- `src/app/api/connections/proxy/route.ts` - OAuth proxy endpoint
- `src/ddd/application/services/agents/agent-application-service.ts` - Agent creation (generates token)

**Token Generation:** Agent API keys are created when an agent is created:
```typescript
const apiKeyPlaintext = await createToken({
  tokenType: TokenType.AGENT_API,
  agentId: savedAgent.id.value,
  userId: ownerId.value,
});
```

### 3. Callback Token Flow (Agent/Skill Execution)

Short-lived tokens used during agent and skill execution. These isolate execution credentials from the user's main API key.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  Next.js    │     │  Python     │     │  Database   │
│   Browser   │     │  Server     │     │  Worker     │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  Chat message     │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │  createCallbackToken()                │
       │                   │──────────────────────────────────────>│
       │                   │                   │                   │
       │                   │  cb_xxx (1hr TTL) │                   │
       │                   │<──────────────────────────────────────│
       │                   │                   │                   │
       │                   │  gRPC with cb_xxx │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │  Tool calls with  │
       │                   │                   │  cb_xxx token     │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
```

**Key Files:**
- `src/app/api/chat/stream-grpc/route.ts` - Chat streaming (creates callback token)
- `src/app/actions/skills.ts` - Skill execution (creates callback token)
- `src/ddd/infrastructure/execution/grpc-agent-execution-repository.ts` - Task execution

**Why Callback Tokens?**
- Previous system rotated user's main API key on every execution
- This broke Tauri sync because the device token became invalid
- Callback tokens are isolated, short-lived, and don't affect other tokens

## Token Service API

### Creating Tokens

```typescript
import { createToken, TokenType } from '@/lib/auth/token-service';

// Create an agent API key
const agentKey = await createToken({
  tokenType: TokenType.AGENT_API,
  agentId: 123,
  userId: 'user-uuid',
});

// Create a callback token (auto-expires in 1 hour)
const callbackToken = await createCallbackToken(userId, agentId);

// Get or create device token (stable)
const deviceToken = await getOrCreateDeviceToken(userId);
```

### Validating Tokens

```typescript
import { validateToken } from '@/lib/auth/token-service';

// Basic validation
const token = await validateToken(plaintext);
if (!token) {
  return { error: 'Invalid token' };
}

// Validation with required scopes
const token = await validateToken(plaintext, ['oauth:proxy']);
if (!token) {
  return { error: 'Invalid token or missing scopes' };
}

// Access token info
console.log(token.userId);      // User ID if present
console.log(token.agentId);     // Agent ID if present
console.log(token.user?.email); // User details (fetched)
console.log(token.agent?.name); // Agent details (fetched)
```

### Rotating Tokens

```typescript
import { rotateToken } from '@/lib/auth/token-service';

// Rotate a token (old hash valid for 24h grace period)
const newPlaintext = await rotateToken(tokenId);
```

### Revoking Tokens

```typescript
import { revokeToken, revokeUserTokens } from '@/lib/auth/token-service';

// Revoke a specific token
await revokeToken(tokenId);

// Revoke all tokens of a type for a user
await revokeUserTokens(userId, TokenType.DEVICE);
```

## Database Schema

```sql
CREATE TABLE api_tokens (
  id SERIAL PRIMARY KEY,
  token_type TEXT NOT NULL,           -- 'user_api', 'device', 'callback', etc.
  token_hash TEXT UNIQUE NOT NULL,    -- SHA-256 hash
  token_prefix TEXT NOT NULL,         -- First 12 chars for display

  -- Owner (one of these is set)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,

  -- Access control
  scopes JSONB DEFAULT '[]',
  expires_at TIMESTAMP WITH TIME ZONE,  -- NULL = never expires
  is_revoked BOOLEAN DEFAULT FALSE,

  -- Grace period for rotation
  previous_token_hash TEXT,
  previous_token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0
);
```

## Security Considerations

1. **Hash Storage**: Only SHA-256 hashes are stored, never plaintext
2. **Single Display**: Plaintext is shown once at creation, then never again
3. **Scope Enforcement**: Tokens are validated against required scopes
4. **Grace Period**: Rotated tokens remain valid for 24 hours
5. **Expiry**: Callback tokens auto-expire after 1 hour
6. **Isolation**: Each token type has specific scopes to limit blast radius

## Migration Notes

The unified token system replaced the old per-entity API key columns:
- Removed `apiKeyHash`, `apiKeyPrefix`, `previousApiKeyHash`, `previousApiKeyExpiresAt` from `users` table
- Removed same columns from `agents` table
- All tokens now stored in unified `api_tokens` table

Migrations:
- `0074_optimal_apocalypse.sql` - Create api_tokens table
- `0075_lonely_speed_demon.sql` - Drop old columns
