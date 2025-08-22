# Emery Agent Scheduler

Event-driven scheduling system for Emery agents using Domain-Driven Design architecture.

## Architecture

The scheduler implements a hybrid approach:
- **Timer-based fallback**: Periodic checks every 5 minutes for reliability
- **Real-time event callbacks**: PostgreSQL LISTEN/NOTIFY for instant responsiveness
- **DDD Architecture**: Clean separation between domain, application, and infrastructure layers

## Available Scripts

```bash
# Build and start scheduler (single command for all environments)
pnpm scheduler:start

# Build only (for container deployment)
pnpm scheduler:build
```

## Container Deployment

### Using the provided Dockerfile:
```bash
# Build the container
docker build -f Dockerfile.scheduler -t emery-scheduler .

# Run the container
docker run -d \
  --name emery-scheduler \
  --env-file .env.local \
  --network host \
  emery-scheduler
```

### Key features:
- **4.5MB bundled output** with all dependencies included
- **Node 20 Alpine** base image for minimal size
- **Non-root user** for security
- **Health checks** included
- **Production optimized** with proper memory limits

## Event Types

The scheduler responds to these database events:
- `task_created` - New agent tasks
- `scheduled_job_due` - CRON scheduled jobs
- `table_changed` - Database table modifications
- `periodic_check` - Fallback timer events

## Configuration

Environment variables required:
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)

Optional configuration:
- `SCHEDULER_TIMEZONE` - Timezone for CRON jobs (default: UTC)
- `MAX_CONCURRENT_TASKS` - Maximum concurrent task execution (default: 10)

## Monitoring

The scheduler provides built-in logging and monitoring:
- Real-time status updates
- Event processing counts
- Error tracking and reporting
- Database connection health checks

## Dependencies

All dependencies are bundled in the esbuild output. External dependencies that require runtime availability:
- `pg-native` (optional PostgreSQL optimization)
- `sharp` (image processing, optional)
- `canvas` (optional for advanced processing)

## Development Notes

- Uses TSX for development with hot-reload support
- ESBuild handles all TypeScript compilation and bundling
- Path mappings (`@/*`) are properly resolved in the bundle
- Source maps included for debugging
- All DDD infrastructure dependencies are included

## Testing

```bash
# Test the scheduler system
pnpm test:scheduler

# Run GRPC integration tests
pnpm test:grpc
```