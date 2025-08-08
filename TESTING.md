# Testing Guide

This guide covers testing the automatic agent scheduling system with real authentication.

## Authentication Overview

⚠️ **IMPORTANT**: All development bypasses have been removed. You must use real authentication.

The system supports two authentication methods:

### 1. NextAuth Sessions (Browser-based)
- **Best for**: Manual testing, UI workflows
- **How**: Log in via browser OAuth (GitHub/Google)
- **Usage**: Session cookies sent automatically

### 2. User API Keys (Automation)
- **Best for**: Automated testing, CI/CD, scripts
- **Format**: `user_<48-char-hex>`  
- **How**: `Authorization: Bearer user_...` header
- **Usage**: Generate via `scripts/setup-user-auth.ts`

## Quick Setup

1. **Start services**:
   ```bash
   docker-compose up -d
   pnpm db:migrate  
   pnpm dev
   ```

2. **Create user account**: Log in via browser at http://localhost:3000 (OAuth)

3. **Setup authentication**:
   ```bash
   npx tsx scripts/setup-user-auth.ts
   ```

4. **Run integration test**:
   ```bash
   npx tsx scripts/integration-test-api-auth.ts
   ```

## Integration Tests

### Recommended: API Key Authentication Test

**File:** `scripts/integration-test-api-auth.ts`

✅ **Advantages**:
- No browser session required
- Reliable authentication  
- Perfect for automation
- Already configured with your credentials

```bash
npx tsx scripts/integration-test-api-auth.ts
```

### Alternative: Browser Session Test  

**File:** `scripts/integration-test-production.ts`

Requires active browser login session:

```bash
# Must be logged in via browser first
npx tsx scripts/integration-test-production.ts
```

## Authentication Setup

### Getting Your Credentials

Run the setup script to get your user ID and API key:

```bash
npx tsx scripts/setup-user-auth.ts
```

**Output Example**:
```
📋 Use this configuration for integration tests:
const USER_ACCOUNT_ID = 'ef5b5ea0-19bf-4e8c-bb03-4f027130efd7';
const USER_ORGANIZATION_ID = 1;

🔐 API Key Authentication:
export USER_API_KEY="user_2c254018f6828a8569816162dfb20b9a470cbd4beeb89890"
```

### API Usage Examples

```bash
# Set your API key
export USER_API_KEY="user_2c254018f6828a8569816162dfb20b9a470cbd4beeb89890"

# Test authentication
curl -H "Authorization: Bearer $USER_API_KEY" \
     http://localhost:3000/api/scheduler/status

# Create agent  
curl -X POST -H "Authorization: Bearer $USER_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Agent","role":"assistant","organizationId":1}' \
     http://localhost:3000/api/agents

# List tasks
curl -H "Authorization: Bearer $USER_API_KEY" \
     http://localhost:3000/api/tasks
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