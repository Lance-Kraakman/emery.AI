# Organizational Analysis: Guided Agent Autonomy Workflow

## Overview

Organizational Analysis is implemented as a **Guided Platform Feature Built on Agents** - combining the user-friendly experience of a platform feature with pure agent autonomy for execution.

## Architecture: B1 - Guided Platform Feature with Agent Autonomy

### Core Principle
- **Guided Setup**: Platform provides clear UI workflows for initializing organizational analysis
- **Agent Autonomy**: Once created, agents are completely self-managing and autonomous
- **No Orchestration**: No complex application services or orchestration layers
- **Scheduler Integration**: Agents use existing scheduler system with trigger configs

### Flow Overview

```mermaid
flowchart TD
    A[User clicks "Initialize Analysis"] --> B[API creates specialized agents]
    B --> C[Agents get trigger configs]
    C --> D[Scheduler picks up agents]
    D --> E[Agents self-execute tasks]
    E --> F[Domain API tools provide functionality]
    F --> G[Results available via agent outputs]
```

## Implementation Details

### 1. Database Foundation ✅

**Organizations Table:**
- `analysis_capabilities` JSONB field stores organizational analysis configuration
- Used by platform to track which analysis features are enabled
- Guides UI dashboards and feature availability

**Agents Table:**
- `agent_type` field for specialization (`data-collector`, `kpi-calculator`, `process-analyst`)
- `trigger` JSONB field stores agent trigger configurations
- `tools` JSONB field stores agent tool configurations
- `specialization` JSONB field stores agent capabilities

### 2. Python Domain API Tools ✅

**Available Tools:**
- `measurement_api` - 6 actions for measurement collection, KPI calculation, trend analysis
- `process_api` - 6 actions for process analysis, bottleneck identification, performance tracking
- `emery_database` - Database access for data persistence
- `table_data` - Table operations for data management

**Tool Integration:**
- Integrated with smolagents framework
- Available to all agent types based on their specialization
- Agents use tools autonomously based on their instructions

### 3. Agent Type Configurations ✅

**Specialized Agent Types:**
```typescript
'data-collector': {
  defaultTools: ['emery_database', 'table_data', 'measurement_api'],
  description: 'Specialized in collecting raw data from various sources'
}

'kpi-calculator': {
  defaultTools: ['measurement_api', 'emery_database', 'table_data'],
  description: 'Specialized in calculating and tracking organizational KPIs'
}

'process-analyst': {
  defaultTools: ['process_api', 'measurement_api', 'emery_database'],
  description: 'Specialized in analyzing organizational processes'
}
```

### 4. API Endpoints - Lightweight Agent Management ✅

#### Main Analysis API: `/api/organizations/[id]/analysis`

**POST - Initialize Analysis:**
```json
{
  "analysisType": "comprehensive" | "basic",
  "schedule": "manual" | "daily" | "weekly" | "monthly"
}
```
- Creates 3 specialized agents (data-collector, kpi-calculator, process-analyst)
- Sets up trigger configs based on schedule preference
- Returns agent creation status and workflow information

**GET - Analysis Status:**
- Shows which analysis agents exist for the organization
- Returns agent configurations, trigger configs, and capabilities
- Provides dashboard data for UI display

**PATCH - Update Schedules:**
```json
{
  "agentType": "data-collector",
  "triggerConfig": { "type": "CALENDAR", "rrule": "FREQ=DAILY" }
}
```
- Updates trigger configurations for specific agent types
- Allows scheduling adjustments through UI

#### Specialized Status APIs:

- `/api/organizations/[id]/measurements` - Data collector agent status
- `/api/organizations/[id]/processes` - Process analyst agent status  
- `/api/organizations/[id]/kpis` - KPI calculator agent status

Each provides:
- Agent status and activity information
- Tool configurations and capabilities
- Workflow autonomy explanations

## User Experience Workflow

### 1. Analysis Initialization
1. User navigates to Organization → Analysis
2. Clicks "Initialize Organizational Analysis"
3. Selects analysis type (basic/comprehensive) and schedule
4. Platform creates specialized agents with trigger configs
5. Agents immediately become autonomous

### 2. Agent Autonomy Phase
1. **Scheduler Detection**: Event-driven scheduler detects new agents
2. **Trigger Processing**: Agents execute based on their trigger configs
3. **Tool Usage**: Agents use domain API tools (`measurement_api`, `process_api`)
4. **Data Processing**: Agents collect data, calculate KPIs, analyze processes
5. **Results Storage**: Results available through agent task outputs

### 3. Monitoring & Management
1. **Status Dashboards**: View agent activity and recent results
2. **Schedule Adjustments**: Update trigger configs through UI
3. **Agent Management**: Standard agent management applies
4. **Result Access**: View analysis results through agent task history

## Key Benefits

### ✅ **Guided Experience**
- Clear setup workflow for non-technical users
- Platform feature with proper UI integration
- Guided configuration of analysis types and schedules

### ✅ **Pure Agent Autonomy**
- No complex orchestration layers or application services
- Agents are completely self-managing after creation
- Leverages existing scheduler system for isolation

### ✅ **Domain Tool Integration**
- Agents automatically use specialized tools for their functions
- `measurement_api` for data collection and KPI calculation
- `process_api` for workflow analysis and bottleneck identification

### ✅ **Flexible Scheduling**
- Manual triggers for on-demand execution
- Calendar-based scheduling (daily, weekly, monthly)
- Database event triggers for real-time responses
- Webhook triggers for external integrations

### ✅ **Maintainable Architecture**
- Simple agent management patterns
- Leverages existing platform capabilities
- No complex state management or orchestration
- Standard agent lifecycle and monitoring

## Technical Implementation

### Agent Creation Pattern
```typescript
const command = {
  name: `${config.description} - ${organizationId}`,
  role: 'assistant',
  agentType: 'data-collector', // or 'kpi-calculator', 'process-analyst'
  tools: getDefaultToolsForType(agentType), // Auto-configured tools
  trigger: createTriggerConfig(schedule), // Based on user preference
  specialization: getDefaultSpecializationForType(agentType),
  status: 'active'
};

const result = await agentService.createAgent(command);
```

### Trigger Configuration Examples
```typescript
// Daily execution at 9 AM
{
  type: 'CALENDAR',
  rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
  timezone: 'UTC'
}

// Manual execution
{
  type: 'MANUAL',
  enabled: true,
  requiresAuthentication: true
}

// Database event trigger
{
  type: 'DATABASE_EVENT',
  operations: ['INSERT', 'UPDATE'],
  tableId: 'measurement_table'
}
```

### Agent Personas
Each agent type has a specialized persona that guides their behavior:

**Data Collector:**
> "You are a specialized data collection agent focused on gathering accurate organizational measurements. You excel at using the measurement_api tool to collect, validate, and store measurement data from various sources."

**KPI Calculator:**
> "You are a KPI calculation specialist with expertise in mathematical analysis and organizational metrics. You use measurement_api to calculate accurate KPIs and track organizational performance."

**Process Analyst:**
> "You are a process analysis expert specializing in organizational workflow optimization. You use process_api and measurement_api tools to identify bottlenecks, analyze performance, and recommend improvements."

## Future Enhancements

### Potential Agent Types
- `reporter` - Generate executive reports and dashboards
- `coordinator` - Coordinate multi-agent workflows
- `monitor` - Real-time monitoring and alerting

### Advanced Trigger Types
- Threshold-based triggers (when KPI exceeds target)
- Multi-condition triggers (combine time + data events)
- External webhook integrations

### UI Enhancements
- Analysis dashboard with agent activity visualization
- Real-time agent status monitoring
- Interactive trigger configuration interface
- Analysis results visualization and reporting

## Summary

The Organizational Analysis system successfully combines:
- **Platform-guided setup** for user-friendly initialization
- **Pure agent autonomy** for execution and scheduling
- **Domain API tools** for specialized functionality
- **Existing scheduler integration** for isolation and reliability

This approach provides the best of both worlds: a guided platform feature that users can easily configure, built entirely on autonomous agents that require no orchestration or complex state management.