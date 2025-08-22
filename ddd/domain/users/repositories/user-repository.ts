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
import type { Organization } from '../entities/organization';

export interface IUserRepository {
  // Basic CRUD operations
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
  
  // API Key management
  generateApiKey(userId: string): Promise<string>;
  findByApiKey(apiKey: string): Promise<User | null>;
  revokeApiKey(userId: string): Promise<void>;
  
  // Organization management
  switchOrganization(userId: string, organizationId: number): Promise<void>;
  getUserOrganizations(userId: string): Promise<Organization[]>;
  
  // User-Organization relationship management
  addUserToOrganization(data: CreateUserOrganizationData): Promise<UserOrganization>;
  removeUserFromOrganization(userId: string, organizationId: number): Promise<void>;
  getUserOrganizationRole(userId: string, organizationId: number): Promise<string | null>;
  updateUserOrganizationRole(userId: string, organizationId: number, role: string): Promise<UserOrganization>;
  
  // Session management (NextAuth integration)
  createSession(data: CreateSessionData): Promise<void>;
  findSession(sessionToken: string): Promise<SessionData | null>;
  deleteSession(sessionToken: string): Promise<void>;
  deleteAllUserSessions(userId: string): Promise<void>;
  
  // User queries for admin operations
  findByOrganizationId(organizationId: number): Promise<User[]>;
  findByRoleId(roleId: number): Promise<User[]>;
  
  // Business logic operations
  verifyEmail(userId: string): Promise<User>;
  updateLastLogin(userId: string): Promise<void>;
  getUserWithOrganizations(userId: string): Promise<(User & { organizations: Organization[] }) | null>;
}