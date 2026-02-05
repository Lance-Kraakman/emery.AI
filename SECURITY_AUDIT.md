# Security Audit Report - Orchastrate

**Date**: 2026-02-04
**Scope**: Comprehensive OWASP-style code review
**Application**: Next.js 14 + Python gRPC microservices
**Routes Audited**: 26 high-risk API routes + full auth flows, key management, gRPC, RLS

---

## Executive Summary

The application has solid foundational security: NextAuth database sessions with proper cookie flags, Drizzle ORM preventing SQL injection, S3 key path traversal protection, and HMAC-SHA256 webhook verification with timing-safe comparison. However, several critical and high-severity issues were found that should be addressed before production hardening.

**Critical**: 4 | **High**: 15 | **Medium**: 11 | **Low**: 7

---

## PHASE 1: API Route Authentication & Authorization

### Route-by-Route Findings

#### Legend
- Auth: How the route authenticates requests
- Perm: Whether RBAC permission checks are enforced
- OrgIso: Whether organization isolation is properly enforced
- Input: Whether input is validated (Zod, manual checks, etc.)
- ErrSan: Whether error messages are sanitized (no raw error.message to client)
- Audit: Whether mutations are audit-logged

---

### Externally Exposed Routes (API Consumers)

| # | Route | Auth | Perm | OrgIso | Input | ErrSan | Audit | Severity |
|---|-------|------|------|--------|-------|--------|-------|----------|
| 1 | `/api/v1/published/[slug]/task` | pk_ API key | `task:execute` scope | Via published agent | Manual field check | Generic errors | Usage log | OK |
| 2 | `/api/v1/published/[slug]/skills/[skillName]` | pk_ API key | `skill:execute` scope | Via published agent | Accepts empty body | Generic errors | Usage log | OK |
| 3 | `/api/v1/published/[slug]/openapi.json` | **NONE** | **NONE** | N/A | Slug validated | Generic errors | None | **[M-01]** |
| 4 | `/api/webhooks/[agentId]` | Bearer agent key + HMAC | N/A | Via agent | Zod schema | Generic errors | Console log | OK |
| 5 | `/api/webhooks/pipedream/[agentId]/[token]` | Token-in-URL | N/A | Via agent | JSON parse | Generic errors | Console log | **[M-02]** |
| 6 | `/api/webhooks/stripe` | Stripe signature | N/A | Via customer ID | Stripe SDK | Generic errors | Console log | OK |

**[M-01] OpenAPI spec endpoint is fully unauthenticated**
- File: `src/app/api/v1/published/[slug]/openapi.json/route.ts:39-96`
- Sets `Access-Control-Allow-Origin: *` (line 87)
- Exposes skill names, descriptions, input/output schemas for any published agent
- Risk: Information disclosure of agent capabilities to unauthenticated users
- Impact: Low-medium (by design for ChatGPT plugins, but exposes internal skill structure)

**[M-02] Pipedream webhook token in URL path**
- File: `src/app/api/webhooks/pipedream/[agentId]/[token]/route.ts`
- Webhook token passed as URL path parameter, not header
- Risk: Tokens logged in access logs, browser history, CDN logs, referrer headers
- Token comparison uses direct string equality (line 48), not timing-safe comparison

---

### Data-Mutating Routes (User-Facing)

| # | Route | Auth | Perm | OrgIso | Input | ErrSan | Audit | Severity |
|---|-------|------|------|--------|-------|--------|-------|----------|
| 7 | `/api/rows` (CRUD) | `withAuthenticatedRoute` | **NONE** | Implicit RLS | Manual | Via base handler | Via actor override | **[H-01]** |
| 8 | `/api/tables` | `withAuthenticatedRoute` | **NONE** | User's org | Manual | Via base handler | `logAgentMutation` | **[H-01]** |
| 9 | `/api/databases` | `withAuthenticatedRoute` | **NONE** | User's org | Manual | Via base handler | `logAgentMutation` | **[H-01]** |
| 10 | `/api/fields` | `authenticateRequest` | **NONE** | Implicit | Manual | Generic | `logAgentMutation` | **[H-01]** |
| 11 | `/api/files/upload` | `auth()` session | `table:manage` | Param-based | Extensive | Generic | None | **[H-02]** |
| 12 | `/api/files/fetch-external` | `auth()` session | **NONE** | N/A | SSRF checks | Generic | None | **[M-03]** |
| 13 | `/api/files/[fileId]` | `withAuthenticatedRoute` | **NONE** | User's org | Manual | Via base handler | None | **[H-01]** |
| 14 | `/api/files/[fileId]/content` | `withAuthenticatedRoute` | **NONE** | User's org | Manual | Via base handler | None | **[H-01]** |
| 15 | `/api/files/download-url` | `withAuthenticatedRoute` | **NONE** | S3 key validation | S3 key validator | Via base handler | None | OK |
| 16 | `/api/files/stream` | `authenticateRequest` | **NONE** | S3 key validation | S3 key validator | Generic | None | OK |

**[H-01] CRITICAL: Missing RBAC permission checks on core data routes**
- Routes: `/api/rows`, `/api/tables`, `/api/databases`, `/api/fields`, `/api/files/[fileId]`, `/api/files/[fileId]/content`
- All use `withAuthenticatedRoute()` or `authenticateRequest()` which only verifies identity
- **No `requirePermission()` or `hasPermission()` call** for any data operation
- Any authenticated user in an organization can CRUD all data
- Only `/api/files/upload` checks `table:manage` permission (line 22)
- Fix: Add `requirePermission('table:manage')` to all data-mutating routes

**[H-02] Org isolation via request parameter (not validated against session)**
- File: `src/app/api/files/upload/route.ts:32`
- `organizationId` comes from `formData.get('organizationId')` - user-controlled
- Not validated against `session.user.currentOrganizationId`
- Risk: Authenticated user could upload files to a different organization's quota
- Fix: Always use `session.user.currentOrganizationId`, ignore client-provided orgId

**[M-03] External file fetch - SSRF protection is good but has gaps**
- File: `src/app/api/files/fetch-external/route.ts`
- Good: Blocks localhost, private IPs, link-local, internal hostnames
- Good: Validates HTTP/HTTPS only, checks MIME type, enforces size limit
- Gap: DNS rebinding not prevented - hostname checked before fetch, but DNS could resolve to internal IP after check
- Gap: `redirect: 'follow'` allows redirect to internal URLs after initial check passes
- Gap: IPv6 private ranges (fc00::/7, fe80::/10) not blocked
- Fix: Resolve hostname to IP before fetching, check resolved IP, disable redirects or re-validate after redirect

---

### Agent & Task Execution Routes

| # | Route | Auth | Perm | OrgIso | Input | ErrSan | Audit | Severity |
|---|-------|------|------|--------|-------|--------|-------|----------|
| 17 | `/api/agents` (POST/GET) | `authenticateRequest` | **NONE** | User's org | Manual | **Raw error.message** | `logAgentMutation` | **[H-03]** |
| 18 | `/api/agents/[id]` (GET/PUT/DELETE) | `withAuthenticatedRoute` | **NONE** | Implicit | Manual | Via base handler | `logAgentMutation` | **[H-01]** |
| 19 | `/api/agents/[id]/execute` | `authenticateRequest` | Owner check | Owner's org | Manual | Generic | Console log | **[H-04]** |
| 20 | `/api/tasks` (GET/POST) | `authenticateRequest` | **NONE** | User's org | Manual | Generic | None | **[H-01]** |
| 21 | `/api/chat/stream-grpc` | `auth()` session | **NONE** | User's org | Extensive | Generic | Yes (on complete) | **[H-05]** |

**[H-03] Raw error.message leaked to client**
- File: `src/app/api/agents/route.ts:87`
- `error: error instanceof Error ? error.message : 'Internal server error'`
- Database errors, stack traces, and internal paths can reach the client
- Also found in: `/api/connections/proxy:133`, `/api/admin/enterprises:231`
- Fix: Always return generic message, log detailed error server-side

**[H-04] Agent execute webhook sends to user-controlled URL**
- File: `src/app/api/agents/[id]/execute/route.ts:127-157`
- `webhook_url` from request body, no validation of the URL
- SSRF risk: Can send POST requests to internal services from the server
- No allowlist, no private IP blocking (unlike `/api/files/fetch-external`)
- Fix: Apply same SSRF protections as `fetch-external` route, or require pre-registered webhook URLs

**[H-05] Chat stream has 100+ console.log statements**
- File: `src/app/api/chat/stream-grpc/route.ts`
- Logs user IDs, org IDs, tool configs, S3 keys, attachment details, model selections
- Server-side logs, but exposed in monitoring/log aggregation systems
- Fix: Remove or gate behind `process.env.NODE_ENV === 'development'`

---

### Admin & Sensitive Routes

| # | Route | Auth | Perm | OrgIso | Input | ErrSan | Audit | Severity |
|---|-------|------|------|--------|-------|--------|-------|----------|
| 24 | `/api/admin/enterprises` | `auth()` + email whitelist | **Email-based** | **NONE** | Manual | **Raw details** | Console log | **[C-01]** |
| 25 | `/api/connections/proxy` | API key (user or agent) | **NONE** | Via key lookup | Manual | **Raw error.message** | Extensive console.log | **[H-06]** |
| 26 | `/api/auth/device/verify` | None (by design) | N/A | N/A | Code validation | Generic | Console log | **[M-04]** |

**[C-01] CRITICAL: Admin endpoint uses email whitelist instead of RBAC**
- File: `src/app/api/admin/enterprises/route.ts:22-27`
- Admin check is `ADMIN_EMAILS` env var - hardcoded email list
- No RBAC permission check, no org isolation
- GET returns ALL organizations' billing data across the entire platform
- POST can modify ANY organization's plan, create Stripe subscriptions
- Error response leaks `error.message` details (line 231)
- Fix: Migrate to RBAC-based admin permission, add audit logging, restrict org scope

**[H-06] OAuth proxy logs sensitive data and leaks error details**
- File: `src/app/api/connections/proxy/route.ts`
- 20+ console.log statements including user emails (line 64), user IDs, API key modes
- Raw `error.message` returned to client (line 133) and `error.stack` logged (line 130)
- Fix: Remove verbose logging, sanitize error responses

**[M-04] Device flow verify endpoint has no rate limiting**
- File: `src/app/api/auth/device/verify/route.ts`
- Polled by Tauri client with device code in query param
- No rate limiting on polling (could be brute-forced)
- Code validation exists (`isValidDeviceCode`), but entropy not verified here
- Fix: Add per-IP rate limiting, increase code length/entropy

---

### `handleApiError` in base.ts leaks error messages
- File: `src/lib/api/base.ts:46`
- `const message = error instanceof Error ? error.message : 'Internal server error'`
- This is the fallback error handler for ALL routes using `withAuthenticatedRoute`
- Any unhandled exception's message is returned to the client
- Fix: Always return 'Internal server error', log the actual message

---

### `fields` GET endpoint lacks auth-first pattern (intentional but inconsistent)
- File: `src/app/api/fields/route.ts:80-104`
- GET handler does NOT call `authenticateRequest()` - only POST and DELETE do
- **Context**: This is semi-intentional - the app has public views (`requires_auth = false`) that need field schemas. The `getFields()` server action in `src/app/actions/fields.ts` properly implements an auth-first pattern: authenticated users get full access via RBAC, unauthenticated users only get fields via `viaViewId` + `getPublicViewSchema()`
- **Defense-in-depth**: An RLS policy `fields_public_via_view` in `schema.ts:254-266` restricts unauthenticated SELECTs to tables that have at least one public view
- **Issue**: The API endpoint bypasses the server action's auth-first pattern and calls `getFieldsForTable()` directly, making it more permissive than intended
- Fix: Delegate to the `getFields()` server action, or replicate its auth-first pattern with `viaViewId` validation

---

## PHASE 2: API Key & Secrets Management

### Key Type Comparison

| Key Type | Entropy | Storage | Validation | Timing-Safe | Rotation | Revocation |
|----------|---------|---------|------------|-------------|----------|------------|
| User API (`user_*`) | 192 bits | Plaintext | `eq()` in DB | No | Regenerate (hard delete) | Set to `null` |
| Agent API (`key_*`) | 128 bits | Plaintext | `===` comparison | No | Regenerate (replace) | No |
| Webhook Token (UUID) | 128 bits | Plaintext | `!==` comparison | No | No | No |
| Published Agent (`pk_live_*`) | 256 bits | SHA-256 hash | Hash-then-lookup | No | Multiple keys | Soft revoke (`isRevoked`) |
| OAuth Tokens | Provider | **Plaintext** | N/A | N/A | Provider-based | N/A |
| OAuth Client Secret | N/A | SHA-256 hash | Unknown | Unknown | Unknown | Unknown |
| Invitation Token | 128 bits | Plaintext | `===` comparison | No | Single-use | TTL-based (7d) |

### [C-02] User API keys stored in plaintext
- File: `src/lib/auth/user-api-keys.ts`
- Generation: `crypto.randomBytes(24).toString('hex')` (192-bit entropy - good)
- Storage: Plaintext in `users.apiKey` column (unique constraint)
- Validation: Direct DB lookup `WHERE eq(users.apiKey, apiKey)` - no timing protection
- Rotation: `assignApiKeyToUser()` generates new key but **hard-deletes old key immediately** - clients in-flight get 401
- Risk: Database compromise exposes all user API keys immediately
- Fix: Store SHA-256 hash, show key only once (published agent key pattern)

### [C-03] Agent API keys stored in plaintext
- File: `src/ddd/domain/shared/value-objects/api-key.ts`
- Generation: `randomBytes(16).toString('hex')` (128-bit entropy - lower than user keys)
- Storage: Plaintext in `agents.apiKey` column, auto-generated via `$defaultFn` in schema
- Validation: `ApiKey.matches()` uses `this._value === value` (line 79-81) - simple `===`
- Rotation: `regenerateApiKey()` in AgentApplicationService - immediate replacement, no grace period
- Fix: Hash on storage, increase entropy to 256-bit to match published keys

### [C-04] OAuth tokens stored in plaintext
- Database: `accounts` table (schema.ts lines 1301-1317)
- `refresh_token`, `access_token`, `id_token` all stored as plaintext text columns
- These are GitHub and Google OAuth tokens
- Note: OAuth **client secrets** ARE hashed (`clientSecretHash` column) - inconsistent protection
- Risk: DB compromise = full access to users' GitHub/Google accounts
- Fix: Implement application-level AES-256-GCM encryption with envelope encryption (KMS DEK/KEK)

### [H-07] Webhook tokens not timing-safe compared
- File: `src/app/api/webhooks/pipedream/[agentId]/[token]/route.ts:48`
- `agent.webhookToken !== token` - direct string comparison
- Webhook tokens are also stored plaintext (UUID format, `randomUUID()`)
- Token in URL path means it's logged in access logs, CDN logs, referer headers
- Fix: Use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`; move token to Authorization header

### [H-08] Agent API key comparison not timing-safe
- File: `src/app/api/webhooks/[agentId]/route.ts:63`
- `agent.apiKey.value !== apiKey` - direct string comparison
- Fix: Use `crypto.timingSafeEqual`

### [H-09] No key rotation grace period for any key type
- User keys: Old key hard-deleted immediately (`apiKey: null`)
- Agent keys: Old key replaced immediately with new `ApiKey.generate()`
- No support for concurrent valid keys (except published agent keys which support multiple)
- Risk: Clients in-flight get 401 errors during key rotation, cascading failures
- Fix: Support deprecated keys with auto-revoke after grace period (24-72 hours)

### Published agent keys - reference implementation
- SHA-256 hash stored in DB, key shown once at creation
- Generation: `randomBytes(32).toString('base64url')` = 256-bit entropy (best in codebase)
- Scopes: Fine-grained (`task:execute`, `skill:execute`)
- Expiration: `expiresAt` timestamp with validation
- Revocation: Soft revoke (`isRevoked = true`, kept in DB for audit)
- Usage tracking: `lastUsedAt` + `usageCount` (fire-and-forget, non-blocking)
- Multiple keys per agent supported (enables rotation)
- This is the model to follow for user and agent keys

### Invitation tokens - acceptable
- File: `src/ddd/domain/invitations/entities/invitation.ts`
- Generation: `randomBytes(16).toString('hex')` (128-bit)
- TTL: Default 7 days, max 30 days
- Single-use: Consumed on acceptance
- Plaintext storage acceptable given short TTL and single-use nature
- No timing-safe comparison (low risk given single-use)

---

## PHASE 3: Client-Side Security

### [H-05] Excessive console.log across codebase (repeated from above)

**Server-side API routes (visible in logs/monitoring):**
| File | Approx count | Sensitive data logged |
|------|-------------|---------------------|
| `src/app/api/chat/stream-grpc/route.ts` | 100+ | User IDs, org IDs, tool configs, S3 keys, models |
| `src/app/api/connections/proxy/route.ts` | 20+ | User emails, user IDs, API key modes |
| `src/app/api/agents/[id]/execute/route.ts` | 5+ | Agent IDs, user IDs, execution details |
| `src/app/api/webhooks/pipedream/...` | 10+ | Agent IDs, automation details, task IDs |

**Client-side (visible in browser DevTools):**
| File | Approx count | Sensitive data logged |
|------|-------------|---------------------|
| `src/components/shared/tiptap-extensions/FileUploadHandler.ts` | 40+ | Upload details, file metadata |
| `src/components/shared/tiptap-extensions/upload-service.ts` | 10+ | Upload progress, file info |
| `src/lib/cache/cache-service.ts` | 12+ | Cache operations, data keys |
| `src/lib/auth/with-context.ts` | 5+ | RLS context, organization IDs |
| `src/components/chat/utils/smart-suggestions.ts` | 3+ | User behavior patterns |
| `src/components/chat/useChatGRPC.tsx` | 3+ | Chat state |

### [M-05] Error messages leak implementation details to client
Routes that return raw `error.message`:
1. `src/app/api/agents/route.ts:87` - `error instanceof Error ? error.message`
2. `src/app/api/connections/proxy/route.ts:133` - `error.message`
3. `src/app/api/admin/enterprises/route.ts:231` - `error.message`
4. `src/lib/api/base.ts:46` - `handleApiError()` returns `error.message` (affects ALL routes using `withAuthenticatedRoute`)
5. `src/app/api/files/fetch-external/route.ts:129` - Includes upstream HTTP status in error

### [M-06] XSS vector via dangerouslySetInnerHTML
- File: `src/components/chat/artifacts/OfficeViewer.tsx:183`
- `dangerouslySetInnerHTML={{ __html: htmlContent }}`
- HTML generated by Mammoth.js from DOCX conversion
- Risk: If a malicious DOCX is processed, arbitrary HTML/JS could execute
- Fix: Sanitize with DOMPurify before rendering

### [M-07] Sensitive data in localStorage
- `src/components/chat/useChatGRPC.tsx` - Chat messages as fallback
- `src/hooks/useDeviceFlow.ts` - Device flow auth codes
- `src/components/chat/utils/smart-suggestions.ts` - User behavior patterns
- Not cleared on logout (no cleanup handler found)
- Fix: Clear on sign-out, consider encrypting sensitive items

### [M-08] Missing Content-Security-Policy header
- `next.config.js` has good headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Missing**: Content-Security-Policy (CSP) - main defense against XSS
- **Missing**: Strict-Transport-Security (HSTS) - enforce HTTPS
- Fix: Add CSP that restricts script-src, style-src, connect-src; add HSTS with max-age

---

## PHASE 4: Authentication Flows

### Session management - Good foundations
- Database session strategy (not JWT in cookies) - `strategy: "database"` in `src/lib/auth.ts:236`
- HTTPOnly, Secure, SameSite=Lax cookies (lines 238-266)
- 30-day maxAge on session cookie (device flow verify, line 43)
- Sessions stored in PostgreSQL `sessions` table with server-side validation

### [H-10] OAuth callback URL validation has open redirect bypass
- File: `src/lib/auth.ts` (redirect callback, lines 209-229)
- Validates same-origin via `new URL(url).origin === baseUrl`
- Fallback: `url.includes('/public/')` - **too broad, allows `https://evil.com/public/`**
- Attack: Attacker crafts redirect URL containing `/public/` in path, bypasses origin check
- Fix: Remove `includes('/public/')` fallback; validate parsed URL origin strictly

### [H-11] Sessions not cascade-deleted on user deletion
- Schema: `sessions` table has `userId` FK but no `onDelete: "cascade"` visible in sessions table def
- When a user is deleted, their sessions remain valid until TTL expires
- No server-side mechanism to revoke all sessions for a user
- Fix: Add cascade delete to sessions.userId FK; implement explicit session cleanup on user delete

### [H-12] Silent cross-provider account linking (no user consent)
- File: `src/lib/auth.ts` (signIn callback, lines 181-208)
- NextAuth auto-links GitHub and Google accounts by matching email
- No confirmation/approval step when new provider links to existing account
- Risk: If attacker controls GitHub account with victim's email, gains access to victim's account
- Fix: Require explicit user consent for account linking; verify email ownership

### [M-04] Device flow - No polling rate limit (repeated)
- Code entropy is good (256-bit, Redis with 5-min TTL, one-time use via atomic GET+DEL)
- But no rate limiting on the verify polling endpoint
- Real concern: DoS via rapid polling (brute force infeasible with 256-bit entropy)

### [L-01] Test session endpoint exposed
- File: `src/app/api/auth/test-session/route.ts`
- Returns `authenticated`, `user.id`, `user.email`, `user.currentOrganizationId`
- Should be disabled or restricted in production

### Session data exposed to client (via session callback)
- User ID, email, currentOrganizationId, all available orgs, account flags
- Excessive data increases attack surface but mitigated by HTTPOnly cookie

---

## PHASE 5: Webhook & External Integrations

### Agent webhook - Well implemented
- Multi-layer: Bearer token + HMAC-SHA256 + origin validation
- `crypto.timingSafeEqual` for HMAC comparison (line 140-143)
- Zod schema validation for payload
- Only gap: agent API key comparison not timing-safe (covered in [H-08])

### [H-04] SSRF in agent execute webhook (repeated)
- User-controlled `webhook_url` with no validation
- Server makes outbound POST to arbitrary URL

### [M-03] SSRF gaps in external file fetch (repeated)
- DNS rebinding, redirect following, missing IPv6 ranges

### Stripe webhook - Well implemented
- Proper signature verification via `stripe.webhooks.constructEvent()`
- Idempotency checks for invoice processing
- No raw body exposure

---

## PHASE 6: gRPC & Backend Security

### gRPC TLS: mTLS planned (see mTLS plan)
- All 3 Node.js clients use `createInsecure()`, both Python servers use `add_insecure_port()`
- gRPC crosses ECS container boundaries (Frontend ECS -> agent-chat/agent-table ECS via Cloud Map DNS)
- Data in transit: User API keys, user IDs, full conversation history, tool configs
- **mTLS implementation planned** - always-on TLS, fail if certs missing

### [H-13] gRPC session retrieval doesn't validate organization ID
- File: `emery-agents/src/emery_agents/services/context/session_manager.py:195`
- `get_agent(session_id)` looks up by session_id ONLY, no org_id validation
- Session IDs default to `f"{org_id}_{user_id}"` format (collision unlikely)
- But if client explicitly provides `sessionId` parameter, no org isolation enforced
- Risk: If attacker guesses/knows another org's session ID, could retrieve their agent state
- Fix: Add `(session_id, organization_id)` tuple validation in session retrieval

### [M-09] No explicit gRPC message size limits on chat server
- File: `emery-agents/src/emery_agents/grpc/server.py:275-286`
- No `grpc.max_receive_message_length` or `grpc.max_send_message_length` set
- Default is 4MB receive, unlimited send
- Table client sets explicit 4MB limits (`table-grpc-client.ts:62-63`) - inconsistent
- Risk: Large conversation histories could consume memory (mitigated by VPC-only access)
- Fix: Add explicit `('grpc.max_receive_message_length', 10 * 1024 * 1024)` (10MB) to both servers

### [M-10] Python credentials stored in memory without time-scoping
- File: `emery-agents/src/emery_agents/services/credentials.py:24-41`
- `ResolvedCredentials` dataclass holds plaintext `api_key` in memory
- Agent sessions persist in memory between messages (`session_manager.agents` dict)
- Plan sessions store API keys in-memory for clarification Q&A flow
- Sessions cleaned by timeout only (1800s idle, 14400s max)
- Fix: Implement credential cleanup on request completion; don't store API keys in plan sessions

### Shared Python process model (architectural note)
- All organizations share single Python process per gRPC server
- Tool providers are created per-request with org scoping (good)
- Agent sessions keyed by session_id containing org_id (partially mitigates)
- True isolation would require per-org worker processes (longer-term)

### Sandbox for tool execution (good)
- Bubblewrap sandbox for bash/command execution tools
- Empty namespace with read-only system mounts
- No network by default, proxy filters private IPs when enabled
- Per-agent workspace isolation
- Limitation: Python-native tools (DSPy, skills) run in main process, not sandboxed

---

## PHASE 7: Database & Data Access

### Drizzle ORM - Safe from SQL injection
- All queries use parameterized Drizzle `sql` template literals
- No raw SQL string interpolation found anywhere in codebase
- Migrations use parameterized postgres client (expected to bypass RLS)

### S3 key validation - Well implemented
- File: `src/lib/security/s3-key-validator.ts`
- Blocks path traversal (`..`, `%2e`, `%2f`, null bytes)
- Validates org ownership via key prefix

### RLS coverage - Strong with gaps
- **40+ tables with RLS policies** including tenant isolation, permission checks, public access
- Strong: databases, tables, fields, views, agents, skills, tasks, users, teams all have multi-policy RLS
- Public access is opt-in via `requires_auth = false` or `is_public = true` flags
- **Gaps**: System tables (`permissions`, `rolePermissions`, `appTypes`, `tools`) have NO RLS - intentional for system reference data but allows authenticated users to enumerate all permissions/tools

### [H-14] RLS context proxy silently falls back to no-RLS on failure
- File: `src/ddd/infrastructure/db/simple-context-proxy.ts:42-58`
- If query rebuilding fails, proxy logs a warning and executes the original query WITHOUT RLS context
- Risk: Queries silently bypass RLS if context setup has any error
- Fix: Fail fast - throw error instead of fallback to unprotected query

### [H-15] withAuthContext proceeds without RLS context on failure
- File: `src/lib/auth/with-context.ts:40-42`
- If `session.user.id` or `session.user.currentOrganizationId` is missing, logs warning but continues
- Operation executes WITHOUT RLS protection
- Fix: Throw error instead of warning when RLS context cannot be established

### [L-02] Actor override mechanism lacks validation
- File: `src/lib/api/agent-context.ts`
- Agent headers (`X-Agent-ID`, `X-Agent-Name`, `X-Trigger-Type`, etc.) trusted from HTTP headers
- Any authenticated user could set these headers to impersonate an agent in audit logs
- No validation that X-Agent-ID belongs to the authenticated user's organization
- Fix: Validate agent belongs to authenticated user's org before accepting override

### [L-06] In-memory context manager may be thread-unsafe
- File: `src/ddd/infrastructure/db/context-manager.ts`
- Global singleton stores context as `this.context: ContextData | null`
- In concurrent Next.js request handling, context could leak between async operations
- Fix: Use `AsyncLocalStorage` for request-scoped context isolation

### Field-level public access is table-level (architectural note)
- RLS policy `fields_public_via_view` grants SELECT on ALL fields if ANY view on the table is public
- Cannot restrict public access to specific fields per-view
- This is a design trade-off, not a bug - but should be documented for users

---

## Findings Summary (Sorted by Severity)

### CRITICAL (Fix Immediately)

| ID | Finding | File(s) | Risk |
|----|---------|---------|------|
| C-01 | Admin endpoint: email whitelist, no RBAC, no org isolation | `api/admin/enterprises/route.ts` | Any admin email can access/modify all orgs |
| C-02 | User API keys stored plaintext in DB | `lib/auth/user-api-keys.ts`, `schema.ts` | DB compromise exposes all keys |
| C-03 | Agent API keys stored plaintext in DB | `domain/shared/value-objects/api-key.ts` | DB compromise exposes all keys |
| C-04 | OAuth refresh/access tokens stored plaintext | `schema.ts:1301-1317` | DB compromise = access to users' GitHub/Google |

### HIGH (Fix Before Production)

| ID | Finding | File(s) | Risk |
|----|---------|---------|------|
| H-01 | Missing RBAC permission checks on 8+ data routes | `api/rows`, `api/tables`, `api/databases`, `api/fields`, `api/files/[fileId]`, `api/agents/[id]`, `api/tasks` | Any org user can perform any data operation |
| H-02 | Org isolation via user-controlled parameter | `api/files/upload/route.ts:32` | Cross-org data access |
| H-03 | Raw error.message leaked to clients | `api/agents`, `api/connections/proxy`, `api/admin`, `lib/api/base.ts` | Information disclosure |
| H-04 | SSRF via user-controlled webhook_url | `api/agents/[id]/execute/route.ts:127` | Server-side request to internal services |
| H-05 | 100+ console.log with sensitive data | `api/chat/stream-grpc`, `api/connections/proxy`, client components | Information leakage in logs and browser |
| H-06 | OAuth proxy verbose logging + error leaking | `api/connections/proxy/route.ts` | Emails, IDs, stack traces in logs |
| H-07 | Webhook token timing-unsafe comparison | `api/webhooks/pipedream/.../route.ts:48` | Timing attack (low practical risk) |
| H-08 | Agent API key timing-unsafe comparison | `api/webhooks/[agentId]/route.ts:63` | Timing attack (low practical risk) |
| H-09 | No key rotation grace period (hard-delete old key) | `user-api-keys.ts`, `api-key.ts` | Clients in-flight get 401 during rotation |
| H-10 | OAuth callback URL validation bypass via `/public/` | `lib/auth.ts:209-229` | Open redirect to attacker-controlled URL |
| H-11 | Sessions not cascade-deleted on user deletion | `schema.ts` sessions table | Deleted user sessions remain valid until TTL |
| H-12 | Silent cross-provider account linking | `lib/auth.ts:181-208` | Attacker with victim's email can link accounts |
| H-13 | gRPC session retrieval doesn't validate org ID | `session_manager.py:195` | Cross-org session data leakage |
| H-14 | RLS context proxy silently falls back to no-RLS | `simple-context-proxy.ts:42-58` | Queries bypass RLS on failure |
| H-15 | withAuthContext proceeds without RLS on failure | `with-context.ts:40-42` | Operations run without data isolation |
| -- | Fields GET bypasses auth-first pattern (RLS mitigates) | `api/fields/route.ts:80-104` | Schema over-exposure vs server action |

### MEDIUM

| ID | Finding | File(s) | Risk |
|----|---------|---------|------|
| M-01 | OpenAPI spec unauthenticated + CORS * | `api/v1/published/[slug]/openapi.json` | Skill/capability disclosure |
| M-02 | Pipedream webhook token in URL path | `api/webhooks/pipedream/...` | Token in logs/referrers |
| M-03 | SSRF gaps in external fetch (DNS rebind, redirects, IPv6) | `api/files/fetch-external/route.ts` | SSRF bypass via DNS rebinding |
| M-04 | Device flow verify: no rate limiting | `api/auth/device/verify/route.ts` | DoS via rapid polling |
| M-05 | Error messages leak implementation details | Multiple routes | Information disclosure |
| M-06 | XSS via dangerouslySetInnerHTML | `components/chat/artifacts/OfficeViewer.tsx` | Script injection via malicious DOCX |
| M-07 | Sensitive data in localStorage, not cleared on logout | `useChatGRPC`, `useDeviceFlow`, `smart-suggestions` | Data exposure if XSS achieved |
| M-08 | Missing CSP and HSTS headers | `next.config.js` | Reduced XSS/downgrade protection |
| M-09 | No explicit gRPC message size limits on chat server | `server.py:275-286` | Memory exhaustion (VPC-mitigated) |
| M-10 | Python credentials not time-scoped in memory | `credentials.py`, `session_manager.py` | Credential persistence between requests |
| -- | `tables` route accepts arbitrary `organizationId` param | `api/tables/route.ts:33` | Cross-org table creation |

### LOW

| ID | Finding | File(s) |
|----|---------|---------|
| L-01 | Test session endpoint exposed in production | `api/auth/test-session/route.ts` |
| L-02 | Actor override headers trusted without validation | `lib/api/agent-context.ts` |
| L-03 | No API key rotation mechanism for user/agent keys | - |
| L-04 | No application-level rate limiting (WAF only) | - |
| L-05 | Agent key entropy (128-bit) lower than published key (256-bit) | `api-key.ts` |
| L-06 | In-memory context manager may be thread-unsafe | `context-manager.ts` |
| L-07 | System tables (permissions, appTypes, tools) have no RLS | `schema.ts` |

---

## Remediation Priority

### Tier 1: Critical (Immediate)
1. **Hash user API keys** - Add `apiKeyHash` column, migrate to SHA-256 lookup, show key once
2. **Hash agent API keys** - Same pattern as above
3. **Encrypt OAuth tokens** - Add AES-256-GCM encryption layer for accounts table
4. **Fix admin endpoint** - Migrate to RBAC, add org isolation, add audit logging
5. **Fix fields GET auth pattern** - Delegate to `getFields()` server action or replicate auth-first logic

### Tier 2: High (Before Production)
1. **Add permission checks to data routes** - Add `requirePermission('table:manage')` to rows, tables, databases, fields, files
2. **Validate organizationId from session** - Never trust client-provided orgId
3. **Sanitize all error responses** - Return generic messages, log details server-side
4. **Fix SSRF in agent execute** - Add URL validation/allowlist for webhook_url
5. **Clean up console.log** - Remove or gate behind NODE_ENV check
6. **Fix OAuth callback open redirect** - Remove `url.includes('/public/')` fallback in redirect callback
7. **Add cascade delete to sessions on user delete** - Ensure sessions cleaned up
8. **Fix RLS context fallback** - Throw error in `simple-context-proxy.ts` instead of silent fallback
9. **Fix withAuthContext** - Throw error instead of warning when context missing
10. **Fix gRPC session isolation** - Validate `(session_id, organization_id)` tuple on retrieval
11. **Add mTLS to gRPC** - See mTLS implementation plan

### Tier 3: Medium (Security Hardening)
1. **Add CSP and HSTS headers** to next.config.js
2. **Add DOMPurify** for HTML rendering in OfficeViewer
3. **Clear localStorage on logout**
4. **Fix SSRF gaps** in external file fetch (DNS rebinding, IPv6, redirect validation)
5. **Move webhook token to header** for Pipedream integration
6. **Add rate limiting** to device flow verify endpoint
7. **Use timing-safe comparison** for all token/key comparisons
8. **Add gRPC message size limits** to chat and table servers
9. **Add credential cleanup** to Python service on request completion

### Tier 4: Low (Ongoing)
1. Disable test session endpoint in production
2. Validate actor override headers against trusted sources (check agent belongs to user's org)
3. Implement API key rotation UX with grace period
4. Add application-level rate limiting
5. Increase agent key entropy to 256-bit
6. Use AsyncLocalStorage for request-scoped context manager
7. Add authentication-only RLS to system tables (permissions, appTypes, tools)
