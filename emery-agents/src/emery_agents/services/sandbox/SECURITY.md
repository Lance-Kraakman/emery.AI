# Sandbox Security Model

## What bwrap blocks (filesystem)

The sandbox starts with an **empty namespace**. Only explicitly mounted paths exist.

| Path | Access | What's there |
|------|--------|-------------|
| `/workspace` | read-write | Agent's own workspace only |
| `/usr`, `/bin`, `/lib` | read-only | System tools (python, bash, curl, git) |
| `/proc` | read-only | Host procfs (see remaining concerns below) |
| `/dev/null,zero,full,random,urandom` | dev-bind | Only essential devices (not full /dev) |
| `/dev/fd`, `/dev/stdin`, `/dev/stdout`, `/dev/stderr` | symlink | Points to /proc/self/fd |
| `/tmp`, `/var`, `/run`, `/etc` | tmpfs | Fresh empty directories, not host's |
| `/etc/alternatives` | read-only | Debian symlinks (awk, python, etc.) - contains only symlinks to /usr binaries |

**Invisible to the sandbox:**
- `/home`, `/root` — no user directories
- `/opt`, `/srv`, `/mnt`, `/media` — no host data
- Host's actual `/tmp`, `/var`, `/etc` — replaced with empty tmpfs
- `/dev/mem`, `/dev/kmem`, block devices — not mounted
- Other agent workspaces — each agent only sees its own
- Any path not explicitly listed above

## What bwrap blocks (namespaces)

| Namespace | Flag | Effect |
|-----------|------|--------|
| User | `--unshare-user` | Fake root inside sandbox, unprivileged on host |
| PID | `--unshare-pid` | Can't see or signal host processes |
| Network | `--unshare-net` | Zero network interfaces (ALWAYS, even with allowNetwork) |
| UTS | `--unshare-uts` | Can't change hostname |
| Cgroup | `--unshare-cgroup` | Isolated cgroup view |
| IPC | `--unshare-ipc` | Isolated shared memory, semaphores, message queues |

## Seccomp syscall filter

A mandatory seccomp-bpf filter blocks dangerous syscalls before execution. If the filter cannot be created, execution is refused (fail-closed).

Uses libseccomp Python bindings (same library Flatpak uses for its bwrap seccomp filters). Filter is compiled to BPF and passed via `bwrap --seccomp <fd>`.

**Blocked syscalls:**

| Syscall | Why blocked |
|---------|------------|
| `io_uring_setup/enter/register` | Kernel async I/O — ~10+ CVEs in recent years |
| `bpf` | eBPF kernel programmability — regular privilege escalation target |
| `keyctl`, `add_key`, `request_key` | Kernel keyring — has had escalation bugs |
| `ptrace` | Process tracing — sandbox escape vector |
| `userfaultfd` | Used as a primitive in race condition exploits |
| `kexec_load`, `kexec_file_load` | Load/execute a new kernel |
| `perf_event_open` | Kernel info leak + exploit vector |

Everything else is allowed (blocklist approach — bash/python/curl/git need hundreds of syscalls).

## What bwrap blocks (environment)

- Minimal environment with only `PATH` set (see below)
- No `AWS_SECRET_ACCESS_KEY`, no `DATABASE_URL`, no `REDIS_URL`
- When allowNetwork=true, only `http_proxy`/`https_proxy` vars are injected (pointing to sandbox-local socat bridge)

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

## Remaining kernel-level concerns

bwrap uses Linux namespaces, which are a **kernel feature**. The sandboxed process still shares the host kernel. The seccomp filter significantly reduces the attack surface, but the kernel remains the boundary.

### `/proc` exposure (info leak)

Uses `--ro-bind /proc /proc` which mounts the **host's** procfs read-only.

Exposed (read-only):
- `/proc/cpuinfo`, `/proc/meminfo` — hardware info (low risk)
- `/proc/kallsyms` — kernel symbol addresses (useful for kernel exploits)
- `/proc/sys/*` — kernel config (informational)

The sandbox can't write to /proc (no sysctl changes), but kernel symbol addresses are valuable for exploit development.

**Future mitigation:** Use `--proc /proc` instead (new procfs scoped to sandbox's PID namespace). May not work on Fargate due to mount restrictions.

### User namespace as attack surface

`--unshare-user` creates a user namespace where the process appears as root (UID 0) but maps to an unprivileged user on the host. However:
- User namespace code itself has been a frequent source of kernel CVEs
- `CAP_SYS_ADMIN` within the namespace enables operations that can trigger kernel bugs
- Several container escapes have targeted user namespace edge cases

## Future improvements (kernel isolation)

- **`--proc /proc`** — new procfs scoped to sandbox PIDs (hides kallsyms). Test on Fargate.
- **gVisor** — Google's user-space kernel. Sandbox never touches the real kernel. Used by GKE Sandbox, Cloud Run. Requires moving from Fargate to EC2-backed ECS.
- **Firecracker** — AWS's microVM. Full kernel isolation. Used by Lambda. Requires KVM (not available on Fargate).

## Defense-in-depth layers

| Layer | Protects against |
|-------|-----------------|
| bwrap filesystem namespace | Host file access, other agent data |
| Selective /dev (5 devices only) | /dev/mem, /dev/kmem, raw block device access |
| bwrap PID namespace | Host process visibility |
| bwrap IPC namespace | Shared memory / semaphore attacks |
| bwrap network namespace | All network access (always isolated) |
| Seccomp BPF filter | Dangerous syscalls (io_uring, bpf, ptrace, etc.) |
| Minimal environment (PATH only) | Credential/secret leakage |
| Network proxy (when allowed) | Internal network access (VPC, metadata, localhost) |
| 5-minute execution timeout | Resource exhaustion, runaway processes |
| `--die-with-parent` | Orphaned sandbox processes |
| `--new-session` | Terminal/TTY attacks |
| AWS Security Groups | Inbound network to containers |
| AWS WAF | Inbound HTTP attacks |

## Security testing

The sandbox includes security testing tools that can be run to validate isolation:

```bash
# Run inside container (executes in bwrap sandbox)
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
| Seccomp filter active | PASS |
| Network interfaces isolated | PASS |
| /home, /root inaccessible | PASS |
| /etc is tmpfs (isolated) | PASS |
| Docker socket not accessible | PASS |
| /proc/sys/kernel/core_pattern not writable | PASS |
| AWS metadata (169.254.169.254) blocked | PASS |
| CVE-2019-5736 (runc escape) | BLOCKED (/bin/sh read-only) |
| Container escape vectors | None found |

### Known limitations (acceptable risk)

| Item | Status | Notes |
|------|--------|-------|
| /proc/kallsyms readable | INFO | Kernel addresses visible (set kptr_restrict=2 on host to hide) |
| AppArmor | unconfined | Not enforced (bwrap + seccomp is primary defense) |
| Capabilities | 13 caps | Could drop more, but current set is functional |
