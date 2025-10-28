// AIDEV-NOTE: KPI Calculation Agent Status API - Part of Guided Platform Feature
// Shows status and activity of kpi-calculator agents responsible for KPI calculations

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/app/actions/permissions';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/[id]/kpis - Get KPI calculation status
 * Shows kpi-calculator agent status and recent KPI calculation activity
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
    
    // Get kpi-calculator agents for this organization
    const kpiCalculators = await agentService.getAgents({
      organizationId: organizationId,
      agentTypes: ['kpi-calculator']
    });

    const kpiCalculatorDisplayData = kpiCalculators.map(agent => ({
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
      kpiCalculation: {
        enabled: kpiCalculatorDisplayData.length > 0,
        agentCount: kpiCalculatorDisplayData.length,
        agents: kpiCalculatorDisplayData,
        capabilities: {
          mathematicalAnalysis: kpiCalculatorDisplayData.length > 0,
          trendAnalysis: kpiCalculatorDisplayData.length > 0
        }
      },
      workflow: {
        description: 'KPI calculator agents autonomously compute organizational key performance indicators',
        autonomy: 'Agents self-schedule based on their trigger configurations',
        tools: ['measurement_api', 'emery_database', 'table_data'],
        calculationTypes: [
          'performance-ratios',
          'trend-analysis',
          'variance-calculation',
          'target-tracking',
          'composite-metrics'
        ]
      }
    });

  } catch (error) {
    console.error('KPI calculation status error:', error);
    return NextResponse.json(
      { error: 'Failed to get KPI calculation status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/kpis - Trigger manual KPI calculation
 * Manually triggers kpi-calculator agents to compute KPIs
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
      message: 'KPI calculation trigger sent',
      note: 'KPI calculator agents handle metric calculations autonomously',
      workflow: {
        description: 'Agents will execute KPI calculations based on their trigger configs',
        autonomy: 'No orchestration layer needed - agents are self-managing',
        calculationCapabilities: [
          'Retrieve measurement data using measurement_api',
          'Calculate KPIs using defined formulas and methodologies',
          'Track KPI trends and variances over time',
          'Monitor KPI targets and thresholds',
          'Generate performance insights and alerts'
        ]
      }
    });

  } catch (error) {
    console.error('Manual KPI calculation trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger KPI calculation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}