# Agent Sandbox Environment

This document describes the sandboxed execution environment for agent bash commands.

## Overview

Agents execute bash commands in an isolated sandbox using [Bubblewrap (bwrap)](https://github.com/containers/bubblewrap). This provides security isolation while allowing agents to perform useful work like running git, curl, and other command-line tools.

## Filesystem Access

### Read-Only System Paths
The following paths are mounted read-only from the host:
- `/usr` - System binaries and libraries
- `/bin` - Essential binaries (bash, ls, cat, etc.)
- `/lib`, `/lib64` - Shared libraries
- `/proc` - Process information (read-only bind mount)

### Writable Paths
- `/workspace` - Agent's workspace directory (persistent storage)
- `/tmp` - Ephemeral tmpfs (isolated per execution)
- `/var/log`, `/run` - Ephemeral tmpfs directories

### Invisible Paths
All other host paths are invisible to the sandboxed process. The agent cannot:
- Access other agent workspaces
- Read host environment variables
- Access host secrets or credentials

## Network Access

### Default Behavior
- **Agents**: Network access is **enabled by default** (`allowNetwork: true`)
- **Skills**: Network access is **disabled by default** (`allowNetwork: false`)

### How Network Works

When network is enabled:
1. The sandbox uses `--unshare-net` (zero network interfaces by default)
2. A filtering proxy runs on the host, listening on a Unix socket
3. The socket is bind-mounted into the sandbox
4. `socat` bridges the Unix socket to sandbox-local TCP
5. `http_proxy` / `https_proxy` environment variables route traffic through the proxy

### Proxy Filtering
The proxy blocks connections to:
- Private IP ranges (RFC1918: 10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Localhost (127.x.x.x)
- AWS metadata service (169.254.169.254)
- Link-local addresses (169.254.x.x)
- IPv6 local addresses

### Git Usage

**HTTPS works** (when network is enabled):
```bash
# Clone public repos
git clone https://github.com/user/repo.git

# Clone private repos with token
git clone https://oauth2:$TOKEN@github.com/user/private-repo.git
```

**SSH does NOT work**:
- No SSH keys are mounted in the sandbox
- SSH connections bypass the HTTP proxy and hit the network firewall
- Use HTTPS with tokens instead

### Tools That Work
When network is enabled, these tools work via the HTTP proxy:
- `curl` / `wget` (HTTP/HTTPS requests)
- `git` (HTTPS URLs only)
- `pip` / `npm` / `cargo` (package managers)
- Python `requests`, `httpx`, `urllib` libraries

### Tools That Don't Work
These bypass the HTTP proxy and will fail:
- SSH connections
- Raw TCP sockets
- Non-HTTP protocols

## User Identity

Inside the sandbox:
- The process appears to run as `root` (UID 0)
- This is due to user namespace mapping
- On the host, it's still an unprivileged user
- The "root" identity cannot escape the sandbox

## Available Commands

The sandbox includes standard Linux tools:
- `bash`, `sh` - Shells
- `git` - Version control
- `curl`, `wget` - HTTP clients
- `python3`, `pip` - Python interpreter
- `node`, `npm`, `npx` - Node.js (if installed)
- `jq` - JSON processor
- `grep`, `sed`, `awk` - Text processing
- `ls`, `cat`, `head`, `tail`, `find` - File utilities

## Security Layers

### 1. Namespace Isolation
- User namespace (unprivileged root)
- PID namespace (isolated process tree)
- Network namespace (no interfaces)
- UTS namespace (isolated hostname)
- IPC namespace (isolated shared memory)
- Cgroup namespace (isolated resource limits)

### 2. Filesystem Isolation
- Empty namespace by default
- Only explicitly mounted paths visible
- Read-only system paths
- Isolated tmp directories

### 3. Seccomp Filtering
- Syscall filtering blocks dangerous operations
- Prevents kernel exploitation attempts

### 4. Network Filtering
- All network via HTTP proxy
- Proxy blocks private/reserved IPs
- No direct network access possible

## Configuration

### Agent Level
Set on the agent entity in the database:
```typescript
// Default: true - agents can access network
allowNetwork: boolean
```

### Skill Level
Set on individual skills:
```typescript
// Default: false - skills need explicit network access
allowNetwork: boolean
```

The skill setting overrides the agent setting when executing a skill.

## Troubleshooting

### "Network unreachable" errors
- Check if `allowNetwork` is enabled for the agent/skill
- The command may be trying to use SSH instead of HTTPS

### "Permission denied" errors
- Ensure the file/directory is in `/workspace`
- System paths are read-only

### Git clone fails
- Use HTTPS URLs, not SSH (git@github.com:...)
- For private repos, include the token in the URL
