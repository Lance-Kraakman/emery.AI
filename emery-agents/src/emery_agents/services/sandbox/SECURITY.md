# Sandbox Security Model

## Overview

Agent commands execute in a **gVisor sandbox** using the `runsc` runtime. gVisor provides stronger isolation than namespace-based sandboxes (like bubblewrap) by implementing a user-space kernel called Sentry that intercepts ALL syscalls. The real Linux kernel is never directly exposed to agent code.

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Host Container (Fargate)                               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  gVisor Sandbox (runsc)                           │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Sentry (user-space kernel)                 │  │  │
│  │  │  - Intercepts ALL syscalls                  │  │  │
│  │  │  - Synthetic /proc, /sys                    │  │  │
│  │  │  - Never touches real kernel                │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Gofer (filesystem proxy)                   │  │  │
│  │  │  - Mediates all file access                 │  │  │
│  │  │  - Runs in separate process                 │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Agent Command                              │  │  │
│  │  │  /workspace (rw), /usr (ro), /bin (ro)      │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         │ Unix socket (proxy)           │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │  Network Filtering Proxy                          │  │
│  │  - Blocks private IPs (10.x, 172.x, 169.254.x)   │  │
│  │  - Allows public internet                         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## What gVisor blocks

### Kernel isolation (Sentry)

gVisor's Sentry intercepts and handles ALL system calls in user-space. This provides:

| Threat | Protection |
|--------|------------|
| Kernel syscall exploits | Sentry handles syscalls, not the real kernel |
| io_uring/bpf/ptrace exploits | Not implemented in Sentry |
| Unknown kernel 0-days | Real kernel never exposed |
| /proc info leakage | Synthetic /proc, no host info |
| Container escape | No namespace to escape from |

### Filesystem isolation

The sandbox starts with an **OCI runtime spec** that explicitly mounts only allowed paths:

| Path | Access | What's there |
|------|--------|-------------|
| `/workspace` | read-write | Agent's own workspace only |
| `/usr`, `/bin`, `/lib` | read-only | System tools (python, bash, curl, git) |
| `/tmp`, `/var`, `/run`, `/etc` | tmpfs | Fresh empty directories |
| `/etc/alternatives` | read-only | Debian symlinks only |

**Invisible to the sandbox:**
- `/home`, `/root` — no user directories
- `/opt`, `/srv`, `/mnt`, `/media` — no host data
- Host's actual `/tmp`, `/var`, `/etc` — replaced with empty tmpfs
- `/dev/mem`, `/dev/kmem`, block devices — not mounted
- Other agent workspaces — each agent only sees its own
- Any path not explicitly listed above

### Namespace isolation

gVisor creates isolated namespaces for:

| Namespace | Effect |
|-----------|--------|
| PID | Can't see or signal host processes |
| Network | Zero network interfaces (always, even with allowNetwork) |
| UTS | Isolated hostname |
| IPC | Isolated shared memory, semaphores, message queues |
| Mount | Isolated filesystem view |

### Environment isolation

- Minimal environment with only `PATH` set
- No `AWS_SECRET_ACCESS_KEY`, no `DATABASE_URL`, no `REDIS_URL`
- When allowNetwork=true, only `http_proxy`/`https_proxy` vars are injected

## Network isolation (proxy layer)

When `allowNetwork=false`: zero network interfaces, nothing gets out.

When `allowNetwork=true`: still zero interfaces, only exit is through filtering proxy.

**Proxy blocks (all internal):**
- `10.0.0.0/8` — VPC (DB, Redis, other ECS tasks)
- `172.16.0.0/12`, `192.168.0.0/16` — private ranges
- `127.0.0.0/8` — localhost
- `169.254.169.254/32` — AWS instance metadata (IAM creds)
- `169.254.170.2/32` — ECS task credential endpoint
- `100.64.0.0/10` — carrier-grade NAT / AWS VPC endpoints
- All IPv6 private/link-local

**Proxy allows:** any public IP.

**Bypass resistance:** tools that ignore proxy env vars get zero network (no interfaces exist). Direct TCP connections fail with "network unreachable".

## Available tools in sandbox

The sandbox has `PATH=/usr/local/bin:/usr/bin:/bin` set, giving access to:

| Tool | Location | Purpose |
|------|----------|---------|
| `python3` | /usr/local/bin | Python interpreter |
| `pip` | /usr/local/bin | Python package manager |
| `bash`, `sh` | /bin | Shell |
| `git` | /usr/bin | Version control |
| `curl`, `wget` | /usr/bin | HTTP clients (via proxy when network enabled) |
| `jq` | /usr/bin | JSON processing |
| `awk`, `sed`, `grep` | /usr/bin | Text processing |
| `ls`, `cat`, `cp`, `mv`, `rm` | /bin | File operations |
| `tree` | /usr/bin | Directory visualization |

**Not available by default** (add to Dockerfile if needed):
- `gcc`, `make`, `cmake` — C/C++ compilation
- `node`, `npm` — Node.js
- `go` — Go compiler
- `rustc`, `cargo` — Rust

## gVisor platform

We use `--platform=ptrace` which works on AWS Fargate (no KVM required). The ptrace platform:
- Intercepts syscalls via ptrace
- Slightly slower than KVM platform (~30% overhead)
- No special hardware requirements
- Works in any Linux container environment

## Comparison to other isolation methods

| Method | Kernel exposure | Syscall isolation | /proc | Escape vectors |
|--------|----------------|-------------------|-------|----------------|
| **gVisor (Sentry)** | None | All intercepted | Synthetic | Minimal |
| bwrap + seccomp | ~300 syscalls | Blocklist | Host (ro) | Namespace bugs |
| Docker | Full kernel | Optional seccomp | Host | Many |
| Firecracker | None (microVM) | Separate kernel | Separate | Minimal |

## Defense-in-depth layers

| Layer | Protects against |
|-------|-----------------|
| gVisor Sentry | Kernel syscall exploits |
| Gofer process | Filesystem escape |
| OCI mounts | Host file access |
| PID namespace | Host process visibility |
| Network namespace | All network access |
| Network proxy | Internal network access |
| 5-minute timeout | Resource exhaustion |
| AWS Security Groups | Inbound network |
| AWS WAF | Inbound HTTP attacks |

## Security testing

The sandbox includes security testing tools that can be run to validate isolation:

```bash
# Run inside container (executes in gVisor sandbox)
run-sandbox-pentest
```

### Bundled security tools

| Tool | Purpose | Source |
|------|---------|--------|
| **amicontained** | Container security introspection | github.com/genuinetools/amicontained |
| **deepce** | Container escape enumeration | github.com/stealthcopter/deepce |
| **botb** | Break out the Box - escape testing | github.com/brompwnie/botb |

### Validated security controls

Last tested: Feb 2026

| Test | Result |
|------|--------|
| Kernel syscalls isolated (Sentry) | PASS |
| Network interfaces isolated | PASS |
| /home, /root inaccessible | PASS |
| /etc is tmpfs (isolated) | PASS |
| Docker socket not accessible | PASS |
| AWS metadata (169.254.169.254) blocked | PASS |
| Container escape vectors | None found |

## ECS requirements

For gVisor to work on ECS/Fargate, the task definition needs:

```json
{
  "containerDefinitions": [{
    "linuxParameters": {
      "capabilities": {
        "add": ["SYS_PTRACE"]
      }
    }
  }]
}
```

This capability is required for gVisor's ptrace platform.
