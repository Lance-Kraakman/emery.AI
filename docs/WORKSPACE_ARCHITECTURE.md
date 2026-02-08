# Workspace Architecture: Shared Filesystem (EFS)

## Overview

A simple, unified architecture where everything reads/writes directly to a shared filesystem.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│     Tauri Desktop              API Server              Shared FS       │
│                                                                         │
│     ┌───────────┐             ┌───────────┐          ┌───────────┐     │
│     │ User's    │◄───delta───►│ Next.js   │◄────────►│ EFS/NFS   │     │
│     │ Machine   │    sync     │           │  direct  │           │     │
│     └───────────┘   (HTTPS)   └───────────┘  r/w     └───────────┘     │
│                                                             ▲           │
│                               ┌───────────┐                 │           │
│                               │ Agent     │◄────────────────┘           │
│                               │ Container │  mounted                    │
│                               └───────────┘                             │
│                                                                         │
│     S3 used only for:                                                  │
│     - Delta Lake tables (unchanged)                                    │
│     - File uploads/attachments (unchanged)                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** The API server has direct access to EFS. No need for S3 as middleman.

---

## Data Flows

### Agent Task Execution

```
Task Request
     │
     ▼
┌─────────────────┐
│ Agent Container │
│                 │
│ workspace_path = /mnt/efs/workspaces/{org}/{agent}/
│                 │
│ - Read/write directly
│ - No download
│ - No upload
│ - Changes persist instantly
└─────────────────┘
```

### Tauri Desktop Sync

```
User edits file locally
     │
     ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────┐
│ Tauri App       │──push──►│ API Server      │──write─►│ EFS         │
│                 │         │ /sync/push      │         │             │
│ Computes delta  │         │                 │         │ File saved  │
│ Sends changed   │         │ Writes directly │         │ instantly   │
│ files only      │         │ to EFS path     │         │             │
└─────────────────┘         └─────────────────┘         └─────────────┘

Agent runs next task
     │
     ▼
Agent sees user's changes immediately (same filesystem)
```

```
Agent modifies files
     │
     ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────┐
│ Tauri App       │◄─pull───│ API Server      │◄─read───│ EFS         │
│                 │         │ /sync/pull      │         │             │
│ Receives delta  │         │                 │         │ Reads files │
│ Updates local   │         │ Compares hashes │         │ directly    │
│ files           │         │ Returns changed │         │             │
└─────────────────┘         └─────────────────┘         └─────────────┘
```

---

## 1. Cloud-Agnostic Storage Abstraction

### Interface

```python
# emery-agents/src/emery_agents/infrastructure/storage/workspace_storage.py

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
from datetime import datetime


class WorkspaceStorage(ABC):
    """
    Abstract interface for workspace storage.

    Implementations:
    - SharedFilesystemStorage: EFS, Azure Files, NFS, local disk
    """

    @abstractmethod
    def get_workspace_path(self, org_id: int, agent_id: str) -> Path:
        """Get the local path for a workspace. Creates if doesn't exist."""
        pass

    @abstractmethod
    def workspace_exists(self, org_id: int, agent_id: str) -> bool:
        """Check if workspace exists."""
        pass

    @abstractmethod
    def delete_workspace(self, org_id: int, agent_id: str) -> None:
        """Delete a workspace entirely."""
        pass

    @abstractmethod
    def get_last_modified(self, org_id: int, agent_id: str) -> Optional[datetime]:
        """Get last modification time of workspace."""
        pass

    @abstractmethod
    def rotate_history(self, org_id: int, agent_id: str, max_days: int = 30) -> int:
        """Delete history older than max_days. Returns count deleted."""
        pass
```

### Implementation

```python
# emery-agents/src/emery_agents/infrastructure/storage/shared_filesystem_storage.py

import os
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

from .workspace_storage import WorkspaceStorage

logger = logging.getLogger(__name__)


class SharedFilesystemStorage(WorkspaceStorage):
    """
    Workspace storage using a shared filesystem (EFS, Azure Files, NFS, local).

    Directory structure:
        {base_path}/
        └── {org_id}/
            └── {agent_id}/
                ├── .agent/
                │   ├── config.json
                │   ├── memory.jsonl
                │   └── memory/chroma/
                ├── workspace/
                │   ├── context/
                │   ├── scratch/
                │   └── outputs/
                └── history/
                    └── {date}/{task_id}/
    """

    DEFAULT_DIRS = [
        ".agent",
        ".agent/plans",
        ".agent/memory",
        ".agent/memory/chroma",
        "workspace",
        "workspace/context",
        "workspace/scratch",
        "workspace/outputs",
        "history",
    ]

    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize storage.

        Args:
            base_path: Root path for workspaces.
                       Defaults to WORKSPACE_STORAGE_PATH env var
                       or /mnt/storage/workspaces
        """
        self.base_path = Path(
            base_path
            or os.getenv("WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces")
        )
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"SharedFilesystemStorage initialized at {self.base_path}")

    def _workspace_path(self, org_id: int, agent_id: str) -> Path:
        """Get path without creating."""
        return self.base_path / str(org_id) / agent_id

    def get_workspace_path(self, org_id: int, agent_id: str) -> Path:
        """Get workspace path, creating with default structure if needed."""
        path = self._workspace_path(org_id, agent_id)

        if not path.exists():
            logger.info(f"Creating new workspace: {path}")
            self._create_workspace(path, agent_id)

        return path

    def _create_workspace(self, path: Path, agent_id: str) -> None:
        """Create workspace with default directory structure."""
        for subdir in self.DEFAULT_DIRS:
            (path / subdir).mkdir(parents=True, exist_ok=True)

        # Create initial config
        config = {
            "workspace_id": agent_id,
            "created_at": datetime.now().isoformat(),
            "version": 1,
        }
        config_path = path / ".agent" / "config.json"
        config_path.write_text(json.dumps(config, indent=2))

    def workspace_exists(self, org_id: int, agent_id: str) -> bool:
        """Check if workspace exists."""
        return self._workspace_path(org_id, agent_id).exists()

    def delete_workspace(self, org_id: int, agent_id: str) -> None:
        """Delete a workspace entirely."""
        path = self._workspace_path(org_id, agent_id)
        if path.exists():
            shutil.rmtree(path)
            logger.info(f"Deleted workspace: {path}")

    def get_last_modified(self, org_id: int, agent_id: str) -> Optional[datetime]:
        """Get most recent modification time in workspace."""
        path = self._workspace_path(org_id, agent_id)
        if not path.exists():
            return None

        latest = None
        for file_path in path.rglob("*"):
            if file_path.is_file():
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if latest is None or mtime > latest:
                    latest = mtime
        return latest

    def rotate_history(self, org_id: int, agent_id: str, max_days: int = 30) -> int:
        """Delete history older than max_days."""
        workspace_path = self._workspace_path(org_id, agent_id)
        history_dir = workspace_path / "history"

        if not history_dir.exists():
            return 0

        cutoff = datetime.now() - timedelta(days=max_days)
        deleted = 0

        for date_dir in history_dir.iterdir():
            if not date_dir.is_dir():
                continue
            try:
                dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d")
                if dir_date < cutoff:
                    shutil.rmtree(date_dir)
                    deleted += 1
            except ValueError:
                continue

        if deleted:
            logger.info(f"Rotated {deleted} old history dirs for {agent_id}")

        return deleted
```

### Factory

```python
# emery-agents/src/emery_agents/infrastructure/storage/__init__.py

import os
from .workspace_storage import WorkspaceStorage
from .shared_filesystem_storage import SharedFilesystemStorage


def create_workspace_storage() -> WorkspaceStorage:
    """
    Create workspace storage backend.

    Environment variables:
        WORKSPACE_STORAGE_PATH: Base path for storage (default: /mnt/storage/workspaces)
    """
    return SharedFilesystemStorage()


__all__ = [
    "WorkspaceStorage",
    "SharedFilesystemStorage",
    "create_workspace_storage",
]
```

---

## 2. API Endpoints for Tauri Sync

These endpoints read/write directly to EFS - no S3 involved.

### Get File Signatures

```typescript
// src/app/api/agents/[id]/workspace/signatures/route.ts

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';

const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

interface FileSignature {
  hash: string;
  size: number;
  mtime: number;
}

async function getSignatures(dir: string, base: string = dir): Promise<Record<string, FileSignature>> {
  const signatures: Record<string, FileSignature> = {};

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.substring(base.length + 1);

    if (entry.isDirectory()) {
      const subSigs = await getSignatures(fullPath, base);
      Object.assign(signatures, subSigs);
    } else if (entry.isFile()) {
      const content = await readFile(fullPath);
      const stats = await stat(fullPath);
      signatures[relativePath] = {
        hash: createHash('sha256').update(content).digest('hex'),
        size: stats.size,
        mtime: stats.mtimeMs,
      };
    }
  }

  return signatures;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authResult = await authenticateRequest(request);
  if (!authResult.success || !authResult.user?.organizationId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: agentId } = await params;
  const orgId = authResult.user.organizationId;
  const workspacePath = join(WORKSPACE_BASE, String(orgId), agentId);

  try {
    const signatures = await getSignatures(workspacePath);
    return Response.json({
      success: true,
      signatures,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return Response.json({ success: true, signatures: {}, timestamp: Date.now() });
    }
    throw error;
  }
}
```

### Pull (Get Changed Files)

```typescript
// src/app/api/agents/[id]/workspace/sync/pull/route.ts

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { readdir, readFile, stat, access } from 'fs/promises';
import { join } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';

const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50MB

interface PullRequest {
  signatures: Record<string, string>; // path -> hash
}

async function walkDirectory(dir: string, base: string = dir): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...await walkDirectory(fullPath, base));
      } else if (entry.isFile()) {
        files.push(fullPath.substring(base.length + 1));
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }

  return files;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authResult = await authenticateRequest(request);
  if (!authResult.success || !authResult.user?.organizationId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: agentId } = await params;
  const orgId = authResult.user.organizationId;
  const workspacePath = join(WORKSPACE_BASE, String(orgId), agentId);

  const body: PullRequest = await request.json();
  const clientSignatures = body.signatures || {};

  // Get all files in workspace
  const remoteFiles = await walkDirectory(workspacePath);

  // Find changed files
  const changedFiles: Record<string, string> = {};
  const serverSignatures: Record<string, string> = {};
  let totalSize = 0;

  for (const relativePath of remoteFiles) {
    const fullPath = join(workspacePath, relativePath);
    const content = await readFile(fullPath);
    const hash = createHash('sha256').update(content).digest('hex');

    serverSignatures[relativePath] = hash;

    // Include if client doesn't have it or hash differs
    if (clientSignatures[relativePath] !== hash) {
      if (totalSize + content.length > MAX_RESPONSE_SIZE) {
        // Too large - client should sync in batches
        break;
      }
      changedFiles[relativePath] = content.toString('base64');
      totalSize += content.length;
    }
  }

  // Find deleted files (in client but not server)
  const deletedFiles = Object.keys(clientSignatures).filter(
    path => !serverSignatures[path]
  );

  return Response.json({
    success: true,
    files: changedFiles,
    deleted: deletedFiles,
    signatures: serverSignatures,
  });
}
```

### Push (Write Changed Files)

```typescript
// src/app/api/agents/[id]/workspace/sync/push/route.ts

import { NextRequest } from 'next/server';
import { mkdir, writeFile, unlink, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';

const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

interface PushRequest {
  files: Record<string, string>;  // path -> base64 content
  deleted: string[];              // paths to delete
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authResult = await authenticateRequest(request);
  if (!authResult.success || !authResult.user?.organizationId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: agentId } = await params;
  const orgId = authResult.user.organizationId;
  const workspacePath = join(WORKSPACE_BASE, String(orgId), agentId);

  // Ensure workspace exists
  await mkdir(workspacePath, { recursive: true });

  const body: PushRequest = await request.json();

  const filesAdded: string[] = [];
  const filesUpdated: string[] = [];
  const filesDeleted: string[] = [];

  // Delete files
  if (body.deleted) {
    for (const relativePath of body.deleted) {
      // Security: prevent path traversal
      if (relativePath.includes('..')) continue;

      const fullPath = join(workspacePath, relativePath);
      try {
        await unlink(fullPath);
        filesDeleted.push(relativePath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  // Write files
  if (body.files) {
    let totalSize = 0;

    for (const [relativePath, base64Content] of Object.entries(body.files)) {
      // Security: prevent path traversal
      if (relativePath.includes('..')) continue;

      const content = Buffer.from(base64Content, 'base64');
      totalSize += content.length;

      if (totalSize > MAX_UPLOAD_SIZE) {
        return Response.json(
          { error: `Upload exceeds ${MAX_UPLOAD_SIZE / 1024 / 1024}MB limit` },
          { status: 413 }
        );
      }

      const fullPath = join(workspacePath, relativePath);

      // Check if file exists (for added vs updated tracking)
      let exists = false;
      try {
        await readdir(dirname(fullPath));
        exists = true;
      } catch {}

      // Ensure directory exists
      await mkdir(dirname(fullPath), { recursive: true });

      // Write file
      await writeFile(fullPath, content);

      if (exists) {
        filesUpdated.push(relativePath);
      } else {
        filesAdded.push(relativePath);
      }
    }
  }

  return Response.json({
    success: true,
    result: {
      filesAdded,
      filesUpdated,
      filesDeleted,
    },
  });
}
```

---

## 3. Updated Agent Execution

### gRPC Server

```python
# emery-agents/src/emery_agents/grpc/server.py

from ..infrastructure.storage import create_workspace_storage


class AgentWorkerServiceImplementation:
    def __init__(self):
        self.workspace_storage = create_workspace_storage()
        # ... rest of init

    async def ExecuteTask(self, request, context):
        org_id = request.organization_id
        agent_id = str(request.agent_id)

        # Get workspace path - instant, no download!
        workspace_path = self.workspace_storage.get_workspace_path(org_id, agent_id)

        try:
            # Prepare task history
            task_id = str(request.task_id)
            history_dir = self._prepare_task_history(workspace_path, task_id)

            # Execute task
            async for event in self._execute_task(request, workspace_path, history_dir):
                yield event

        finally:
            # Rotate old history (async, non-blocking)
            self.workspace_storage.rotate_history(org_id, agent_id, max_days=30)

    def _prepare_task_history(self, workspace_path: Path, task_id: str) -> Path:
        """Create history directory for this task."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        history_dir = workspace_path / "history" / date_str / task_id
        history_dir.mkdir(parents=True, exist_ok=True)

        # Create empty session log
        (history_dir / "session.jsonl").touch()

        return history_dir
```

---

## 4. Infrastructure

### Docker Compose (Development)

```yaml
# docker-compose.yml

services:
  agent-worker:
    build: ./emery-agents
    environment:
      - WORKSPACE_STORAGE_PATH=/data/workspaces
    volumes:
      - workspace-data:/data/workspaces

  api-server:
    build: .
    environment:
      - WORKSPACE_STORAGE_PATH=/data/workspaces
    volumes:
      - workspace-data:/data/workspaces  # Same volume!

volumes:
  workspace-data:
    driver: local
```

### AWS CDK (Production)

```python
# infra/cdk/stacks/app_stack.py

from aws_cdk import (
    aws_efs as efs,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    RemovalPolicy,
)


class AppStack(Stack):
    def __init__(self, scope, id, vpc, **kwargs):
        super().__init__(scope, id, **kwargs)

        # ============================================
        # Shared Filesystem (EFS)
        # ============================================

        self.workspace_fs = efs.FileSystem(
            self,
            "WorkspaceFS",
            vpc=vpc,
            removal_policy=RemovalPolicy.RETAIN,

            # Performance
            performance_mode=efs.PerformanceMode.GENERAL_PURPOSE,
            throughput_mode=efs.ThroughputMode.BURSTING,

            # Cost: move old files to cheaper tier
            lifecycle_policy=efs.LifecyclePolicy.AFTER_30_DAYS,

            # Security
            encrypted=True,
        )

        # ============================================
        # Mount in Agent Container
        # ============================================

        agent_task_def.add_volume(
            name="workspace-storage",
            efs_volume_configuration=ecs.EfsVolumeConfiguration(
                file_system_id=self.workspace_fs.file_system_id,
                transit_encryption="ENABLED",
            ),
        )

        agent_container.add_mount_points(
            ecs.MountPoint(
                container_path="/mnt/storage/workspaces",
                source_volume="workspace-storage",
                read_only=False,
            )
        )

        agent_container.add_environment(
            "WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces"
        )

        # ============================================
        # Mount in API Container (for Tauri sync)
        # ============================================

        frontend_task_def.add_volume(
            name="workspace-storage",
            efs_volume_configuration=ecs.EfsVolumeConfiguration(
                file_system_id=self.workspace_fs.file_system_id,
                transit_encryption="ENABLED",
            ),
        )

        frontend_container.add_mount_points(
            ecs.MountPoint(
                container_path="/mnt/storage/workspaces",
                source_volume="workspace-storage",
                read_only=False,
            )
        )

        frontend_container.add_environment(
            "WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces"
        )

        # ============================================
        # Security: Allow access from both services
        # ============================================

        self.workspace_fs.connections.allow_default_port_from(agent_service)
        self.workspace_fs.connections.allow_default_port_from(frontend_service)
```

### Alternative Clouds

```bash
# Azure (Azure Files)
WORKSPACE_STORAGE_PATH=/mnt/azure/workspaces

# GCP (Filestore)
WORKSPACE_STORAGE_PATH=/mnt/filestore/workspaces

# Self-hosted (NFS)
WORKSPACE_STORAGE_PATH=/mnt/nfs/workspaces
```

---

## 5. Tauri Client Updates

The Tauri client needs minor updates to call the new endpoints:

```rust
// src-tauri/src/workspace_sync.rs

// Change API endpoints from:
//   /api/agents/{id}/workspace/download
//   /api/agents/{id}/workspace/upload
//
// To:
//   /api/agents/{id}/workspace/signatures  (GET)
//   /api/agents/{id}/workspace/sync/pull   (POST)
//   /api/agents/{id}/workspace/sync/push   (POST)

// The delta sync logic stays the same - just different endpoints
```

---

## Summary

### What's Removed
- S3 for workspace storage
- Download/upload per task
- tar.gz archives

### What's Added
- Shared filesystem (EFS/NFS)
- Direct API ↔ filesystem access
- Instant workspace access for agents

### Files to Create

| File | Purpose |
|------|---------|
| `emery-agents/.../storage/workspace_storage.py` | Abstract interface |
| `emery-agents/.../storage/shared_filesystem_storage.py` | Implementation |
| `emery-agents/.../storage/__init__.py` | Factory |
| `src/app/api/agents/[id]/workspace/signatures/route.ts` | Get file hashes |
| `src/app/api/agents/[id]/workspace/sync/pull/route.ts` | Pull changed files |
| `src/app/api/agents/[id]/workspace/sync/push/route.ts` | Push changed files |

### Files to Modify

| File | Change |
|------|--------|
| `emery-agents/.../grpc/server.py` | Use new storage |
| `docker-compose.yml` | Add shared volume |
| `infra/cdk/stacks/app_stack.py` | Add EFS |

### Cost Comparison

| Scenario | Old (S3 sync) | New (EFS) |
|----------|-------------:|----------:|
| 100 agents, 500MB, 1000 tasks/month | $5,700/mo | $15/mo |
| 100 agents, 50MB, 1000 tasks/month | $570/mo | $1.50/mo |

### Benefits

1. **Zero per-task transfer cost** - no download/upload
2. **Instant workspace access** - no latency
3. **Large workspaces supported** - git repos, builds, node_modules
4. **Simpler architecture** - no S3 middleman
5. **Cloud-agnostic** - works with any mounted filesystem
