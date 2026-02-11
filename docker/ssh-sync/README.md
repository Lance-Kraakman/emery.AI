# SSH Sync Container (Local Development)

SSH + rsync server for workspace synchronization between the Tauri desktop app and agent workspaces.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────┐
│   Tauri App     │         │  SSH Container  │         │   Next.js   │
│                 │         │                 │         │     API     │
│  1. Generate    │         │                 │         │             │
│     SSH key     │         │                 │         │             │
│                 │         │                 │         │             │
│  2. Register ───┼─────────┼─────────────────┼────────▶│ POST        │
│     key via API │         │                 │         │ /api/user/  │
│                 │         │                 │         │ ssh-keys    │
│                 │         │                 │         │             │
│  3. rsync ──────┼────────▶│ 4. AuthorizedKeysCommand  │             │
│     over SSH    │         │    calls ───────┼────────▶│ GET         │
│                 │         │    fetch-keys.sh│         │ /api/internal/
│                 │◀────────┼─────────────────┼─────────│ authorized-keys
│                 │         │ 5. SSH authenticated      │             │
│                 │         │                 │         │             │
│  6. Sync files  │◀───────▶│    rsync        │         │             │
│                 │         │                 │         │             │
└─────────────────┘         └────────┬────────┘         └─────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  workspace-data │
                            │     volume      │
                            └─────────────────┘
```

## How It Works

1. **Key Generation**: Tauri app generates an Ed25519 SSH key pair on first connect
2. **Key Registration**: Public key is sent to `POST /api/user/ssh-keys` and stored in database
3. **SSH Connection**: When rsync connects via SSH, the container runs `AuthorizedKeysCommand`
4. **Key Fetch**: `fetch-keys.sh` calls `GET /api/internal/authorized-keys` to get all registered keys
5. **Authentication**: SSH daemon authenticates using the returned keys
6. **Sync**: rsync transfers files to/from the shared workspace volume

## Files

```
docker/ssh-sync/
├── Dockerfile       # Extends linuxserver/openssh-server with AuthorizedKeysCommand
├── fetch-keys.sh    # Script called by sshd to fetch keys from API
└── README.md        # This file
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INTERNAL_API_SECRET` | Shared secret for internal API auth | Required |
| `API_HOST` | Next.js API host:port | `host.docker.internal:3000` |
| `PUID` | User ID for file permissions | `1000` |
| `PGID` | Group ID for file permissions | `1000` |

## Prerequisites

1. Next.js app running with `INTERNAL_API_SECRET=local-dev-secret` in `.env.local`
2. Database migrated with `user_ssh_keys` table

## Usage

```bash
# Build and start the container
docker-compose up -d --build ssh-sync

# View logs
docker logs -f emery-ssh-sync

# Verify AuthorizedKeysCommand is configured
docker exec emery-ssh-sync cat /etc/ssh/sshd_config.d/authorized_keys_command.conf

# Test key fetching manually
docker exec emery-ssh-sync /usr/local/bin/fetch-keys.sh

# Check if your key is registered (from host)
curl -H "X-Internal-Secret: local-dev-secret" http://localhost:3000/api/internal/authorized-keys
```

## Troubleshooting

### SSH asks for password
- Check that Next.js is running and accessible from the container
- Verify `INTERNAL_API_SECRET` matches in both `.env.local` and docker-compose
- Test the API endpoint: `curl -H "X-Internal-Secret: local-dev-secret" http://localhost:3000/api/internal/authorized-keys`
- Check container can reach host: `docker exec emery-ssh-sync curl http://host.docker.internal:3000/health`

### No keys returned
- Ensure you've connected a workspace folder in the Tauri app (this registers your SSH key)
- Check database: `SELECT * FROM user_ssh_keys;`

### Permission denied
- Verify your local SSH key matches what's registered: `cat ~/.ssh/emery_sync_ed25519.pub`
- Compare with API response to ensure it's in the database
