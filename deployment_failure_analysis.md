# Deployment Failure Analysis - Emery-App-Dev Stack

## Summary
The deployment **FAILED** and rolled back at 10:45 AM after running for ~3.5 hours.
- **Stack Status**: ROLLBACK_COMPLETE
- **Failed Resource**: DevAgentTableService ("Exceeded attempts to wait" - NotStabilized)
- **Root Cause**: ECS services couldn't stabilize - tasks repeatedly failed health checks

## Key Finding: Services Were Starting Successfully

### Evidence from CloudWatch Logs

**Dev-Agent-Table Service (8 successful starts):**
```
07:57:08 → ✅ Table gRPC server started successfully
08:13:23 → ✅ Table gRPC server started successfully (restart after 16.2 min)
08:29:02 → ✅ Table gRPC server started successfully (restart after 15.7 min)
08:44:05 → ✅ Table gRPC server started successfully (restart after 15.1 min)
08:59:10 → ✅ Table gRPC server started successfully (restart after 15.1 min)
09:14:34 → ✅ Table gRPC server started successfully (restart after 15.4 min)
09:29:53 → ✅ Table gRPC server started successfully (restart after 15.3 min)
09:44:46 → ✅ Table gRPC server started successfully (restart after 14.9 min)
```

**Dev-Agent-Chat Service (4 successful starts):**
```
08:01:39 → ✅ Chat gRPC server started successfully
08:16:37 → ✅ Chat gRPC server started successfully (restart after 15.0 min)
08:32:05 → ✅ Chat gRPC server started successfully (restart after 15.5 min)
08:47:09 → ✅ Chat gRPC server started successfully (restart after 15.1 min)
```

**Average Task Lifetime**: ~15.2 minutes before being killed

## The Paradox

**What's Working:**
- ✅ Containers starting successfully
- ✅ gRPC servers binding to ports (50051, 50052)
- ✅ Servers logging "started successfully"
- ✅ No Python errors or crashes
- ✅ Frontend service running
- ✅ Image pull working (4.5GB agent image)

**What's Failing:**
- ❌ NLB TCP health checks consistently failing
- ❌ Tasks marked unhealthy and killed every ~15 minutes
- ❌ CloudFormation service never reaches "stable" state
- ❌ After 3.5 hours, CloudFormation gives up with "NotStabilized"

## Timeline Analysis

**Grace Period:** 5 minutes (300 seconds)
**Health Check Configuration:**
- Interval: 30 seconds
- Timeout: 10 seconds
- Healthy threshold: 2 consecutive passes
- Unhealthy threshold: 2 consecutive failures
- Protocol: TCP (simple connection test to port)

**Expected Behavior:**
1. Task starts → grace period (5 min) → health checks begin
2. If healthy: 2 passes (1 min) → marked healthy → runs indefinitely
3. If unhealthy: 2 failures (1 min) → marked unhealthy → killed
4. Min time to fail: 5 min (grace) + 1 min (checks) = 6 minutes

**Observed Behavior:**
- Tasks consistently run for ~15 minutes then get killed
- This is 2.5x longer than minimum failure time
- Suggests tasks ARE passing some health checks initially
- But then failing later (after grace period ends)

## Possible Root Causes

### 1. **TCP Health Check Port Mismatch** (Most Likely)
The health check specifies `port="50052"` as a string. In CDK/CloudFormation:
- String port might not resolve correctly
- Could be checking wrong port
- Or using traffic-port incorrectly

**Fix**: Change `port="50052"` to `port=50052` (integer) or use `port="traffic-port"`

**Location**: infra/infra/app_stack.py:498, 405

### 2. **Security Group Configuration**
The NLB might not have proper security group rules to reach the ECS tasks:
- NLB → ECS task communication blocked
- Health check packets not reaching container
- But application traffic might be using different path

**Verify**: Check security group ingress rules for ECS tasks

### 3. **Target Group Deregistration**
With deployment config `minimumHealthyPercent=0`, ECS might be:
- Deregistering tasks from target group prematurely
- Starting new tasks before old ones fully drained
- Creating race condition in health checks

**Location**: infra/infra/app_stack.py:432-435

### 4. **gRPC Health Check Protocol Issue**
TCP health checks just test connection establishment. They don't verify:
- gRPC server is actually ready to handle requests
- gRPC health check protocol (grpc.health.v1.Health)
- Server might accept connections but not be fully initialized

**Consider**: Implementing gRPC health check service

### 5. **Network/VPC Configuration**
- IPv6 vs IPv4 mismatch (server binds to [::], NLB uses IPv4)
- Private subnet routing issues
- NAT gateway connectivity
- DNS resolution problems

## Why CloudFormation Failed

CloudFormation waits for ECS service to "stabilize":
- Desired count = running count
- All tasks healthy in target group
- No tasks replacing/draining

With tasks constantly restarting every ~15 min:
- Service never stabilizes
- CloudFormation timeout: ~3 hours
- After timeout → "Exceeded attempts to wait" → ROLLBACK

## Recommended Fixes (in priority order)

### Priority 1: Fix Health Check Port Configuration
```python
# Change from string to integer or use "traffic-port"
agent_table_service.target_group.configure_health_check(
    port=50052,  # Integer, not string "50052"
    protocol=elbv2.Protocol.TCP,
    interval=Duration.seconds(30),
    timeout=Duration.seconds(10),
    healthy_threshold_count=2,
    unhealthy_threshold_count=2,
)
```

### Priority 2: Increase Grace Period
```python
health_check_grace_period=Duration.seconds(600),  # 10 minutes instead of 5
```

### Priority 3: Relax Health Check Thresholds
```python
agent_table_service.target_group.configure_health_check(
    port=50052,
    protocol=elbv2.Protocol.TCP,
    interval=Duration.seconds(30),
    timeout=Duration.seconds(10),
    healthy_threshold_count=3,  # Need 3 passes (was 2)
    unhealthy_threshold_count=3,  # Need 3 failures (was 2)
)
```

### Priority 4: Adjust Deployment Configuration
```python
cfn_chat_service.deployment_configuration = {
    "minimumHealthyPercent": 100,  # Keep old task running
    "maximumPercent": 200  # Allow new task to start
}
```

### Priority 5: Add gRPC Health Check Service
Implement proper gRPC health checking in emery-agents/src/emery_agents/grpc/server.py

## Next Steps

1. Apply Priority 1-3 fixes to infra/infra/app_stack.py
2. Commit changes and trigger new deployment
3. Monitor CloudWatch logs for successful startup
4. Check ECS service events for health check status
5. Verify target group health shows tasks as "healthy"
6. Wait for CloudFormation to report CREATE_COMPLETE

## Files to Modify

- `infra/infra/app_stack.py` - Lines 380, 404-411, 432-435, 473, 497-504
