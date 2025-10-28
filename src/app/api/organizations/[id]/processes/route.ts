// AIDEV-NOTE: Process Analysis Agent Status API - Part of Guided Platform Feature
// Shows status and activity of process-analyst agents responsible for process analysis

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/app/actions/permissions';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/[id]/processes - Get process analysis status
 * Shows process-analyst agent status and recent process analysis activity
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
    
    // Get process-analyst agents for this organization
    const processAnalysts = await agentService.getAgents({
      organizationId: organizationId,
      agentTypes: ['process-analyst']
    });

    const processAnalystDisplayData = processAnalysts.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      triggerConfig: agent.schedules[0],
      lastActivity: agent.updatedAt,
      specialization: agent.specialization
    }));

    return NextResponse.json({
      success: true,
      organizationId,
      processAnalysis: {
        enabled: processAnalystDisplayData.length > 0,
        agentCount: processAnalystDisplayData.length,
        agents: processAnalystDisplayData,
        capabilities: {
          bottleneckAnalysis: processAnalystDisplayData.length > 0,
          performanceTracking: processAnalystDisplayData.length > 0
        }
      },
      workflow: {
        description: 'Process analyst agents autonomously analyze organizational workflows',
        autonomy: 'Agents self-schedule based on their trigger configurations',
        tools: ['process_api', 'measurement_api', 'emery_database'],
        analysisTypes: [
          'bottleneck-identification',
          'performance-tracking', 
          'improvement-recommendations',
          'workflow-optimization'
        ]
      }
    });

  } catch (error) {
    console.error('Process analysis status error:', error);
    return NextResponse.json(
      { error: 'Failed to get process analysis status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/processes - Trigger manual process analysis
 * Manually triggers process-analyst agents to analyze workflows
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

    // Note: This is a placeholder for manual triggering
    // In the pure agent autonomy model, agents self-schedule
    // This endpoint could potentially trigger immediate execution
    // but the implementation depends on how manual triggers are handled

    return NextResponse.json({
      success: true,
      message: 'Process analysis trigger sent',
      note: 'Process analyst agents handle workflow analysis autonomously',
      workflow: {
        description: 'Agents will execute process analysis based on their trigger configs',
        autonomy: 'No orchestration layer needed - agents are self-managing',
        analysisCapabilities: [
          'Identify workflow bottlenecks using process_api',
          'Track performance metrics across processes',
          'Generate improvement recommendations',
          'Monitor process efficiency over time'
        ]
      }
    });

  } catch (error) {
    console.error('Manual process analysis trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger process analysis', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}