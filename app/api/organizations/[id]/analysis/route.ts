// AIDEV-NOTE: Organizational Analysis API - Guided Platform Feature Built on Agents
// Creates and manages specialized agents for organizational analysis with pure agent autonomy

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/app/actions/permissions';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import { getAgentTypeConfig, getDefaultToolsForType, getDefaultSpecializationForType } from '@/lib/agents/agent-type-configs';
import type { AgentType } from '@/ddd/domain/agents/entities/agent';
import type { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { TriggerConfigs } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export const dynamic = 'force-dynamic';

interface InitializeAnalysisRequest {
  analysisType?: 'comprehensive' | 'basic';
  schedule?: 'manual' | 'daily' | 'weekly' | 'monthly';
}

interface UpdateScheduleRequest {
  agentType: AgentType;
  triggerConfig: TriggerConfig;
}

/**
 * POST /api/organizations/[id]/analysis - Initialize organizational analysis
 * Creates specialized agents (data-collector, kpi-calculator, process-analyst) with trigger configs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("agents:manage");
    const { id } = await params;
    const organizationId = parseInt(id);
    
    if (session.user.currentOrganizationId !== organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body: InitializeAnalysisRequest = await request.json();
    const { analysisType = 'comprehensive', schedule = 'manual' } = body;

    const agentService = getAgentApplicationService();
    const createdAgents = [];

    // Define agents to create based on analysis type
    const agentTypes: AgentType[] = analysisType === 'comprehensive' 
      ? ['data-collector', 'kpi-calculator', 'process-analyst']
      : ['data-collector', 'kpi-calculator'];

    // Create trigger config based on schedule preference
    const triggerConfig: TriggerConfig = createTriggerConfig(schedule);

    // Create each specialized agent
    for (const agentType of agentTypes) {
      const config = getAgentTypeConfig(agentType);
      
      try {
        const command = {
          name: `${config.description} - ${organizationId}`,
          role: 'assistant',
          description: `${config.description} for organizational analysis`,
          persona: createPersonaForAgentType(agentType),
          ownerId: UserId.fromString(session.user.id),
          organizationId: OrganizationId.fromNumber(organizationId),
          roleId: 1, // Default role ID - will be set by application layer
          agentType,
          tools: getDefaultToolsForType(agentType).map(toolName =>
            ToolConfig.create(
              toolName,
              '1.0',
              toolName.includes('_api') ? { organization_id: organizationId.toString() } : {}
            )
          ),
          servers: [],
          trigger: triggerConfig,
          capabilities: [],
          specialization: getDefaultSpecializationForType(agentType),
          status: 'active' as const
        };

        const result = await agentService.createAgent(command);
        if (result.success && result.data) {
          createdAgents.push({
            agentId: result.data.id,
            agentType,
            name: result.data.name,
            tools: command.tools.map(t => t.name)
          });
        }
      } catch (error) {
        console.error(`Failed to create ${agentType} agent:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Organizational analysis initialized with ${createdAgents.length} agents`,
      analysisType,
      schedule,
      agents: createdAgents,
      workflow: {
        description: 'Agents are now autonomous and will self-schedule tasks',
        nextSteps: [
          'Agents will automatically execute according to their trigger configs',
          'View agent activity in the Agents dashboard',
          'Results will be available through agent task outputs',
          'Agents use measurement_api and process_api tools automatically'
        ]
      }
    });

  } catch (error) {
    console.error('Analysis initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize analysis', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/organizations/[id]/analysis - Get analysis status
 * Shows which analysis agents exist and their recent activity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("agents:view");
    const { id } = await params;
    const organizationId = parseInt(id);
    
    if (session.user.currentOrganizationId !== organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const agentService = getAgentApplicationService();
    
    // Get analysis agents for this organization
    const analysisAgents = await agentService.getAgents({ 
      organizationId: OrganizationId.fromNumber(organizationId),
      agentTypes: ['data-collector', 'kpi-calculator', 'process-analyst', 'reporter', 'coordinator', 'monitor']
    });

    const agentDisplayData = analysisAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      agentType: agent.agentType,
      status: agent.status,
      triggerConfig: agent.trigger,
      tools: Array.isArray(agent.tools) ? agent.tools.map((t: any) => t.name) : [],
      lastActivity: agent.updatedAt,
      specialization: agent.specialization
    }));

    const hasAnalysisSetup = agentDisplayData.length > 0;
    const agentsByType = agentDisplayData.reduce((acc, agent) => {
      if (agent.agentType) {
        acc[agent.agentType] = agent;
      }
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      organizationId,
      hasAnalysisSetup,
      agentCount: agentDisplayData.length,
      agents: agentDisplayData,
      agentsByType,
      capabilities: {
        dataCollection: !!agentsByType['data-collector'],
        kpiCalculation: !!agentsByType['kpi-calculator'],
        processAnalysis: !!agentsByType['process-analyst'],
        reporting: !!agentsByType['reporter'],
        coordination: !!agentsByType['coordinator'],
        monitoring: !!agentsByType['monitor']
      }
    });

  } catch (error) {
    console.error('Analysis status error:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizations/[id]/analysis - Update agent schedules
 * Updates trigger configurations for analysis agents
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("agents:manage");
    const { id } = await params;
    const organizationId = parseInt(id);
    
    if (session.user.currentOrganizationId !== organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body: UpdateScheduleRequest = await request.json();
    const { agentType, triggerConfig } = body;

    const agentService = getAgentApplicationService();
    
    // Find the agent of the specified type
    const agents = await agentService.getAgents({ 
      organizationId: OrganizationId.fromNumber(organizationId),
      agentTypes: [agentType]
    });

    if (agents.length === 0) {
      return NextResponse.json({ error: `No ${agentType} agent found` }, { status: 404 });
    }

    const agent = agents[0];
    
    // Update the agent's trigger config
    const updateResult = await agentService.updateAgent({
      agentId: agent.id,
      trigger: triggerConfig
    });

    if (!updateResult.success) {
      return NextResponse.json({ error: 'Failed to update agent schedule' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${agentType} agent schedule`,
      agentId: agent.id,
      agentType,
      newTriggerConfig: triggerConfig
    });

  } catch (error) {
    console.error('Analysis schedule update error:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Helper functions

function createTriggerConfig(schedule: string): TriggerConfig {
  switch (schedule) {
    case 'daily':
      return TriggerConfigs.calendar('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', {
        timezone: 'UTC',
        startDate: new Date(),
        enabled: true
      });
    case 'weekly':
      return TriggerConfigs.calendar('FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0', {
        timezone: 'UTC',
        startDate: new Date(),
        enabled: true
      });
    case 'monthly':
      return TriggerConfigs.calendar('FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0', {
        timezone: 'UTC',
        startDate: new Date(),
        enabled: true
      });
    case 'manual':
    default:
      return TriggerConfigs.manual(true);
  }
}

function createPersonaForAgentType(agentType: AgentType): string {
  const personas = {
    'data-collector': 'You are a specialized data collection agent focused on gathering accurate organizational measurements. You excel at using the measurement_api tool to collect, validate, and store measurement data from various sources.',
    'kpi-calculator': 'You are a KPI calculation specialist with expertise in mathematical analysis and organizational metrics. You use measurement_api to calculate accurate KPIs and track organizational performance.',
    'process-analyst': 'You are a process analysis expert specializing in organizational workflow optimization. You use process_api and measurement_api tools to identify bottlenecks, analyze performance, and recommend improvements.',
    'reporter': 'You are a reporting specialist focused on generating insights and reports from organizational data. You create clear, actionable reports from measurement and process analysis.',
    'coordinator': 'You are a coordination specialist managing complex multi-agent workflows and ensuring proper execution sequencing across different analysis activities.',
    'monitor': 'You are a monitoring specialist focused on real-time tracking of organizational metrics and alerting for critical changes or thresholds.',
    'general': 'You are a general-purpose organizational assistant capable of various business analysis and support tasks.'
  };

  return personas[agentType] || personas['general'];
}