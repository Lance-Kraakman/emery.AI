// AIDEV-NOTE: User repository interface - authentication foundation for application
// Defines business operations for user management, authentication, and session handling

import type { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  UserOrganization,
  CreateUserOrganizationData,
  SessionData,
  CreateSessionData
} from '../entities/user';
import type { Organization } from '@/ddd/domain/organizations/entities/organization';
import { 
  UserId, 
  OrganizationId, 
  EmailAddress, 
  ApiKey, 
  OrganizationRole 
} from '@/ddd/domain/shared/value-objects';

export interface IUserRepository {
  // Basic CRUD operations
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: UserId, data: UpdateUserData): Promise<User>;
  delete(id: UserId): Promise<void>;
  
  // API Key management
  generateApiKey(userId: UserId): Promise<ApiKey>;
  findByApiKey(apiKey: ApiKey): Promise<User | null>;
  revokeApiKey(userId: UserId): Promise<void>;
  
  // Organization management
  switchOrganization(userId: UserId, organizationId: OrganizationId): Promise<void>;
  getUserOrganizations(userId: UserId): Promise<Organization[]>;
  
  // User-Organization relationship management
  addUserToOrganization(data: CreateUserOrganizationData): Promise<UserOrganization>;
  removeUserFromOrganization(userId: UserId, organizationId: OrganizationId): Promise<void>;
  getUserOrganizationRole(userId: UserId, organizationId: OrganizationId): Promise<OrganizationRole | null>;
  updateUserOrganizationRole(userId: UserId, organizationId: OrganizationId, role: OrganizationRole): Promise<UserOrganization>;
  
  // Session management (NextAuth integration)
  createSession(data: CreateSessionData): Promise<void>;
  findSession(sessionToken: string): Promise<SessionData | null>;
  deleteSession(sessionToken: string): Promise<void>;
  deleteAllUserSessions(userId: UserId): Promise<void>;
  
  // User queries for admin operations
  findByOrganizationId(organizationId: OrganizationId): Promise<User[]>;
  findByRoleId(roleId: number): Promise<User[]>;
  
  // Business logic operations
  verifyEmail(userId: UserId): Promise<User>;
  updateLastLogin(userId: UserId): Promise<void>;
  getUserWithOrganizations(userId: UserId): Promise<(User & { organizations: Organization[] }) | null>;
}