// AIDEV-NOTE: Updated User entity to use DDD Value Objects for type safety
import { 
  UserId, 
  OrganizationId, 
  EmailAddress, 
  ApiKey
} from '@/ddd/domain/shared/value-objects';
import { SystemRoleType } from '@/ddd/domain/rbac/entities/role';

export interface User {
  id: UserId;
  name?: string | null;
  email?: EmailAddress | null;
  emailVerified?: Date | null;
  image?: string | null;
  currentOrganizationId?: OrganizationId | null;
  // Role management now handled via RBAC user_roles table
  // organizationRole field removed - use RBAC system instead
  jobTitle?: string | null;
  teams?: string[] | null;
  apiKey?: ApiKey | null;
  createdAt?: Date | null;
}

export interface CreateUserData {
  id?: UserId;                         // Optional, will generate UUID if not provided
  name?: string;
  email: EmailAddress;                 // Required for creation
  emailVerified?: Date;
  image?: string;
  currentOrganizationId?: OrganizationId;
  // Simplified 3-role system
  // organizationRole field removed - use assignRole() method instead
  jobTitle?: string;
  teams?: string[];
  apiKey?: ApiKey;                     // Usually generated, not provided
}

export interface UpdateUserData {
  name?: string;
  email?: EmailAddress;
  emailVerified?: Date;
  image?: string;
  currentOrganizationId?: OrganizationId | null;
  // Simplified 3-role system
  // organizationRole field removed - use updateUserRole() method instead
  jobTitle?: string;
  teams?: string[];
  // Note: apiKey updates handled through separate methods for security
}

export interface UserOrganization {
  id: number;
  userId: UserId;
  organizationId: OrganizationId;
  systemRole: SystemRoleType;         // RBAC system role
  createdAt?: Date | null;
  // Note: No updatedAt field - not present in user_organizations table schema
}

export interface CreateUserOrganizationData {
  userId: UserId;
  organizationId: OrganizationId;
  systemRole: SystemRoleType;         // Required RBAC system role
}

