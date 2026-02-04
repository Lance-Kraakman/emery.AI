# Agent Workspace Terminal — Implementation Plan

## Overview

Interactive terminal on the agent page connected to the agent's bwrap sandbox. Reuses the existing sandbox infrastructure (same namespaces, seccomp, network proxy). Terminal appears as a resizable bottom panel (VS Code-style).

## Architecture

```
Browser (xterm.js)  ──WS/SSE──▶  Next.js / WS server  ──gRPC bidi stream──▶  Python worker (PTY inside bwrap)
```

## What exists today

| Layer | What's there | Key files |
|-------|-------------|-----------|
| Sandbox | bwrap with full isolation (user/pid/net/uts/cgroup/ipc namespaces, seccomp, empty env) | `emery-agents/.../sandbox/bwrap_executor.py` |
| Shell execution | One-shot `subprocess.run()` via `WorkspaceShell.run()` — no PTY, no persistence | same file, `WorkspaceShell` class |
| Workspace storage | S3 tar.gz per agent, downloaded at task start, uploaded after | `workspace_sync.py`, `workspace-s3.ts` |
| Workspace download | `GET /api/agents/[id]/workspace/download` streams tar.gz | `src/app/api/agents/[id]/workspace/download/route.ts` |
| gRPC service | `ChatProcessingService` + `AgentWorker` — server-streaming only (no bidirectional) | `proto/agent_worker.proto` |
| gRPC client | `@grpc/grpc-js` based, server-streaming with callback | `chat-processing-client.ts` |
| Agent page UI | Timeline view + CompactAgentHeader (has "Download Workspace" button already) | `src/app/(app)/agents/[agentId]/` |
| Network proxy | Filtering proxy for sandbox (blocks private IPs, allows public) | `network_proxy.py`, `proxy_manager.py` |

---

## 1. Proto — new bidirectional RPC

**File**: `proto/agent_worker.proto`

Add to `AgentWorker` service:

```protobuf
rpc ShellSession(stream ShellInput) returns (stream ShellOutput);
```

New messages:

```protobuf
message ShellOpen {
  int32 agent_id = 1;
  string organization_id = 2;
  int32 cols = 3;          // initial terminal width
  int32 rows = 4;          // initial terminal height
  bool allow_network = 5;  // reuse existing network proxy
}

message ShellData {
  bytes data = 1;          // raw terminal bytes (stdin or stdout)
}

message ShellResize {
  int32 cols = 1;
  int32 rows = 2;
}

message ShellClose {}

message ShellExited {
  int32 exit_code = 1;
}

message ShellError {
  string code = 1;
  string message = 2;
}

message ShellInput {
  oneof input {
    ShellOpen open = 1;
    ShellData data = 2;
    ShellResize resize = 3;
    ShellClose close = 4;
  }
}

message ShellOutput {
  oneof output {
    ShellData data = 1;
    ShellExited exited = 2;
    ShellError error = 3;
  }
}
```

---

## 2. Python worker — PTY session manager

**New file**: `emery-agents/src/emery_agents/services/sandbox/pty_session.py`

- `PtySession` class: wraps a bwrap process spawned with a PTY
  - Uses `pty.openpty()` to create master/slave pair
  - Reuses `BwrapExecutor._build_command()` but with `bash --login` instead of `bash -c "..."`
  - Passes slave fd as stdin/stdout/stderr to `subprocess.Popen`
  - Reads from master fd in a thread, writes to master fd for input
  - Handles `SIGWINCH` (resize) via `fcntl.ioctl(fd, termios.TIOCSWINSZ, ...)`
  - Idle timeout (configurable, e.g. 15 min) — kills the process if no input received
  - Cleans up on exit (kill process, close fds, sync workspace back to S3)

- `PtySessionManager` class: maps `(agent_id, org_id)` → `PtySession`
  - `open_session(agent_id, org_id, cols, rows, allow_network)` → downloads workspace from S3 if needed, spawns PTY
  - `close_session(agent_id, org_id)` → kills PTY, syncs workspace to S3
  - Max sessions per worker (prevent resource exhaustion)
  - Singleton, used by gRPC servicer

**Modified file**: `emery-agents/src/emery_agents/services/sandbox/bwrap_executor.py`

- Extract `_build_command()` base args into a reusable method that can produce either:
  - One-shot mode: `bash -c "cd /workspace && {command}"` (existing)
  - Interactive mode: `bash --login` (new, for PTY)
- No changes to existing `execute()` — just refactor to share the command-building logic

**Modified file**: `emery-agents/src/emery_agents/grpc/server.py`

- Add `ShellSession` RPC handler to the gRPC servicer
- Handler creates/reuses PTY session via `PtySessionManager`
- Bidirectional stream: reads `ShellInput` messages, writes `ShellOutput` messages
- On stream end (client disconnect), triggers session cleanup + workspace sync

---

## 3. Next.js — transport layer

**Decision deferred**: The exact transport (WebSocket server co-located with Next.js, standalone WS service, or SSE+POST) is TBD. All options connect to the same gRPC bidi stream on the Python side.

Regardless of transport choice, the API contract to the browser is:
- **Downstream** (server → browser): binary terminal output chunks
- **Upstream** (browser → server): binary terminal input + resize events + open/close signals
- **Auth**: Same as existing agent endpoints (session cookie + org membership check)

**New file (or integrated)**: terminal API endpoint/handler
- Authenticates the user
- Verifies agent belongs to user's org
- Opens gRPC `ShellSession` bidi stream to the Python worker
- Bridges browser ↔ gRPC stream

**Transport options to evaluate later**:
1. Custom `server.ts` wrapping Next.js with WS upgrade handler (same deployment/machine)
2. Standalone WS microservice (separate process, same machine)
3. SSE (downstream) + POST (upstream) — works today with no infra changes, higher input latency

---

## 4. Frontend — terminal panel

**New deps**: `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl` (optional, GPU rendering)

**New component**: `src/components/terminal/AgentTerminal.tsx`
- xterm.js instance
- Connects to the transport endpoint (WS or SSE)
- Sends `open` message with agent_id and initial terminal dimensions
- Pipes xterm `onData` → upstream, downstream → `xterm.write()`
- Handles resize via `addon-fit` → sends resize event upstream
- Reconnect logic on disconnect
- Loading/error states

**New component**: `src/components/terminal/TerminalPanel.tsx`
- Resizable bottom panel (drag handle at top edge)
- Collapse/expand toggle button
- Panel height persisted in localStorage
- Renders `AgentTerminal` inside

**Modified file**: `src/app/(app)/agents/[agentId]/` (agent page)
- Add `TerminalPanel` below the existing timeline view
- Toggle button in `CompactAgentHeader` (next to existing "Download Workspace" button)
- Panel starts collapsed by default, opens on click

---

## 5. Workspace sync considerations

- When terminal opens: workspace is downloaded from S3 (reuse `WorkspaceSync.download()`)
- While terminal is active: changes happen on disk in real-time (no snapshotting)
- On disconnect/close: workspace is synced back to S3 (reuse `WorkspaceSync.upload()`)
- If agent task runs while terminal is open: both operate on the same extracted workspace path — this is fine since the user and agent are collaborating
- Conflict: if a task execution tries to download a fresh workspace while terminal is active, skip the download (use the live workspace)

---

## Files to create/modify (summary)

| Action | File |
|--------|------|
| Modify | `proto/agent_worker.proto` — add ShellSession RPC + messages |
| Create | `emery-agents/src/emery_agents/services/sandbox/pty_session.py` — PTY session manager |
| Modify | `emery-agents/src/emery_agents/services/sandbox/bwrap_executor.py` — extract shared command builder |
| Modify | `emery-agents/src/emery_agents/grpc/server.py` — add ShellSession handler |
| Create | `src/components/terminal/AgentTerminal.tsx` — xterm.js wrapper |
| Create | `src/components/terminal/TerminalPanel.tsx` — resizable bottom panel |
| Modify | Agent page components — add terminal toggle + panel |
| Create | Terminal API endpoint (exact location TBD based on transport decision) |
| Regenerate | gRPC generated files (both Python and TypeScript) |

---

## Verification

- Open agent page → click terminal toggle → panel slides up
- Terminal connects → shows bash prompt inside bwrap sandbox at `/workspace`
- Type `ls` → see workspace files
- Type `echo hello > test.txt` → file persists
- Close terminal → reopen → file still there (workspace synced to S3)
- Run an agent task → task sees files created via terminal
- Resize browser → terminal reflows correctly
- Idle for N minutes → session auto-closes, workspace synced

---

## Future: native desktop app

Separate concern — a desktop app (Tauri or Electron) that:
- Connects to the same WS/gRPC endpoint
- Uses native terminal rendering (faster than xterm.js)
- Syncs workspace to local filesystem (bidirectional sync like Dropbox)
- Mac: files appear in Finder via local sync directory
- Windows: files appear in Explorer via local sync directory
- Could eventually show a full desktop view (noVNC to Xvfb inside bwrap)
- Separate package/repo, consumes the same API

---

## Comparable products

| Product | How they do it | Isolation |
|---------|---------------|-----------|
| E2B | Firecracker microVMs, SDK gives shell access, 150ms boot | Hardware-level |
| GitHub Codespaces | Docker + VS Code Server + xterm.js | Container |
| Replit | Custom containers (Goval) + custom IDE | Container |
| Anthropic Computer Use | Docker + noVNC + Streamlit | Container |
| HuggingFace Spaces | Docker SDK + JupyterLab terminal | Container |

Our approach (bwrap + PTY) is lighter than all of these — no container or VM overhead, just namespace isolation on the same host. The tradeoff is Linux-only and shares the host kernel.
