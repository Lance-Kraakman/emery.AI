import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/admin/require-admin';
import { db } from '@/ddd/infrastructure/db/client';
import { organizations } from '@/ddd/infrastructure/db/schema';
import { desc } from 'drizzle-orm';

/**
 * GET /api/admin/organizations
 * List all organizations with billing/plan summary.
 * Platform admin only (ADMIN_EMAILS).
 */
export async function GET() {
  try {
    const adminOrError = await requireAdmin();
    if (isErrorResponse(adminOrError)) return adminOrError;

    const orgs = await db.query.organizations.findMany({
      columns: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        usageAllowanceCredits: true,
        creditsUsedCurrentMonth: true,
        creditBalance: true,
        spendingLimitUsd: true,
        storageQuotaBytes: true,
        storageUsedBytes: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        customPriceId: true,
        billingEmail: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        defaultModel: true,
        createdAt: true,
      },
      orderBy: [desc(organizations.createdAt)],
    });

    return NextResponse.json({
      success: true,
      data: orgs,
      total: orgs.length,
    });
  } catch (error) {
    console.error('Admin: Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
