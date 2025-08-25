// AIDEV-NOTE: Drizzle implementation of invitation repository
// Handles database operations for user invitations with token management and validation

import type { DbClient } from '@/lib/db/client';
import { eq, and, lt, gte, desc, sql, inArray } from 'drizzle-orm';
import { invitations, users, organizations, userOrganizations } from '@/lib/db/schema';
import type { 
  IInvitationRepository,
} from '@/ddd/domain/invitations/repositories/invitation-repository';
import type { 
  Invitation, 
  CreateInvitationData, 
  UpdateInvitationData,
  InvitationQuery,
  BulkInvitationData,
  BulkInvitationResult,
  InvitationStats,
  generateInvitationToken
} from '@/ddd/domain/invitations/entities/invitation';
import { generateInvitationToken as generateToken } from '@/ddd/domain/invitations/entities/invitation';

export class DrizzleInvitationRepository implements IInvitationRepository {
  constructor(private readonly db: DbClient) {}

  // Basic CRUD operations
  async findById(id: number): Promise<Invitation | null> {
    const results = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .limit(1);

    return results[0] ? this.mapToEntity(results[0]) : null;
  }

  async findByToken(token: string): Promise<Invitation | null> {
    const results = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    return results[0] ? this.mapToEntity(results[0]) : null;
  }

  async findByEmail(organizationId: number, email: string): Promise<Invitation | null> {
    const results = await this.db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.email, email.toLowerCase())
      ))
      .limit(1);

    return results[0] ? this.mapToEntity(results[0]) : null;
  }

  async create(data: CreateInvitationData): Promise<Invitation> {
    const token = await this.generateUniqueToken();
    
    const insertData = {
      organizationId: data.organizationId.value,
      invitedBy: data.invitedBy.value,
      email: data.email.value.toLowerCase(),
      role: data.role.value,
      token,
      expiresAt: data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
    };

    const results = await this.db
      .insert(invitations)
      .values(insertData)
      .returning();

    return this.mapToEntity(results[0]);
  }

  async update(id: number, data: UpdateInvitationData): Promise<Invitation> {
    const updateData: any = {};
    if (data.email !== undefined) updateData.email = data.email.value.toLowerCase();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;

    const results = await this.db
      .update(invitations)
      .set(updateData)
      .where(eq(invitations.id, id))
      .returning();

    return this.mapToEntity(results[0]);
  }

  async delete(id: number): Promise<void> {
    await this.db
      .delete(invitations)
      .where(eq(invitations.id, id));
  }

  // Query operations
  async findByOrganization(organizationId: number): Promise<Invitation[]> {
    const results = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, organizationId))
      .orderBy(desc(invitations.createdAt));

    return results.map(result => this.mapToEntity(result));
  }

  async findByInviter(invitedBy: string): Promise<Invitation[]> {
    const results = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.invitedBy, invitedBy))
      .orderBy(desc(invitations.createdAt));

    return results.map(result => this.mapToEntity(result));
  }

  async findByQuery(query: InvitationQuery): Promise<Invitation[]> {
    let whereConditions: any[] = [];

    if (query.organizationId) {
      whereConditions.push(eq(invitations.organizationId, query.organizationId));
    }
    if (query.invitedBy) {
      whereConditions.push(eq(invitations.invitedBy, query.invitedBy));
    }
    if (query.email) {
      whereConditions.push(eq(invitations.email, query.email.toLowerCase()));
    }
    if (query.role) {
      whereConditions.push(eq(invitations.role, query.role));
    }
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
      .select()
      .from(invitations)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(invitations.createdAt));

    return results.map(result => this.mapToEntity(result));
  }

  // Token and validation operations
  async validateToken(token: string): Promise<{ valid: boolean; invitation?: Invitation; error?: string }> {
    const invitation = await this.findByToken(token);
    
    if (!invitation) {
      return { valid: false, error: 'Invalid invitation token' };
    }

    if (invitation.expiresAt < new Date()) {
      return { valid: false, error: 'Invitation has expired' };
    }

    return { valid: true, invitation };
  }

  async isTokenExpired(token: string): Promise<boolean> {
    const invitation = await this.findByToken(token);
    if (!invitation) return true;
    return invitation.expiresAt < new Date();
  }

  async generateUniqueToken(): Promise<string> {
    let token: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      token = generateToken().value;
      const existing = await this.findByToken(token);
      if (!existing) {
        return token;
      }
      attempts++;
    } while (attempts < maxAttempts);

    // Fallback with timestamp to ensure uniqueness
    return generateToken() + '_' + Date.now();
  }

  // Invitation management
  async acceptInvitation(token: string, acceptingUserId: string): Promise<void> {
    // Delete the invitation after acceptance
    const invitation = await this.findByToken(token);
    if (invitation) {
      await this.delete(invitation.id);
    }
  }

  async resendInvitation(id: number): Promise<Invitation> {
    // Generate new token and extend expiry
    const newToken = await this.generateUniqueToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return await this.update(id, {
      expiresAt: newExpiresAt
    });
  }

  async revokeInvitation(id: number): Promise<void> {
    await this.delete(id);
  }

  // Bulk operations
  async createBulkInvitations(data: BulkInvitationData): Promise<BulkInvitationResult> {
    const successful: Invitation[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const invitationData of data.invitations) {
      try {
        // Check if user is already a member
        const isAlreadyMember = await this.isUserAlreadyMember(data.organizationId, invitationData.email);
        if (isAlreadyMember) {
          failed.push({
            email: invitationData.email,
            error: 'User is already a member of this organization'
          });
          continue;
        }

        // Check for existing invitation
        const existingInvitation = await this.hasExistingInvitation(data.organizationId, invitationData.email);
        if (existingInvitation) {
          failed.push({
            email: invitationData.email,
            error: 'Invitation already exists for this email'
          });
          continue;
        }

        const invitation = await this.create({
          organizationId: typeof data.organizationId === 'number' ? OrganizationId.fromNumber(data.organizationId) : data.organizationId,
          invitedBy: typeof data.invitedBy === 'string' ? UserId.fromString(data.invitedBy) : data.invitedBy,
          email: typeof invitationData.email === 'string' ? EmailAddress.fromString(invitationData.email) : invitationData.email,
          role: typeof invitationData.role === 'string' ? OrganizationRole.fromString(invitationData.role || data.defaultRole || 'member') : invitationData.role || OrganizationRole.fromString(data.defaultRole || 'member'),
          expiresAt: data.expiresAt
        });

        successful.push(invitation);
      } catch (error) {
        failed.push({
          email: invitationData.email,
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

  async deleteExpiredInvitations(organizationId?: number): Promise<number> {
    const now = new Date();
    const conditions = [lt(invitations.expiresAt, now)];
    
    if (organizationId) {
      conditions.push(eq(invitations.organizationId, organizationId));
    }
    
    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    // First count how many will be deleted
    const countResults = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(invitations)
      .where(whereCondition);
    
    const count = countResults[0]?.count || 0;

    // Then delete them
    await this.db
      .delete(invitations)
      .where(whereCondition);

    return count;
  }

  async deleteInvitationsByEmail(organizationId: number, email: string): Promise<number> {
    const whereCondition = and(
      eq(invitations.organizationId, organizationId),
      eq(invitations.email, email.toLowerCase())
    );

    // First count how many will be deleted
    const countResults = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(invitations)
      .where(whereCondition);
    
    const count = countResults[0]?.count || 0;

    // Then delete them
    await this.db
      .delete(invitations)
      .where(whereCondition);

    return count;
  }

  // Statistics and analytics
  async getInvitationStats(organizationId: number): Promise<InvitationStats> {
    const now = new Date();
    
    // Get all invitations for the organization
    const allInvitations = await this.db
      .select({
        role: invitations.role,
        expiresAt: invitations.expiresAt
      })
      .from(invitations)
      .where(eq(invitations.organizationId, organizationId));

    const stats = {
      organizationId,
      totalInvitations: allInvitations.length,
      pendingInvitations: allInvitations.filter(inv => inv.expiresAt > now).length,
      expiredInvitations: allInvitations.filter(inv => inv.expiresAt <= now).length,
      acceptedInvitations: 0, // This would need to be tracked separately
      invitationsByRole: {
        owner: allInvitations.filter(inv => inv.role === 'owner').length,
        admin: allInvitations.filter(inv => inv.role === 'admin').length,
        member: allInvitations.filter(inv => inv.role === 'member').length
      }
    };

    return stats;
  }

  async getPendingInvitations(organizationId: number): Promise<Invitation[]> {
    const now = new Date();
    
    const results = await this.db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.organizationId, organizationId),
        gte(invitations.expiresAt, now)
      ))
      .orderBy(desc(invitations.createdAt));

    return results.map(result => this.mapToEntity(result));
  }

  async getExpiredInvitations(organizationId: number): Promise<Invitation[]> {
    const now = new Date();
    
    const results = await this.db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.organizationId, organizationId),
        lt(invitations.expiresAt, now)
      ))
      .orderBy(desc(invitations.createdAt));

    return results.map(result => this.mapToEntity(result));
  }

  // Business logic validations
  async canInviteToOrganization(inviterId: string, organizationId: number): Promise<boolean> {
    // Check if inviter is a member with admin or owner role
    const membership = await this.db
      .select({ role: userOrganizations.role })
      .from(userOrganizations)
      .where(and(
        eq(userOrganizations.userId, inviterId),
        eq(userOrganizations.organizationId, organizationId)
      ))
      .limit(1);

    if (membership.length === 0) return false;
    
    const role = membership[0].role;
    return role === 'owner' || role === 'admin';
  }

  async hasExistingInvitation(organizationId: number, email: string): Promise<boolean> {
    const existing = await this.findByEmail(organizationId, email);
    return existing !== null;
  }

  async isUserAlreadyMember(organizationId: number, email: string): Promise<boolean> {
    // Check if user with this email is already a member
    const membership = await this.db
      .select({ id: userOrganizations.id })
      .from(userOrganizations)
      .innerJoin(users, eq(users.id, userOrganizations.userId))
      .where(and(
        eq(users.email, email.toLowerCase()),
        eq(userOrganizations.organizationId, organizationId)
      ))
      .limit(1);

    return membership.length > 0;
  }

  // Email and notification support
  async getInvitationEmailData(id: number): Promise<{
    invitation: Invitation;
    organization: { name: string; id: number };
    inviter: { name?: string; email?: string };
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
      .where(eq(invitations.id, id))
      .limit(1);

    if (results.length === 0) return null;

    const result = results[0];
    return {
      invitation: this.mapToEntity(result.invitation),
      organization: {
        name: result.organizationName,
        id: result.invitation.organizationId
      },
      inviter: {
        name: result.inviterName || undefined,
        email: result.inviterEmail || undefined
      }
    };
  }

  // Helper method to map database result to domain entity
  private mapToEntity(data: any): Invitation {
    return {
      id: data.id,
      organizationId: data.organizationId,
      invitedBy: data.invitedBy,
      email: data.email,
      role: data.role,
      token: data.token,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt || null
    };
  }
}