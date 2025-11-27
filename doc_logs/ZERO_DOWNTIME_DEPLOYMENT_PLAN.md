# Zero-Downtime Migration Deployment Architecture

## Overview
This document outlines the zero-downtime deployment strategy using ECS init containers to ensure database migrations complete before application services start.

## Problem Solved
**Previous Issue:** Services would start immediately after deployment with new code expecting updated database schema, but migrations ran separately, causing service failures until migrations completed.

**Solution:** Init containers run migrations as a prerequisite before main application containers start, ensuring services never start with mismatched database schema.

## Architecture Pattern

### Init Container Flow
```
ECS Task Startup:
1. Init Container starts → Runs `pnpm db:migrate`
2. Migration completes successfully → Init Container exits(0)
3. Main Container starts → Application serves traffic
4. If migration fails → Main Container never starts, old services continue
```

### Deployment Timeline
```
10:00:00 - CDK deployment begins
           OLD SERVICES: Running and serving traffic ✅

10:00:05 - New task definitions created
           OLD SERVICES: Still serving traffic ✅

10:00:10 - NEW tasks start with init containers
           OLD SERVICES: Still serving traffic ✅
           NEW SERVICES: Waiting (init containers running migrations)

10:00:30 - Migrations complete successfully  
           OLD SERVICES: Still serving traffic ✅
           NEW SERVICES: Main containers now starting

10:00:45 - NEW services healthy and ready
           OLD SERVICES: Still serving traffic ✅
           LOAD BALANCER: Health checking new services

10:01:00 - Traffic switches to NEW services
           OLD SERVICES: Graceful shutdown begins
           NEW SERVICES: Serving all traffic ✅

10:01:30 - OLD services fully stopped
           NEW SERVICES: Fully operational ✅
```

## Implementation Details

### Service Configuration
Each service requiring database access includes:
- **Migration Init Container**: Runs migrations before main container
- **Main Application Container**: Starts only after successful migration
- **Container Dependency**: Explicit dependency ensuring init container success

### Error Handling
- **Migration Failure**: New services never start, old services continue indefinitely
- **Service Failure**: Standard ECS health checks and restarts apply
- **Rollback**: Previous task definition remains available for instant rollback

### Monitoring
Migration logs available in CloudWatch:
- `/aws/ecs/Dev-Migration-Init` - Frontend migration logs
- `/aws/ecs/Dev-Scheduler-Migration` - Scheduler migration logs

## Benefits

### Zero Downtime
- Old services continue serving during entire deployment process
- Traffic switches only when new services are fully ready
- No service interruption during schema changes

### Safe Deployments
- Services guaranteed to start with correct database schema
- Failed migrations prevent broken service deployments
- Automatic rollback capability if deployment fails

### Operational Excellence
- No manual migration steps required
- Clear visibility into migration status
- Industry-standard deployment pattern

## Services Using Init Containers

### Frontend Service
- **Init Container**: Runs database migrations
- **Main Container**: Next.js application server
- **Dependency**: Main waits for init container SUCCESS condition

### Scheduler Service  
- **Init Container**: Runs database migrations
- **Main Container**: Scheduler daemon
- **Dependency**: Main waits for init container SUCCESS condition

### Agent Service
- **No init container**: Python gRPC service doesn't require database migrations

## Comparison with Industry Standards

This pattern matches deployment strategies used by:
- **Netflix**: Microservice rolling deployments
- **Uber**: Platform update orchestration
- **AWS**: Internal service deployments  
- **Kubernetes**: Blue-green deployment pattern

## Deployment Commands

```bash
# Deploy with zero-downtime migration
cdk deploy Emery-Infra-Dev

# Monitor migration progress
aws logs tail /aws/ecs/Dev-Migration-Init --follow
aws logs tail /aws/ecs/Dev-Scheduler-Migration --follow

# Rollback if needed (uses previous task definition)
aws ecs update-service --cluster DevEmeryCluster --service Dev-Frontend --task-definition previous-arn
```

## Verification Steps

After deployment:
1. **Check service health**: All services should show RUNNING status
2. **Verify database schema**: New migrations should be applied
3. **Test application functionality**: Ensure services work with new schema
4. **Monitor logs**: Confirm no errors in application or migration logs

This architecture ensures reliable, zero-downtime deployments even with breaking database schema changes.