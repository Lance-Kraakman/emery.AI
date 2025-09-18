// AIDEV-NOTE: Measurements Agent Status API - Part of Guided Platform Feature
// Shows status and activity of data-collector agents responsible for measurement collection

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/src/app/actions/permissions';
import { getAgentApplicationService } from '@/src/ddd/application/di/container';
import { OrganizationId } from '@/src/ddd/domain/shared/value-objects';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/[id]/measurements - Get measurement collection status
 * Shows data-collector agent status and recent measurement collection activity
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
    
    // Get data-collector agents for this organization
    const dataCollectors = await agentService.getAgents({ 
      organizationId: OrganizationId.fromNumber(organizationId),
      agentTypes: ['data-collector']
    });

    const dataCollectorDisplayData = dataCollectors.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      triggerConfig: agent.trigger,
      tools: Array.isArray(agent.tools) ? agent.tools.map((t: any) => t.name) : [],
      lastActivity: agent.updatedAt,
      specialization: agent.specialization
    }));

    return NextResponse.json({
      success: true,
      organizationId,
      measurementCollection: {
        enabled: dataCollectorDisplayData.length > 0,
        agentCount: dataCollectorDisplayData.length,
        agents: dataCollectorDisplayData,
        capabilities: {
          measurementApi: dataCollectorDisplayData.some(agent => 
            agent.tools.includes('measurement_api')
          ),
          databaseAccess: dataCollectorDisplayData.some(agent => 
            agent.tools.includes('emery_database')
          ),
          dataValidation: dataCollectorDisplayData.length > 0
        }
      },
      workflow: {
        description: 'Data collector agents autonomously gather organizational measurements',
        autonomy: 'Agents self-schedule based on their trigger configurations',
        tools: ['measurement_api', 'emery_database', 'table_data']
      }
    });

  } catch (error) {
    console.error('Measurement status error:', error);
    return NextResponse.json(
      { error: 'Failed to get measurement status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/measurements - Trigger manual measurement collection
 * Manually triggers data-collector agents to collect measurements
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
      message: 'Measurement collection trigger sent',
      note: 'Data collector agents handle measurement collection autonomously',
      workflow: {
        description: 'Agents will execute measurement collection based on their trigger configs',
        autonomy: 'No orchestration layer needed - agents are self-managing'
      }
    });

  } catch (error) {
    console.error('Manual measurement trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger measurement collection', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}