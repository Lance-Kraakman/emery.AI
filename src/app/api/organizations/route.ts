/**
 * Organization API endpoint
 * Returns organization info for the authenticated user's current organization
 *
 * AIDEV-NOTE: Uses withAuthenticatedRoute() to properly set RLS context
 * for database operations. This is required for getOrganizationRepository().
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getOrganizationRepository } from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

/**
 * GET /api/organizations
 * Returns the current organization info for the authenticated user
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const orgRepo = getOrganizationRepository();
    const org = await orgRepo.findById(OrganizationId.fromNumber(user.organizationId!));

    if (!org) {
      return { success: false, error: 'Organization not found', status: 404 };
    }

    return {
      success: true,
      data: {
        id: org.id.value,
        name: org.name.value,
        slug: org.slug,
        mission: org.mission,
        plan: org.plan,
        defaultModel: org.defaultModel,
        availableModels: org.availableModels,
        sharedTools: org.sharedTools,
        sharedServers: org.sharedServers,
        createdAt: org.createdAt,
        // Billing info (if user has access)
        tokenQuotaMonthly: org.tokenQuotaMonthly,
        creditBalance: org.creditBalance,
        storageQuotaBytes: org.storageQuotaBytes,
        storageUsedBytes: org.storageUsedBytes,
      }
    };
  });
}
