# Testing the Automatic Agent Scheduling System

The system now supports **dual authentication**: NextAuth sessions (production) and user API keys (automation/testing).

## Recommended: Automated Integration Test 

**File:** `scripts/integration-test-final.ts`

Fully automated test using the new **user API key system**. No manual browser login required.

### How to Run

```bash
# Start NextJS server
pnpm dev

# Run the automated test
npx tsx scripts/integration-test-final.ts
```

### What It Does

- ✅ Creates test user with **user API key** (management APIs)
- ✅ Creates agents with **agent API keys** (OAuth proxy)  
- ✅ Tests hybrid authentication system
- ✅ Monitors automatic CRON scheduling
- ✅ No browser session required
- ✅ Perfect for CI/CD automation

## Authentication Architecture

The system now has **two API key types**:

### 1. User API Keys (`user_...`)
- **Purpose**: Management APIs (create agents, check tasks, control scheduler)
- **Endpoints**: `/api/agents`, `/api/tasks`, `/api/scheduler/status`, `/api/tables`
- **Format**: `user_48charshex`
- **Stored**: `users.apiKey` column
- **Use**: Automation, testing, external integrations

### 2. Agent API Keys (`ag_...`)  
- **Purpose**: OAuth proxy calls only
- **Endpoints**: `/api/agents/proxy`
- **Format**: `ag_30chars`
- **Stored**: `agents.apiKey` column
- **Use**: Agent OAuth actions (Gmail, Slack, etc.)

### API Usage Examples

```bash
# User API key - Create agent
curl -H "Authorization: Bearer user_abc123..." \
  POST /api/agents -d '{"name":"My Agent",...}'

# Agent API key - OAuth call  
curl -H "Authorization: Bearer ag_xyz789..." \
  POST /api/agents/proxy -d '{"service":"gmail","action":"send_email",...}'
```

---

## Alternative: Production Test (Manual Login)

**File:** `scripts/integration-test-production.ts`

Requires manual browser authentication for testing with real NextAuth sessions.

### Prerequisites

1. **User Account**: You must have a valid user account in the application
2. **Authentication**: You must be logged in via the web interface
3. **User ID**: You need to know your user ID from the database

### How to Run the Test

1. **Start the NextJS server:**
   ```bash
   pnpm dev
   ```

2. **Log in to the application:**
   - Open http://localhost:3000 in your browser
   - Complete the OAuth login process
   - Keep your browser session active

3. **Find your User ID:**
   - Check the `users` table in your database, OR
   - Inspect the NextAuth session in browser dev tools, OR
   - Check the UI for your user profile information

4. **Update the test configuration:**
   ```bash
   # Edit the test file
   nano scripts/integration-test-production.ts
   
   # Update this line with your actual user ID:
   const USER_ACCOUNT_ID = 'your-actual-user-id-here';
   ```

5. **Run the integration test:**
   ```bash
   npx tsx scripts/integration-test-production.ts
   ```

### What the Test Does

The test will:
- ✅ Verify your authentication session
- ✅ Start the Python gRPC worker
- ✅ Initialize the agent scheduler
- ✅ Create CRON and webhook agents
- ✅ Monitor task execution for 2.5 minutes
- ✅ Report on scheduler functionality

### Expected Results

```
🧪 PRODUCTION AGENT SCHEDULING INTEGRATION TEST
===============================================

📋 Test Configuration:
   User Account ID: [your-user-id]
   Organization ID: 1
   ⚠️  This test requires you to be logged in to the application

1️⃣  Starting services...
   🌐 NextJS server is already running
   🐍 Starting Python worker...
✅ Services ready

2️⃣  Testing authentication...
✅ Authentication successful - user session active

3️⃣  Initializing scheduler...
   Running: true
   Existing CRON jobs: X
✅ Scheduler initialized

4️⃣  Testing agent creation...
✅ CRON agent created (ID: XX)
✅ Webhook agent created (ID: XX)

5️⃣  Monitoring task execution...
   ⏱️  Waiting 150 seconds for CRON execution...
   📊 Final scheduler status:
      Running: true
      CRON jobs: X
   📋 Task execution summary:
      Total tasks: XX
      Recent tasks (3 min): X
      ✅ Completed: X
      ❌ Failed: X
      🔄 In Progress: X
      ⏳ Pending: X

🎉 SUCCESS: Automatic scheduling is working with production authentication!

============================================================
📊 PRODUCTION INTEGRATION TEST RESULTS
============================================================
✅ NextAuth session authentication: Working
✅ No development bypasses: Confirmed
✅ Scheduler initialization: Working
✅ Agent creation with real user: Working
✅ Task execution pipeline: Working

🚀 Production automatic agent scheduling system is operational!
```

### Troubleshooting

**Authentication Failed:**
- Make sure you're logged in to the application in your browser
- Ensure your browser session cookies are being sent
- Check that your user ID is correct

**Agent Creation Failed:**
- Verify your user belongs to an organization
- Check that your organization ID exists in the database
- Ensure your user has proper permissions

**No Task Execution:**
- Verify the Python gRPC worker is running
- Check the scheduler is actually started
- Look at the application logs for errors

## No Development Bypasses

The system now has **NO** authentication bypasses:
- ❌ No `x-test-user-id` header support
- ❌ No Bearer token workarounds  
- ❌ No hardcoded test user IDs
- ❌ No development-only authentication paths

All authentication must go through NextAuth sessions with proper OAuth login.

## Database Requirements

Make sure your database has:
- A valid user record with your user ID
- An organization that your user belongs to
- Proper foreign key relationships

You can create these through the normal application signup/login flow.