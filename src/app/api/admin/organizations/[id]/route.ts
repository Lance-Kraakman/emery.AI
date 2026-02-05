import { NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/admin/require-admin';
import { db } from '@/ddd/infrastructure/db/client';
import { organizations, users, userOrganizations, userRoles, roles } from '@/ddd/infrastructure/db/schema';
import { eq, type InferInsertModel } from 'drizzle-orm';

type OrgInsert = InferInsertModel<typeof organizations>;

const VALID_PLANS = ['free', 'pro', 'max', 'enterprise'] as const;
type Plan = typeof VALID_PLANS[number];

/** Typed shape for PATCH request body — only admin-updatable fields. */
interface OrgPatchBody {
  name?: string;
  plan?: string;
  usageAllowanceCredits?: number;
  creditBalance?: number;
  creditsUsedCurrentMonth?: number;
  spendingLimitUsd?: string;
  storageQuotaBytes?: number;
  billingEmail?: string;
  defaultModel?: string | null;
}

interface MemberRow {
  userId: string;
  name: string | null;
  email: string | null;
  joinedAt: Date | null;
}

interface MemberRole {
  id: number;
  name: string;
  isSystem: boolean | null;
}

/**
 * GET /api/admin/organizations/[id]
 * Get organization details with members.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminOrError = await requireAdmin();
    if (isErrorResponse(adminOrError)) return adminOrError;

    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ error: 'Invalid organization ID' }, { status: 400 });
    }

    // Fetch organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch members (replicates drizzle-organization-repository.ts:67-112)
    const membersResult = await db
      .select({
        userId: userOrganizations.userId,
        name: users.name,
        email: users.email,
        joinedAt: userOrganizations.createdAt,
      })
      .from(userOrganizations)
      .leftJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, orgId));

    // Fetch roles for all members in this org
    const rolesResult = await db
      .select({
        userId: userRoles.userId,
        roleId: roles.id,
        roleName: roles.name,
        isSystem: roles.isSystem,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.organizationId, orgId));

    // Group roles by userId
    const rolesByUser = new Map<string, MemberRole[]>();
    for (const role of rolesResult) {
      const existing = rolesByUser.get(role.userId) || [];
      existing.push({ id: role.roleId, name: role.roleName, isSystem: role.isSystem });
      rolesByUser.set(role.userId, existing);
    }

    const members = (membersResult as MemberRow[]).map((member) => ({
      userId: member.userId,
      name: member.name,
      email: member.email,
      roles: rolesByUser.get(member.userId) || [],
      joinedAt: member.joinedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        ...org,
        members,
        memberCount: members.length,
      },
    });
  } catch (error) {
    console.error('Admin: Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]
 * Partial update of organization settings.
 * Only allowlisted fields can be updated.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminOrError = await requireAdmin();
    if (isErrorResponse(adminOrError)) return adminOrError;

    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ error: 'Invalid organization ID' }, { status: 400 });
    }

    // Verify org exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = (await req.json()) as OrgPatchBody;

    // Validate plan value before building update
    if (body.plan !== undefined && !VALID_PLANS.includes(body.plan as Plan)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate numeric fields are non-negative
    const numericChecks: { field: keyof OrgPatchBody; value: unknown }[] = [
      { field: 'usageAllowanceCredits', value: body.usageAllowanceCredits },
      { field: 'creditBalance', value: body.creditBalance },
      { field: 'creditsUsedCurrentMonth', value: body.creditsUsedCurrentMonth },
      { field: 'storageQuotaBytes', value: body.storageQuotaBytes },
    ];
    for (const { field, value } of numericChecks) {
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        return NextResponse.json(
          { error: `${field} must be a non-negative number` },
          { status: 400 }
        );
      }
    }

    // Build typed update from allowlisted fields
    const updateData: Partial<OrgInsert> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.plan !== undefined) updateData.plan = body.plan;
    if (body.usageAllowanceCredits !== undefined) updateData.usageAllowanceCredits = body.usageAllowanceCredits;
    if (body.creditBalance !== undefined) updateData.creditBalance = body.creditBalance;
    if (body.creditsUsedCurrentMonth !== undefined) updateData.creditsUsedCurrentMonth = body.creditsUsedCurrentMonth;
    if (body.spendingLimitUsd !== undefined) updateData.spendingLimitUsd = body.spendingLimitUsd;
    if (body.storageQuotaBytes !== undefined) updateData.storageQuotaBytes = body.storageQuotaBytes;
    if (body.billingEmail !== undefined) updateData.billingEmail = body.billingEmail;
    if (body.defaultModel !== undefined) updateData.defaultModel = body.defaultModel;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, orgId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Admin: Error updating organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}
