# Emery - AI Agent Orchestration Platform

Emery is an enterprise AI agent orchestration platform that combines dynamic database management with intelligent automation. Built with Next.js, Drizzle ORM, and PostgreSQL, it enables organizations to create custom databases and deploy AI agents that can interact with external services through OAuth integrations.

## 🎯 What Emery Does

**For Product Managers:**
- **Dynamic Database Builder**: Create custom tables and fields on-demand without database migrations
- **AI Agent Orchestration**: Deploy intelligent agents that can perform complex workflows automatically  
- **OAuth Service Integration**: Connect agents to external services (Gmail, Slack, GitHub, etc.) using user credentials
- **Enterprise RBAC**: Multi-tenant organization management with role-based permissions
- **Task Management**: Track and monitor agent execution with detailed logging

**Business Value:**
- Eliminate custom database schema deployments - create tables instantly through UI
- Automate repetitive workflows across multiple external services  
- Secure credential delegation - agents use user OAuth tokens, not system credentials
- Scale agent operations across teams with proper access controls

## 🏗️ System Architecture

### Dual Database Approach
- **Static Schema**: Drizzle ORM manages core entities (users, agents, organizations, permissions)
- **Dynamic Tables**: Runtime table creation using raw SQL with `field_{id}` column naming (Baserow-style)
- **OAuth Integration**: Pipedream Connect for secure credential delegation to agents

### Tech Stack
- **Frontend**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + Server Actions
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Drizzle ORM (static) + Raw SQL (dynamic operations)  
- **Authentication**: NextAuth v4 with OAuth providers
- **Agent Runtime**: Python execution environment with MCP tool integration
- **OAuth Proxy**: Pipedream Connect for external service integrations

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up PostgreSQL database**:
   ```bash
   docker-compose up -d
   ```
   This will start a PostgreSQL database with pgvector extension on port 5433.

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```
   The default configuration works with the Docker database. Environment variables are automatically loaded by:
   - Next.js (from `.env.local`)
   - Drizzle Kit (via dotenv)
   - All API routes and database connections

4. **Generate and run migrations**:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Start development server**:
   ```bash
   pnpm dev
   ```

6. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000)

7. **First-time setup**:
   - Create account via OAuth (GitHub/Google)
   - Set up organization and invite team members
   - Create your first agent in `/dashboard/manage`
   - Connect OAuth services in `/dashboard/connections`

## 📁 Project Structure

```
/app
  /api
    /agents      # Agent management & OAuth proxy
    /tasks       # Task execution tracking
    /fields      # Dynamic field operations  
    /rows        # Dynamic table data operations
  /dashboard     # Main application UI
    /agents      # Agent detail pages
    /connections # OAuth service management
    /manage      # Admin interfaces
    - TableEditor.tsx    # Dynamic table editor

/lib
  /db
    - schema.ts    # Static Drizzle schema (users, agents, tasks)
    - dynamic.ts   # Dynamic table operations (Baserow-style)
    - client.ts    # Database connections
  /pipedream     # OAuth integration layer
  - auth.ts      # NextAuth configuration with RBAC

/emery-agents  # Python agent runtime
  /src/emery_agents
    - cli.py       # Agent CLI interface
    - runner.py    # Task execution engine
    /integrations  # External service clients
```

## 🧠 Core Concepts

### 1. Dynamic Database Management
- **Tables**: Created at runtime without migrations using `CREATE TABLE` SQL
- **Fields**: Column naming follows `field_{id}` pattern for consistency
- **Data Types**: Support for text, number, boolean, date, email, URL, and JSONB relations
- **Baserow Compatibility**: Similar UX to popular no-code database platforms

### 2. AI Agent System
- **Agents**: Configurable AI assistants with specific roles and capabilities
- **Tasks**: Discrete work units assigned to agents with payload data
- **Capabilities**: Pre-defined workflows agents can execute (e.g., "send_email", "analyze_data")
- **Step Execution**: Granular tracking of each step within a task for debugging

### 3. OAuth Credential Delegation
- **User-Owned Credentials**: Agents use the OAuth tokens of their owners, not system credentials
- **Service Integration**: Gmail, Slack, GitHub, Google Sheets, Discord, Twitter support
- **Secure Proxy**: Universal `/api/agents/proxy` endpoint for all OAuth API calls
- **Connection Management**: Users control which services their agents can access

### 4. Enterprise RBAC
- **Organizations**: Multi-tenant isolation with shared tools and databases
- **Teams**: Group users with specific purposes and agent access
- **Roles**: Hierarchical permissions (Super Admin → Admin → Editor → Viewer)
- **Permissions**: Granular access control for agents, databases, and administration

## 🔌 API Endpoints

### Agent Management
- `POST /api/tasks` - Create task for agent execution
- `GET /api/agents/{id}/capabilities` - Get agent capabilities and connected services
- `POST /api/agents/{id}/execute` - Execute agent action (with webhook support)

### OAuth Proxy  
- `POST /api/agents/proxy` - Universal OAuth proxy for all external service calls
- Uses agent owner's connected OAuth credentials automatically

### Dynamic Database
- `POST /api/fields` - Add field to dynamic table
- `GET /api/fields?tableId={id}` - List table fields
- `POST /api/rows` - Insert row into dynamic table
- `GET /api/rows?tableId={id}` - Query dynamic table data
- `PUT /api/rows` - Update row data
- `DELETE /api/rows?tableId={id}&rowId={id}` - Delete row

### Example: Agent API Call
```bash
# Create a task for an agent
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Authorization: Bearer agent_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": 1,
    "name": "Send Welcome Email",
    "capabilityName": "send_email",
    "payload": {
      "recipient": "user@example.com",
      "subject": "Welcome!",
      "body": "Thanks for joining."
    }
  }'
```

## ⚙️ Development Commands

### Database Operations
```bash
# PostgreSQL with Docker
docker-compose up -d              # Start PostgreSQL + pgvector
docker-compose down               # Stop database
docker volume rm emery_db         # Reset database (deletes all data)

# Schema Management
pnpm db:generate                  # Generate Drizzle migrations
pnpm db:migrate                   # Apply migrations  
pnpm db:studio                    # Open Drizzle Studio UI
```

### Application Development
```bash
pnpm dev                         # Next.js development server
pnpm build                       # Production build
pnpm lint                        # ESLint code quality checks

# Agent Testing
uv run scripts/test_integration.py <agent_id>  # Test Python agent integration
pnpm test:agent-api <agent_id>   # Test agent API endpoints
```

### Environment Configuration
```bash
# Required for OAuth integration
PIPEDREAM_PROJECT_ID=your_project_id
PIPEDREAM_CLIENT_ID=your_client_id  
PIPEDREAM_CLIENT_SECRET=your_client_secret
PIPEDREAM_API_KEY=your_api_key

# NextAuth setup
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
GITHUB_ID=your_github_oauth_id
GITHUB_SECRET=your_github_oauth_secret
```

## 🎯 Use Cases

### For Engineering Teams
- **No-Code Database Creation**: Product managers can create tables without engineering sprints
- **External API Integration**: Agents handle complex OAuth workflows with external services  
- **Workflow Automation**: Automate repetitive tasks across Gmail, Slack, GitHub, etc.
- **Audit Trail**: Complete execution logs for debugging and compliance

### For Product Teams  
- **Rapid Prototyping**: Create custom data models instantly for feature validation
- **Customer Onboarding**: Agents can automatically send welcome emails, create Slack channels
- **Data Analysis**: Agents can pull data from multiple sources and generate reports
- **Integration Management**: Users control which services their agents can access

## 🔒 Security Features

- **OAuth Credential Delegation**: Agents never store credentials, they use live user tokens
- **RBAC Enforcement**: Fine-grained permissions at organization, team, and agent levels  
- **API Key Authentication**: Secure agent-to-platform communication
- **Webhook Signature Verification**: HMAC validation for async task results
- **SQL Injection Prevention**: All dynamic table operations use parameterized queries

## 📈 Roadmap

**Current Release:**
- ✅ Dynamic table creation with custom fields
- ✅ AI agent orchestration with task management
- ✅ OAuth service integration (Gmail, Slack, GitHub)
- ✅ Enterprise RBAC with organizations and teams
- ✅ Python agent runtime with CLI interface

**Next Release:**
- [ ] Real-time task execution monitoring
- [ ] Advanced workflow builder UI
- [ ] Webhook endpoint management
- [ ] Agent marketplace and templates
- [ ] Advanced analytics and reporting
- [ ] Mobile app for task monitoring