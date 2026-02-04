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

## Phase 3: RBAC Permission Checks on Data Routes

- [ ] H-01: Add `requirePermission()` to `/api/rows`, `/api/tables`, `/api/databases`, `/api/fields`, `/api/files/[fileId]`, `/api/agents/[id]`, `/api/tasks`
- [ ] H-02: Validate `organizationId` from session, not client parameter

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

## Phase 6: API Key Hashing (DB Migration)

- [ ] C-02: Hash user API keys (SHA-256, show once)
- [ ] C-03: Hash agent API keys (SHA-256, show once)
- [ ] H-09: Add key rotation grace period

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
