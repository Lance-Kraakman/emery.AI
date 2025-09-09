// AIDEV-NOTE: Drizzle implementation of invitation repository
// Handles database operations for user invitations with token management and validation

import type { DbClient } from '@/lib/db/client';
import { eq, and, lt, gte, desc, sql, inArray } from 'drizzle-orm';
import { invitations, users, organizations, userOrganizations, roles } from '@/lib/db/schema';
import type { 
  IInvitationRepository,
} from '@/ddd/domain/invitations/repositories/invitation-repository';
import { Invitation } from '@/ddd/domain/invitations/entities/invitation';
import type { 
  CreateInvitationData, 
  UpdateInvitationData,
  InvitationQuery,
  BulkInvitationData,
  BulkInvitationResult,
  InvitationStats
} from '@/ddd/domain/invitations/entities/invitation';
import { generateInvitationToken as generateToken } from '@/ddd/domain/invitations/entities/invitation';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';
import { EmailAddress } from '@/ddd/domain/shared/value-objects/email-address';
import { SystemRoleType, SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';
import { InvitationId, InvitationToken } from '@/ddd/domain/shared/value-objects';
import type { InvitationRow } from '@/types/db';

export class DrizzleInvitationRepository implements IInvitationRepository {
  constructor(private readonly db: DbClient) {}

  // Basic CRUD operations
  async findById(id: InvitationId): Promise<Invitation | null> {
    const results = await this.db
      .select({
        invitation: invitations,
        roleName: roles.name
      })
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(eq(invitations.id, id.value))
      .limit(1);

    return results[0] ? this.mapToEntity({
      ...results[0].invitation,
      systemRole: results[0].roleName || SYSTEM_ROLES.MEMBER
    }) : null;
  }

  async findByToken(token: InvitationToken): Promise<Invitation | null> {
    const results = await this.db
      .select({
        invitation: invitations,
        roleName: roles.name
      })
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(eq(invitations.token, token.value))
      .limit(1);

    return results[0] ? this.mapToEntity({
      ...results[0].invitation,
      systemRole: results[0].roleName || SYSTEM_ROLES.MEMBER
    }) : null;
  }

  async findByEmail(organizationId: OrganizationId, email: EmailAddress): Promise<Invitation | null> {
    const results = await this.db
      .select({
        invitation: invitations,
        roleName: roles.name
      })
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(and(
        eq(invitations.organizationId, organizationId.value),
        eq(invitations.email, email.value.toLowerCase())
      ))
      .limit(1);

    return results[0] ? this.mapToEntity({
      ...results[0].invitation,
      systemRole: results[0].roleName || SYSTEM_ROLES.MEMBER
    }) : null;
  }

  async create(data: CreateInvitationData): Promise<Invitation> {
    const token = await this.generateUniqueToken();
    
    if (!data.systemRole) {
      throw new Error('systemRole is required - legacy role support removed');
    }
    
    const roleId = await this.getSystemRoleId(data.systemRole);
    if (!roleId) {
      throw new Error(`System role '${data.systemRole}' not found. Please run RBAC seeding first.`);
    }
    
    const insertData = {
      organizationId: data.organizationId.value,
      invitedBy: data.invitedBy.value,
      email: data.email.value.toLowerCase(),
      roleId: roleId,
      token: token.value,
      expiresAt: data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
    };

    const results = await this.db
      .insert(invitations)
      .values(insertData)
      .returning();

    // Get the role name for the entity
    const roleResult = await this.db
      .select({ name: roles.name })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return this.mapToEntity({
      ...results[0],
      systemRole: roleResult[0]?.name || data.systemRole
    });
  }

  async update(id: InvitationId, data: UpdateInvitationData): Promise<Invitation> {
    const updateData: any = {};
    if (data.email !== undefined) updateData.email = data.email.value.toLowerCase();
    // TODO: Update role handling for RBAC system - need to map role to roleId
    // if (data.role !== undefined) updateData.roleId = await this.getRoleIdByName(data.role.value);
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;

    const results = await this.db
      .update(invitations)
      .set(updateData)
      .where(eq(invitations.id, id.value))
      .returning();

    // For now, return with the role as 'member' during transition
    return this.mapToEntity({
      ...results[0],
      systemRole: data.systemRole || SYSTEM_ROLES.MEMBER
    });
  }

  async delete(id: InvitationId): Promise<void> {
    await this.db
      .delete(invitations)
      .where(eq(invitations.id, id.value));
  }

  // Query operations
  async findByOrganization(organizationId: OrganizationId): Promise<Invitation[]> {
    const results = await this.db
      .select({
        invitation: invitations,
        roleName: roles.name
      })
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(eq(invitations.organizationId, organizationId.value))
      .orderBy(desc(invitations.createdAt));

    return results.map(result => this.mapToEntity({
      ...result.invitation,
      systemRole: result.roleName || SYSTEM_ROLES.MEMBER
    }));
  }


  async findByQuery(query: InvitationQuery): Promise<Invitation[]> {
    let whereConditions: any[] = [];

    if (query.organizationId) {
      whereConditions.push(eq(invitations.organizationId, query.organizationId.value));
    }
    if (query.invitedBy) {
      whereConditions.push(eq(invitations.invitedBy, query.invitedBy.value));
    }
    if (query.email) {
      whereConditions.push(eq(invitations.email, query.email.value.toLowerCase()));
    }
    // TODO: Update role filtering for RBAC system
    // if (query.role) {
    //   whereConditions.push(eq(invitations.roleId, query.role.value));
    // }
    if (query.isExpired !== undefined) {
      const now = new Date();
      if (query.isExpired) {
        whereConditions.push(lt(invitations.expiresAt, now));
      } else {
        whereConditions.push(gte(invitations.expiresAt, now));
      }
    }
    if (query.dateRange) {
      whereConditions.push(
        and(
          gte(invitations.createdAt, query.dateRange.from),
          lt(invitations.createdAt, query.dateRange.to)
        )
      );
    }

    const results = await this.db
      .select({
        invitation: invitations,
        roleName: roles.name
      })
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(invitations.createdAt));

    return results.map(result => this.mapToEntity({
      ...result.invitation,
      systemRole: result.roleName || SYSTEM_ROLES.MEMBER
    }));
  }

  // Token and validation operations
  async validateToken(token: InvitationToken): Promise<{ valid: boolean; invitation?: Invitation; error?: string }> {
    const invitation = await this.findByToken(token);
    
    if (!invitation) {
      return { valid: false, error: 'Invalid invitation token' };
    }

    if (invitation.expiresAt < new Date()) {
      return { valid: false, error: 'Invitation has expired' };
    }

    return { valid: true, invitation };
  }

  async generateUniqueToken(): Promise<InvitationToken> {
    let token: InvitationToken;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      token = generateToken();
      const existing = await this.findByToken(token);
      if (!existing) {
        return token;
      }
      attempts++;
    } while (attempts < maxAttempts);

    // Fallback with timestamp to ensure uniqueness
    return InvitationToken.fromString(generateToken().value + '_' + Date.now());
  }

  // Invitation management
  async acceptInvitation(token: InvitationToken, acceptingUserId: UserId): Promise<void> {
    // Delete the invitation after acceptance
    const invitation = await this.findByToken(token);
    if (invitation) {
      await this.delete(invitation.id);
    }
  }


  // Bulk operations
  async createBulkInvitations(data: BulkInvitationData): Promise<BulkInvitationResult> {
    const successful: Invitation[] = [];
    const failed: Array<{ email: EmailAddress; error: string }> = [];

    for (const invitationData of data.invitations) {
      // Value Objects are already validated
      const organizationIdVO = data.organizationId;
      const emailVO = invitationData.email;

      try {

        // Check if user is already a member
        const isAlreadyMember = await this.isUserAlreadyMember(organizationIdVO, emailVO);
        if (isAlreadyMember) {
          failed.push({
            email: emailVO,
            error: 'User is already a member of this organization'
          });
          continue;
        }

        // Check for existing invitation
        const existingInvitation = await this.hasExistingInvitation(organizationIdVO, emailVO);
        if (existingInvitation) {
          failed.push({
            email: emailVO,
            error: 'Invitation already exists for this email'
          });
          continue;
        }

        const invitation = await this.create({
          organizationId: organizationIdVO,
          invitedBy: data.invitedBy,
          email: emailVO,
          systemRole: invitationData.systemRole || data.defaultRole || SYSTEM_ROLES.MEMBER,
          expiresAt: data.expiresAt
        });

        successful.push(invitation);
      } catch (error) {
        failed.push({
          email: emailVO,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      successful,
      failed,
      totalSent: successful.length,
      totalFailed: failed.length
    };
  }

  async deleteExpiredInvitations(organizationId?: OrganizationId): Promise<number> {
    const now = new Date();
    const conditions = [lt(invitations.expiresAt, now)];
    
    if (organizationId) {
      conditions.push(eq(invitations.organizationId, organizationId.value));
    }
    
    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    // First count how many will be deleted
    const countResults = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(invitations)
      .where(whereCondition);
    
    const count = Number(countResults[0]?.count || 0);

    // Then delete them
    await this.db
      .delete(invitations)
      .where(whereCondition);

    return count;
  }

  async deleteInvitationsByEmail(organizationId: OrganizationId, email: EmailAddress): Promise<number> {
    const whereCondition = and(
      eq(invitations.organizationId, organizationId.value),
      eq(invitations.email, email.value.toLowerCase())
    );

    // First count how many will be deleted
    const countResults = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(invitations)
      .where(whereCondition);
    
    const count = Number(countResults[0]?.count || 0);

    // Then delete them
    await this.db
      .delete(invitations)
      .where(whereCondition);

    return count;
  }

  // Statistics and analytics
  async getInvitationStats(organizationId: OrganizationId): Promise<InvitationStats> {
    const now = new Date();
    
    // Get all invitations for the organization
    const allInvitations = await this.db
      .select({
        roleId: invitations.roleId,
        expiresAt: invitations.expiresAt
      })
      .from(invitations)
      .where(eq(invitations.organizationId, organizationId.value));

    const stats = {
      organizationId,
      totalInvitations: allInvitations.length,
      pendingInvitations: allInvitations.filter(inv => inv.expiresAt > now).length,
      expiredInvitations: allInvitations.filter(inv => inv.expiresAt <= now).length,
      acceptedInvitations: 0, // This would need to be tracked separately
      // TODO: Update invitation stats for RBAC system - role-based stats no longer applicable
      invitationsByRole: {
        owner: 0,
        admin: 0, 
        member: 0
      }
    };

    return stats;
  }

  async getPendingInvitations(organizationId: OrganizationId): Promise<Invitation[]> {
    // Use findByQuery for consistency
    return await this.findByQuery({
      organizationId,
      isExpired: false
    });
  }

  // Business logic validations
  async canInviteToOrganization(inviterId: UserId, organizationId: OrganizationId): Promise<boolean> {
    // Check if user has permission to invite users using the RBAC repository directly
    try {
      const { getRBACRepository } = await import('@/ddd/application/di/container');
      const rbacRepository = getRBACRepository();
      const { Permission } = await import('@/ddd/domain/shared/value-objects/permission');
      const permission = Permission.fromString('users:invite');
      
      return await rbacRepository.hasPermission(inviterId, permission, organizationId);
    } catch (error) {
      console.error('Error checking invite permission:', error);
      return false;
    }
  }

  async hasExistingInvitation(organizationId: OrganizationId, email: EmailAddress): Promise<boolean> {
    const existing = await this.findByEmail(organizationId, email);
    return existing !== null;
  }

  async isUserAlreadyMember(organizationId: OrganizationId, email: EmailAddress): Promise<boolean> {
    // Check if user with this email is already a member
    const membership = await this.db
      .select({ id: userOrganizations.id })
      .from(userOrganizations)
      .innerJoin(users, eq(users.id, userOrganizations.userId))
      .where(and(
        eq(users.email, email.value.toLowerCase()),
        eq(userOrganizations.organizationId, organizationId.value)
      ))
      .limit(1);

    return membership.length > 0;
  }

  // Email and notification support
  async getInvitationEmailData(id: InvitationId): Promise<{
    invitation: Invitation;
    organization: { name: string; id: OrganizationId };
    inviter: { name?: string; email?: EmailAddress };
  } | null> {
    const results = await this.db
      .select({
        invitation: invitations,
        organizationName: organizations.name,
        inviterName: users.name,
        inviterEmail: users.email
      })
      .from(invitations)
      .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
      .innerJoin(users, eq(invitations.invitedBy, users.id))
      .where(eq(invitations.id, id.value))
      .limit(1);

    if (results.length === 0) return null;

    const result = results[0];
    return {
      invitation: this.mapToEntity(result.invitation),
      organization: {
        name: result.organizationName,
        id: OrganizationId.fromNumber(result.invitation.organizationId)
      },
      inviter: {
        name: result.inviterName || undefined,
        email: result.inviterEmail ? EmailAddress.fromString(result.inviterEmail) : undefined
      }
    };
  }

  // RBAC helper method
  private async getSystemRoleId(systemRoleName: string): Promise<number | null> {
    const result = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, systemRoleName))
      .limit(1);
    
    return result[0]?.id || null;
  }

  // Helper method to map database result to domain entity
  private mapToEntity(data: InvitationRow & { systemRole?: string }): Invitation {
    return Invitation.fromPersistence({
      id: data.id,
      organizationId: data.organizationId,
      invitedBy: data.invitedBy,
      email: data.email,
      systemRole: data.systemRole || SYSTEM_ROLES.MEMBER,
      token: data.token,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt
    });
  }
}