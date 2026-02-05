import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/admin/require-admin';
import { db } from '@/ddd/infrastructure/db/client';
import { users, userOrganizations, organizations } from '@/ddd/infrastructure/db/schema';
import { eq, type InferInsertModel } from 'drizzle-orm';

type UserInsert = InferInsertModel<typeof users>;

/** Typed shape for PATCH request body — only admin-updatable fields. */
interface UserPatchBody {
  name?: string;
  currentOrganizationId?: number | null;
  jobTitle?: string | null;
  isAppOnlyUser?: boolean;
  allowedApps?: number[] | null;
}

/**
 * GET /api/admin/users/[id]
 * Get user details with their organizations.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminOrError = await requireAdmin();
    if (isErrorResponse(adminOrError)) return adminOrError;

    const { id: userId } = await params;

    // Fetch user (exclude sensitive hash fields)
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        currentOrganizationId: true,
        jobTitle: true,
        teams: true,
        isAppOnlyUser: true,
        allowedApps: true,
        apiKeyPrefix: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch user's organizations
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        plan: organizations.plan,
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, userId));

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        organizations: orgs,
      },
    });
  } catch (error) {
    console.error('Admin: Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Partial update of user settings.
 * Only allowlisted fields can be updated.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminOrError = await requireAdmin();
    if (isErrorResponse(adminOrError)) return adminOrError;

    const { id: userId } = await params;

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = (await req.json()) as UserPatchBody;

    // Build typed update from allowlisted fields
    const updateData: Partial<UserInsert> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.currentOrganizationId !== undefined) updateData.currentOrganizationId = body.currentOrganizationId;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;
    if (body.isAppOnlyUser !== undefined) updateData.isAppOnlyUser = body.isAppOnlyUser;
    if (body.allowedApps !== undefined) updateData.allowedApps = body.allowedApps;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        currentOrganizationId: users.currentOrganizationId,
        jobTitle: users.jobTitle,
        isAppOnlyUser: users.isAppOnlyUser,
        allowedApps: users.allowedApps,
        createdAt: users.createdAt,
      });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Admin: Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
