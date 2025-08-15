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

    // Create manual task request
    const manualTaskRequest = {
      agentId: parseInt(agentId),
      instructions,
      userId: 'test-user-123'
    };

    // Trigger via LISTEN/NOTIFY (same as ManualDispatcher.triggerManualTask)
    await rawClient`SELECT pg_notify(${'manual_task_created'}, ${JSON.stringify(manualTaskRequest)})`;

    console.log(`[TEST-MANUAL-TRIGGER] ✅ Manual task notification sent`);

    return NextResponse.json({ 
      success: true, 
      message: 'Manual task triggered via LISTEN/NOTIFY',
      request: manualTaskRequest
    });

  } catch (error) {
    console.error('[TEST-MANUAL-TRIGGER] ❌ Error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to trigger manual task' 
    }, { status: 500 });
  }
}