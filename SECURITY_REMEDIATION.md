# Security Remediation Progress

**Audit**: See `SECURITY_AUDIT.md` for full findings.
**Started**: 2026-02-04

---

## Phase 1: Quick Security Hardening [COMPLETE]

Small, targeted fixes (1-10 lines each) that reduce risk immediately.

- [x] **1a** H-03: Sanitize `handleApiError` in `src/lib/api/base.ts` — stop returning `error.message` to clients
- [x] **1b** H-03: Sanitize catch block in `src/app/api/agents/route.ts`
- [x] **1c** H-03/H-06: Sanitize catch block in `src/app/api/connections/proxy/route.ts`, remove stack trace log
- [x] **1d** H-03: Remove `details` field from `src/app/api/admin/enterprises/route.ts`
- [x] **1e** H-14: Fix RLS context proxy silent fallback in `src/ddd/infrastructure/db/simple-context-proxy.ts`
- [x] **1f** H-15: Fix `withAuthContext` proceeding without context in `src/lib/auth/with-context.ts`
- [x] **1g** H-10: Fix OAuth callback open redirect in `src/lib/auth.ts` (removed dead code — same-origin check already handles it)

Code quality follow-up:
- [x] Extracted `replayQuerySteps` function with `QueryStep` type in `simple-context-proxy.ts`
- [x] Removed redundant `/public/` redirect block in `auth.ts`

---

## Phase 2: Session & gRPC Isolation [COMPLETE]

- [x] H-11: ~~Add cascade delete to sessions~~ — **Already configured** (`onDelete: "cascade"` at `schema.ts:1321`)
- [x] H-13: Validate `(session_id, organization_id)` in `session_manager.py:get_agent()` — returns `None` on org mismatch. Updated call site in `agent_streaming.py:158`

---

## Phase 3: RBAC Permission Checks on Data Routes [COMPLETE]

- [x] H-01: Add `hasPermission()` checks to API routes using existing RBAC infrastructure:
  - `/api/tables` — `table:create` (POST), `table:view` (GET)
  - `/api/tables/[id]` — `table:view` (GET), `table:manage` (PUT, DELETE) — **resource-specific** via `hasResourcePermission`
  - `/api/databases` — `database:create` (POST), `database:view` (GET)
  - `/api/databases/[id]` — `database:view` (GET), `database:manage` (PUT, DELETE) — **resource-specific** via `hasResourcePermission`
  - `/api/fields` — `table:manage` (POST, DELETE), `table:view` (GET) + **added missing auth to GET** — **resource-specific** via `hasResourcePermission` with `tables` + tableId
  - `/api/files/[fileId]` — `table:view` (GET), `table:manage` (PUT, DELETE) — **resource-specific** via `hasResourcePermission` with `tables` + tableId
  - `/api/agents/[id]` — `agents:view` (GET), `agents:manage` (PUT, DELETE) — **resource-specific** via `hasResourcePermission`
  - `/api/tasks` — `tasks:view` (GET org-level), `tasks:create` (POST) — **resource-specific** via `hasResourcePermission` with `agent` + agentId
  - `/api/rows` — already covered by server action `requirePermission("table:manage")` delegation
- [x] H-02: Replace client-provided `organizationId` with `user.organizationId` from session in `/api/tables` POST

New shared utilities:
- `hasResourcePermission()` in `src/lib/auth.ts` — resource-specific permission check backed by PostgreSQL `user_has_permission()` function (supports `all`, `specific`, `owned`, `team` scopes)

Follow-up TODOs:
- [x] Audit system scheduler for backdoors — **No backdoors found.** 12 findings (2 HIGH, 5 MEDIUM, 4 LOW, 1 INFO). See Phase 11.
- [x] Revisit resource-specific permissions — verified `user_has_permission()` PostgreSQL function: global permissions (`resource_type IS NULL`) pass unconditionally, resource-specific scoping only activates for custom roles with explicit `resourceType`/`resourceScope`. System roles seeded with NULL resource_type are backwards-compatible.
- [x] Analyze org-level routes for resource-specific upgrade — upgraded all routes:
  - `/api/fields` — `hasResourcePermission(..., 'tables', tableId)` for all 3 methods
  - `/api/files/[fileId]` — `hasResourcePermission(..., 'tables', tableId)` for all 3 methods
  - `/api/tasks` POST — `hasResourcePermission(..., 'agent', agentId)`; GET stays org-level (lists all org tasks)

---

## Phase 4: Console.log Cleanup [COMPLETE]

- [x] H-05: Sanitize 2 security-critical console.logs in `api/chat/stream-grpc/route.ts`:
  - Removed `userId` and `userEmail` from session status log (line 97)
  - Replaced full tools JSON dump with tool names only (line 176)
  - ~60 remaining logs are legitimate operational logs (auth failures, quota checks, gRPC milestones, errors)
- [x] H-06: Remove 18 verbose console.logs from `api/connections/proxy/route.ts` (was leaking user IDs, emails, API key modes)
- Client-side console.logs (FileUploadHandler, upload-service, cache-service) reviewed — no security issues, all operational

---

## Phase 5: SSRF Fixes [COMPLETE]

- [x] H-04: Add `validateOutboundUrl()` to `agents/[id]/execute/route.ts` — blocks private IPs, internal hostnames before webhook fetch
- [x] M-03: Fix SSRF in `api/files/fetch-external`:
  - Extracted `isPrivateUrl` to shared `src/lib/security/url-validator.ts` (adds IPv6 private ranges: `fc00::/7`, `fe80::/10`)
  - Changed `redirect: 'follow'` to `redirect: 'manual'` with safe redirect validation
  - Extracted `validateAndReturnImage` function for image pipeline

New shared utilities:
- `src/lib/security/url-validator.ts` — `isPrivateUrl()`, `validateOutboundUrl()`

---

## Phase 6: API Key Hashing (DB Migration) [COMPLETE]

- [x] C-02: Hash user API keys (SHA-256, show once) — `ensureFreshUserApiKey()` generates plaintext, stores hash
- [x] C-03: Hash agent API keys (SHA-256, show once) — `ensureFreshAgentApiKey()` generates plaintext, stores hash
- [x] H-09: Add key rotation grace period — 24h `previousApiKeyHash` for both users and agents

DB migration (`0068_sad_giant_girl.sql`):
- Added `apiKeyHash`, `apiKeyPrefix`, `previousApiKeyHash`, `previousApiKeyExpiresAt` to users + agents tables
- `findByApiKey()` checks both current and grace-period hashes

Credential flow fixes (post-hashing):
- [x] Fix double-hash bug in `grpc-agent-execution-repository.ts` — `agent.apiKey?.value` returned hash, now uses `ensureFreshAgentApiKey()`
- [x] Add `user_api_key` field to TaskRequest proto (field 19) — carries agent key to Python ToolProvider for scheduled tasks
- [x] Fix skill execution-config endpoint returning hash — now calls `ensureFreshAgentApiKey()`
- [x] Fix agent execution-config endpoint missing `agentApiKey` — now returns fresh key for @agent mention routing
- [x] Fix PipedreamTool `api_key_mode` auto-detection from key prefix (`key_` → agent, `user_` → user)
- [x] Fix loader not injecting `api_key_mode` into enhanced tool config
- [x] Remove dead `enrichToolsWithUserAuth()` code

New shared utilities:
- `src/lib/auth/agent-api-keys.ts` — `ensureFreshAgentApiKey(agentId)` (mirrors user variant)
- `src/lib/auth/user-api-keys.ts` — `ensureFreshUserApiKey(userId)`

---

## Phase 7: OAuth Token Encryption

- [ ] C-04: AES-256-GCM encryption for OAuth tokens in `accounts` table (KMS integration)

---

## Phase 8: Admin Endpoint RBAC

- [ ] C-01: Migrate admin endpoint from email whitelist to RBAC
- [ ] Add org scoping and audit logging to admin routes

---

## Phase 9: mTLS for gRPC

- [ ] Replace `createInsecure()` with TLS credentials in all 3 Node.js clients
- [ ] Replace `add_insecure_port()` with `add_secure_port()` in both Python servers
- [ ] Add cert generation to infrastructure/deployment
- [ ] Fail if cert env vars missing (no toggle)

---

## Phase 10: Security Headers & Client-Side [COMPLETE]

- [x] M-08: Add CSP and HSTS headers to `next.config.js` (both default and preview iframe routes)
- [x] M-06: Add DOMPurify sanitization for OfficeViewer HTML rendering (`dangerouslySetInnerHTML`)
- [x] M-07: Clear localStorage on logout — created `src/lib/auth/sign-out.ts` with `secureSignOut()`, updated all 4 signOut call sites (UserMenu, app-sidebar, SignOutBlock, resolve-link-action)
- [x] H-07: Timing-safe comparison for Pipedream webhook token in `webhooks/pipedream/[agentId]/[token]/route.ts` (both POST and GET)
- [x] H-08: Timing-safe comparison for agent API key in `webhooks/[agentId]/route.ts`

New shared utilities:
- `src/lib/security/timing-safe.ts` — `timingSafeEqual()` (SHA-256 hash normalization for constant-time comparison)
- `src/lib/auth/sign-out.ts` — `secureSignOut()` (localStorage.clear + signOut)

---

## Phase 11: Scheduler Security Audit [COMPLETE]

Audit of `src/scripts/run-scheduler.ts` and scheduling code for privilege escalation or bypass paths.

**Verdict: No backdoors found.** 12 findings identified (2 HIGH, 5 MEDIUM, 4 LOW, 1 INFO).

### HIGH — Fixed

- [x] H-1: RLS `get_current_organization_id()` defaulted to Org 1 when session var unset (fail-open). Fixed: returns `NULL` (fail-closed, matches no rows). Migration `0069_fix-rls-fallback-and-security-definer.sql`.
- [x] H-2: Context manager used global mutable singleton — not async-safe, concurrent scheduler iterations could overwrite each other's org context. Fixed: replaced with `AsyncLocalStorage` in `context-manager.ts`.

### MEDIUM — Fixed

- [x] M-1: `ensureFreshAgentApiKey` bypassed RLS with no org verification. Added `expectedOrgId` parameter for defense-in-depth. Updated all 3 callers (execution repo, skill/agent execution-config endpoints).
- [x] M-2: Hardcoded system user UUID in `system-context.ts`. Now reads from `SYSTEM_USER_ID` env var with fallback to seeded value.
- [x] M-3: Malformed RRule silently fell back to 1h execution schedule. Now returns `null` (skips automation) and logs error.
- [x] M-4: `notify_new_task()` trigger used `SECURITY DEFINER` unnecessarily — `pg_notify()` doesn't need elevated privileges. Removed in migration `0069`.
- [x] M-5: Scheduler loads all agents cross-org by design. Documented security boundary in `run-scheduler.ts` header comment.

### LOW — Documented (not fixed)

| # | Finding | File |
|---|---------|------|
| L-1 | Webhook GET leaks config without auth | `api/webhooks/[agentId]/route.ts` |
| L-2 | Unvalidated JSON.parse on LISTEN payload | `run-scheduler.ts` |
| L-3 | Template injection surface (prompt injection) | `instruction-template-service.ts` |
| L-4 | Storage recalc `INTERVAL_MINUTES` unbounded | `storage-recalculation-application-service.ts` |

### INFO

| # | Finding | File |
|---|---------|------|
| I-1 | SSL disabled for DB connections | `db/client.ts`, `client-parser.ts` |
