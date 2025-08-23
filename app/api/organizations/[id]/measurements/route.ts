// AIDEV-NOTE: Measurements API endpoint - TEMPORARILY DISABLED FOR BUILD
// AIDEV-TODO: Fix OrganizationAnalysisApplicationService DI registration

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Measurements endpoint temporarily disabled for build',
    message: 'OrganizationAnalysisApplicationService needs DI registration'
  }, { status: 503 });
}