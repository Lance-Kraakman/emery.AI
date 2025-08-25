// AIDEV-NOTE: Updated User entity to use DDD Value Objects for type safety
import { 
  UserId, 
  OrganizationId, 
  EmailAddress, 
  ApiKey, 
  OrganizationRole 
} from '@/ddd/domain/shared/value-objects';

export interface User {
  id: UserId;
  name?: string | null;
  email?: EmailAddress | null;
  emailVerified?: Date | null;
  image?: string | null;
  currentOrganizationId?: OrganizationId | null;
  roleId?: number | null;
  jobTitle?: string | null;
  role?: OrganizationRole | null;
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
  roleId?: number;
  jobTitle?: string;
  role?: OrganizationRole;
  teams?: string[];
  apiKey?: ApiKey;                     // Usually generated, not provided
}

export interface UpdateUserData {
  name?: string;
  email?: EmailAddress;
  emailVerified?: Date;
  image?: string;
  currentOrganizationId?: OrganizationId | null;
  roleId?: number;
  jobTitle?: string;
  role?: OrganizationRole;
  teams?: string[];
  // Note: apiKey updates handled through separate methods for security
}

export interface UserOrganization {
  id: number;
  userId: UserId;
  organizationId: OrganizationId;
  role: OrganizationRole;              // owner, admin, member
  createdAt?: Date | null;
  // Note: No updatedAt field - not present in user_organizations table schema
}

export interface CreateUserOrganizationData {
  userId: UserId;
  organizationId: OrganizationId;
  role?: OrganizationRole;             // defaults to 'member'
}

// Session data for NextAuth integration
export interface SessionData {
  sessionToken: string;
  userId: UserId;
  expires: Date;
}

export interface CreateSessionData {
  sessionToken: string;
  userId: UserId;
  expires: Date;
}