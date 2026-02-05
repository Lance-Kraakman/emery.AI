import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/admin/require-admin';
import { db } from '@/ddd/infrastructure/db/client';
import { users, userOrganizations } from '@/ddd/infrastructure/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/admin/users
 * List all users. Optional ?organizationId=123 filter.
 * Platform admin only (ADMIN_EMAILS).
 */
export async function GET(req: Request) {
  try {
    const adminOrError = await requireAdmin();
    if (isErrorResponse(adminOrError)) return adminOrError;

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    // Safe columns — excludes apiKeyHash, previousApiKeyHash
    const safeColumns = {
      id: true,
      name: true,
      email: true,
      currentOrganizationId: true,
      jobTitle: true,
      isAppOnlyUser: true,
      apiKeyPrefix: true,
      createdAt: true,
    } as const;

    if (organizationId) {
      const orgId = parseInt(organizationId, 10);
      if (isNaN(orgId)) {
        return NextResponse.json({ error: 'Invalid organizationId' }, { status: 400 });
      }

      // Join with userOrganizations to filter by org
      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          currentOrganizationId: users.currentOrganizationId,
          jobTitle: users.jobTitle,
          isAppOnlyUser: users.isAppOnlyUser,
          apiKeyPrefix: users.apiKeyPrefix,
          createdAt: users.createdAt,
        })
        .from(users)
        .innerJoin(userOrganizations, eq(users.id, userOrganizations.userId))
        .where(eq(userOrganizations.organizationId, orgId))
        .orderBy(users.createdAt);

      return NextResponse.json({
        success: true,
        data: result,
        total: result.length,
      });
    }

    // No filter — return all users
    const result = await db.query.users.findMany({
      columns: safeColumns,
      orderBy: [desc(users.createdAt)],
    });

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (error) {
    console.error('Admin: Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
