# Event-Driven Agent Scheduler

Modern event-driven scheduling system for Emery agents with PostgreSQL LISTEN/NOTIFY and automatic RAG reindexing.

## Architecture

The scheduler implements a **pure event-driven architecture** with fallback polling:

- **Real-time events**: PostgreSQL LISTEN/NOTIFY for instant task processing
- **Auto RAG reindexing**: Automatic reindexing when data changes
- **Fallback timer**: 5-minute intervals for scheduled (CALENDAR) tasks
- **DDD Architecture**: Clean separation with EventDrivenScheduler orchestrating services

## Quick Start

```bash
# Start the event-driven scheduler
pnpm scheduler:start

# Or run directly
tsx scripts/run-scheduler.ts
```

## Event Types

The scheduler handles these PostgreSQL notification events:

### Task Events
- `task_event` - New agent tasks (MANUAL triggers)
  - Processed immediately via TaskSchedulingApplicationService

### RAG Events  
- `rag_reindex_needed` - Data changes requiring reindexing
  - Organizations, agents, or tables modified
  - Debounced and processed via RagIndexingApplicationService

### Scheduled Events (Timer-based)
- **CALENDAR triggers** - RRule-based scheduling (daily, weekly, monthly)
- **Timeouts** - Handle stuck tasks
- **Retries** - Exponential backoff for failed tasks

## Trigger Types Supported

- ✅ **MANUAL** - Immediate execution (via database events)
- ✅ **CALENDAR** - RRule scheduling (via timer polling)
- ✅ **RAG_REINDEX** - Auto reindexing (via database events)
- 🚧 **DATABASE_EVENT** - Table change triggers (planned)
- 🚧 **WEBHOOK** - HTTP-triggered tasks (planned)

## Environment Variables

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5433/emery
NODE_ENV=development
```

## Architecture Components

### EventDrivenScheduler (`scripts/run-scheduler.ts`)
- Central orchestrator for all trigger types
- PostgreSQL event listeners
- RAG reindex debouncing
- Fallback timer for scheduled tasks

### TaskSchedulingApplicationService
- Individual task execution
- Task lifecycle management (start, complete, fail, timeout)
- gRPC agent integration

### RagIndexingApplicationService  
- Automatic data reindexing
- Handles organization, agent, and table changes
- Incremental reindexing for performance

## Container Deployment

```bash
# Build and run scheduler
docker build -f Dockerfile.scheduler -t emery-scheduler .
docker run -d --name emery-scheduler --env-file .env.local emery-scheduler
```

## Monitoring

The scheduler provides detailed logging:
- 🚀 Startup and configuration
- 📨 Real-time event processing  
- ⏰ Scheduled task execution
- 🔄 RAG reindexing operations
- ❌ Error handling and retries

## Development

The scheduler auto-initializes DI containers and connects to the database. It runs continuously, processing events as they arrive and falling back to timer-based polling for scheduled tasks.