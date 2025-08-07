/**
 * Scheduler status and management API endpoint
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { agentScheduler } from '@/lib/scheduler/agent-scheduler';

/**
 * Get scheduler status
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const status = agentScheduler.getStatus();
    
    return Response.json({
      success: true,
      scheduler: {
        ...status,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          SKIP_SCHEDULER: process.env.SKIP_SCHEDULER,
          SCHEDULER_TIMEZONE: process.env.SCHEDULER_TIMEZONE || 'UTC',
        },
      },
    });

  } catch (error) {
    console.error('Error in scheduler status API:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Control scheduler (start/stop/restart)
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    let result;
    
    switch (action) {
      case 'start':
        await agentScheduler.start();
        result = { message: 'Scheduler started successfully' };
        break;
        
      case 'stop':
        await agentScheduler.stop();
        result = { message: 'Scheduler stopped successfully' };
        break;
        
      case 'restart':
        await agentScheduler.stop();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
        await agentScheduler.start();
        result = { message: 'Scheduler restarted successfully' };
        break;
        
      default:
        return Response.json({ 
          success: false,
          error: `Unknown action: ${action}. Use 'start', 'stop', or 'restart'` 
        }, { status: 400 });
    }

    const status = agentScheduler.getStatus();
    
    return Response.json({
      success: true,
      ...result,
      scheduler: status,
    });

  } catch (error) {
    console.error('Error controlling scheduler:', error);
    return Response.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}