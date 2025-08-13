import { NextResponse } from 'next/server';
import { agentScheduler } from '@/lib/scheduler';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { agentId, rrule } = body;

  if (!agentId || !rrule) {
    return NextResponse.json({ error: 'Missing agentId or rrule' }, { status: 400 });
  }

  try {
    await agentScheduler.updateAgentTrigger(agentId, { type: 'CALENDAR', rrule });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API-SCHEDULER] Failed to update schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}
