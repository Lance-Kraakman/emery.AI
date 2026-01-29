/**
 * Security Report TipTap API - Get report as TipTap document
 *
 * AIDEV-NOTE: This endpoint returns a security report in TipTap JSON format
 * for rich text display or document storage.
 *
 * GET /api/security/reports/[id]/tiptap
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import {
  getSecurityReportRepository,
  getSecurityFindingRepository,
} from '@/ddd/application/di/container';
import { convertSecurityReportToTipTap } from '@/ddd/application/services/security/security-report-tiptap-converter';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/security/reports/[id]/tiptap
 *
 * Returns the security report as a TipTap JSON document.
 *
 * Response:
 * - 200: TipTap document JSON
 * - 401: Unauthorized
 * - 404: Report not found
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const reportId = parseInt(id, 10);

    if (isNaN(reportId)) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
    }

    const reportRepo = getSecurityReportRepository();
    const findingRepo = getSecurityFindingRepository();

    // Get report
    const report = await reportRepo.findById(reportId);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Verify organization access
    if (report.organizationId !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Get findings
    const findings = await findingRepo.findByReportId(reportId);

    // Convert to TipTap
    const tiptapDocument = convertSecurityReportToTipTap(report, findings);

    return NextResponse.json({
      success: true,
      data: tiptapDocument,
      metadata: {
        reportId: report.id,
        generatedAt: report.generatedAt,
        riskGrade: report.reportData.riskGrade,
        score: report.reportData.overallScore,
        findingsCount: findings.length,
      },
    });
  } catch (error) {
    console.error('Error getting security report as TipTap:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
