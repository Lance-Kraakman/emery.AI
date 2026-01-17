/**
 * Organization API endpoint
 * Returns organization info for the authenticated user's current organization
 *
 * Query params for GET:
 * - format: 'llm' for TOON format output (simplified)
 * - meta: '1' to include additional metadata
 */

// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getOrganizationRepository } from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

/**
 * GET /api/organizations
 * Returns the current organization info for the authenticated user
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const organizationId = authResult.user.organizationId;

    if (!organizationId) {
      return Response.json({ error: 'No organization context' }, { status: 400 });
    }

    const orgRepo = getOrganizationRepository();
    const org = await orgRepo.findById(OrganizationId.fromNumber(organizationId));

    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check for LLM-optimized format
    const format = request.nextUrl.searchParams.get('format');
    const includeMeta = request.nextUrl.searchParams.get('meta') === '1';

    if (format === 'llm') {
      // Return simplified format for LLM consumption
      const llmResponse = {
        organization: {
          id: org.id.value,
          name: org.name.value,
          slug: org.slug,
          mission: org.mission,
          plan: org.plan,
          defaultModel: org.defaultModel,
          availableModels: org.availableModels,
        }
      };

      if (includeMeta) {
        return Response.json({
          ...llmResponse,
          _meta: {
            createdAt: org.createdAt,
            plan: org.plan,
          }
        });
      }

      return Response.json(llmResponse);
    }

    // Full response
    return Response.json({
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
    });
  } catch (error) {
    console.error('[ORGANIZATIONS-API] Error:', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Failed to fetch organization'
    }, { status: 500 });
  }
}
