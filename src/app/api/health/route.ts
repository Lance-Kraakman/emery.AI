import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Simple health check - just return 200 OK
    return NextResponse.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ 
      status: 'unhealthy', 
      error: 'Health check failed' 
    }, { status: 500 });
  }
}