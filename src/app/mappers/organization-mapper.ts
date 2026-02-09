import { Organization, OrganizationWithMembers, OrganizationMember } from '@/ddd/domain/organizations/entities/organization';

export interface OrganizationDTO {
  id: number;
  name: string;
  slug?: string | null;
  mission?: string | null;
  sharedTools?: string[] | null;
  sharedServers?: string[] | null;
  databaseId?: string | null;
  viewConfig?: Record<string, any> | null;
  plan?: 'free' | 'pro' | 'max' | 'enterprise' | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  analysisCapabilities?: any | null; // Keep complex nested objects as-is for now
  defaultModel?: string | null; // Organization-wide default model
  createdAt?: Date | null;
  userRoles?: Array<{id: number; name: string; isSystem: boolean}>; // Multi-role support
  hasRoleError?: boolean; // Added for getCurrentOrganization response
}

export interface OrganizationWithMembersDTO extends OrganizationDTO {
  memberCount: number;
  members?: OrganizationMemberDTO[];
}

export interface OrganizationMemberDTO {
  userId: string;
  name?: string | null;
  email?: string | null;
  joinedAt?: Date | null;
  roles: Array<{id: number; name: string; isSystem: boolean}>; // Full role objects
  hasRoleError?: boolean;
}

/**
 * Simple user DTO for UI components that need basic user info with roles
 * Used by agent components for owner selection, etc.
 */
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  roles: Array<{id: number; name: string; isSystem: boolean}>;
}

export class OrganizationMapper {
  static toDTO(organization: Organization & { userRoles?: Array<{id: number; name: string; isSystem: boolean}>; hasRoleError?: boolean }): OrganizationDTO {
    return {
      id: organization.id.value,
      name: organization.name.value,
      slug: organization.slug,
      mission: organization.mission,
      sharedTools: organization.sharedTools,
      sharedServers: organization.sharedServers,
      databaseId: organization.databaseId,
      viewConfig: organization.viewConfig,
      plan: organization.plan,
      stripeCustomerId: organization.stripeCustomerId,
      stripeSubscriptionId: organization.stripeSubscriptionId,
      stripeSubscriptionStatus: organization.stripeSubscriptionStatus,
      analysisCapabilities: organization.analysisCapabilities,
      defaultModel: organization.defaultModel,
      createdAt: organization.createdAt,
      userRoles: organization.userRoles,
      hasRoleError: organization.hasRoleError
    };
  }

  static toWithMembersDTO(organization: OrganizationWithMembers): OrganizationWithMembersDTO {
    return {
      ...this.toDTO(organization),
      memberCount: organization.memberCount,
      members: organization.members?.map(this.memberToDTO)
    };
  }

  static memberToDTO(member: OrganizationMember): OrganizationMemberDTO {
    return {
      userId: member.userId.value,
      name: member.name,
      email: member.email?.value || null,
      roles: member.roles.map(r => ({
        id: r.id,
        name: r.name,
        isSystem: r.isSystem
      })), // Full role objects
      joinedAt: member.joinedAt,
      hasRoleError: false // TODO: Add roleError to OrganizationMember domain if needed
    };
  }

  /**
   * Convert OrganizationMemberDTO to simplified UserDTO for UI components
   * Used by agent components that need user data with roles
   */
  static memberToUser(member: OrganizationMemberDTO): UserDTO {
    return {
      id: member.userId,
      name: member.name || 'Unknown User',
      email: member.email || '',
      roles: member.roles
    };
  }

  /**
   * Get the primary role name from a user's roles
   * Primary role is the first system role, or first role if no system roles
   */
  static getPrimaryRoleName(roles: Array<{id: number; name: string; isSystem: boolean}>): string {
    const primaryRole = roles.find(r => r.isSystem) || roles[0];
    return primaryRole?.name || 'Member';
  }
}