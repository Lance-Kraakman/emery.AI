/**
 * Security Report Generation API - Generate security analysis
 *
 * AIDEV-NOTE: This endpoint generates a security analysis report for the
 * organization. Used by managed agents via the security_report tool.
 *
 * POST /api/security/generate
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getSecurityAnalyzerService } from '@/ddd/application/di/container';

/**
 * POST /api/security/generate
 *
 * Generate a new security report for the organization.
 *
 * Response:
 * - 200: Security report generated successfully
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!authResult.user.organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const analyzerService = getSecurityAnalyzerService();

    const result = await analyzerService.analyzeOrganization(
      authResult.user.organizationId,
      authResult.user.id
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate security report' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Security report generated successfully',
    });
  } catch (error) {
    console.error('Error generating security report:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
