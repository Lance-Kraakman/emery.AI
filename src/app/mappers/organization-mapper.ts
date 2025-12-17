import { Organization, OrganizationWithMembers, OrganizationMember } from '@/ddd/domain/organizations/entities/organization';
import { RoleDTO } from './permission-mapper';

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
}