# Orchastrate Documentation

## Structure

```
docs/
├── architecture/     # System design & architecture docs
├── api/              # API documentation
├── features/         # Future feature plans & specs
├── guides/           # Implementation guides & reference
├── strategy/         # Business & product strategy
├── audits/           # Technical audits & reviews
├── bugs/             # Bug investigations & fixes
└── archive/          # Completed/outdated docs
```

---

## Architecture

System design documentation.

| Document | Description |
|----------|-------------|
| [SYSTEM_OVERVIEW](architecture/SYSTEM_OVERVIEW.md) | High-level system architecture |
| [ORCHESTRATION_FLOW](architecture/ORCHESTRATION_FLOW.md) | Agent orchestration flow diagrams |
| [AGENTIC_CHAT_SYSTEM](architecture/AGENTIC_CHAT_SYSTEM.md) | Chat system architecture |
| [decisions/](architecture/decisions/) | Architecture Decision Records (ADRs) |

---

## API Documentation

| Document | Description |
|----------|-------------|
| [AUTH_TOKEN_SYSTEM](api/AUTH_TOKEN_SYSTEM.md) | Authentication & token system |
| [ADMIN_ENTERPRISE_API](api/ADMIN_ENTERPRISE_API.md) | Admin/Enterprise provisioning API |
| [published-app-authentication](api/published-app-authentication-system.md) | Published app auth system |

---

## Future Features

Planned feature specifications (not yet implemented).

| Document | Description |
|----------|-------------|
| [PII Anonymizer](features/pii-anonymizer-implementation.md) | System-wide PII anonymization |
| [A2A Protocol](features/a2a-implementation-plan.md) | Agent-to-Agent protocol support |
| [Agent Workspace Terminal](features/agent-workspace-terminal.md) | Interactive terminal in agent sandbox |
| [Tools Registry Redesign](features/tools-registry-redesign.md) | Reference-to-execution auto-binding |

---

## Guides

Implementation guides and reference documentation.

| Document | Description |
|----------|-------------|
| [Model Selection Hierarchy](guides/model-selection-hierarchy.md) | AI model selection logic |
| [Workspace Architecture](guides/WORKSPACE_ARCHITECTURE.md) | Workspace storage & isolation |
| [Workspace Sync](guides/WORKSPACE_SYNC.md) | Real-time workspace synchronization |

---

## Strategy

Business and product documentation.

| Document | Description |
|----------|-------------|
| [Product Strategy](strategy/PRODUCT_STRATEGY.md) | Business positioning & strategy options |

---

## Audits

Technical audits and reviews.

| Document | Description |
|----------|-------------|
| [Scalability Audit](audits/SCALABILITY_AUDIT.md) | System scalability analysis |

---

## Archive

Completed or outdated documentation. Kept for reference.

| Document | Notes |
|----------|-------|
| BACKEND_OUTPUT_SEPARATION.md | Implementation plan (completed) |
| CHAT_ROW_SELECTION.md | Implementation plan (completed) |
| uxflows.md | UX flow diagrams |
| slide-content-outline*.md | Presentation materials |
