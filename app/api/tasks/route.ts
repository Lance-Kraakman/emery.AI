import { NextRequest, NextResponse } from 'next/server';
import { createTask } from '@/app/actions/tasks';
import type { CreateTaskData } from '@/app/actions/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, name, capabilityName, payload } = body;

    // Validate required fields
    if (!agentId || !name || !capabilityName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, name, capabilityName'
      }, { status: 400 });
    }

    const taskData: CreateTaskData = {
      agentId: parseInt(agentId),
      name,
      capabilityName,
      payload: payload || {}
    };

    const result = await createTask(taskData);
    
    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }

  } catch (error) {
    console.error('API Error creating task:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}