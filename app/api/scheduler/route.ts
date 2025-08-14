import { NextResponse } from 'next/server';
import { agentScheduler } from '@/lib/scheduler';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, agentId, rrule, triggerConfig } = body;

  try {
    if (action === 'processPendingTasks') {
      // Manual processing of pending tasks
      const result = await agentScheduler.processPendingTasksManually();
      return NextResponse.json({ 
        success: true, 
        message: `Processed ${result.processed} tasks, ${result.errors} errors`,
        ...result 
      });
    } else if (action === 'updateTrigger') {
      // Update agent trigger configuration
      if (!agentId || !triggerConfig) {
        return NextResponse.json({ error: 'Missing agentId or triggerConfig' }, { status: 400 });
      }
      await agentScheduler.updateAgentTrigger(agentId, triggerConfig);
      return NextResponse.json({ success: true });
    } else {
      // Legacy support for calendar updates
      if (!agentId || !rrule) {
        return NextResponse.json({ error: 'Missing agentId or rrule' }, { status: 400 });
      }
      await agentScheduler.updateAgentTrigger(agentId, { type: 'CALENDAR', rrule });
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('[API-SCHEDULER] Failed to process request:', error);
    return NextResponse.json({ error: 'Failed to process scheduler request' }, { status: 500 });
  }
}
