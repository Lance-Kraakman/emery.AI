import { NextResponse } from 'next/server';
import { rawClient } from '@/lib/db/client';

/**
 * Test endpoint for manual task triggering via LISTEN/NOTIFY
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentId, instructions } = body;

    if (!agentId || !instructions) {
      return NextResponse.json({ 
        error: 'agentId and instructions are required' 
      }, { status: 400 });
    }

    console.log(`[TEST-MANUAL-TRIGGER] Triggering manual task for agent ${agentId}`);

    // Create task event request
    const taskEventRequest = {
      event_type: 'task_created',
      agentId: parseInt(agentId),
      instructions,
      userId: 'test-user-123'
    };

    // Trigger via LISTEN/NOTIFY (aligned with scheduler's task_event channel)
    await rawClient`SELECT pg_notify(${'task_event'}, ${JSON.stringify(taskEventRequest)})`;

    console.log(`[TEST-MANUAL-TRIGGER] ✅ Manual task notification sent`);

    return NextResponse.json({ 
      success: true, 
      message: 'Task event triggered via LISTEN/NOTIFY',
      request: taskEventRequest
    });

  } catch (error) {
    console.error('[TEST-MANUAL-TRIGGER] ❌ Error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to trigger manual task' 
    }, { status: 500 });
  }
}