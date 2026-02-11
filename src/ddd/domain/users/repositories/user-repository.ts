// AIDEV-NOTE: User repository interface - authentication foundation for application
// Defines business operations for user management and authentication

import type { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  UserOrganization,
  CreateUserOrganizationData
} from '../entities/user';
import type { Organization } from '@/ddd/domain/organizations/entities/organization';
import { 
  UserId, 
  OrganizationId, 
  EmailAddress, 
  ApiKey
} from '@/ddd/domain/shared/value-objects';

export interface IUserRepository {
  // Basic CRUD operations
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: UserId, data: UpdateUserData): Promise<User>;
  delete(id: UserId): Promise<void>;
  
  // API Key management (SHA-256 hashed storage)
  generateApiKey(userId: UserId): Promise<{ apiKey: ApiKey; plaintext: string }>;
  findByApiKey(apiKey: ApiKey): Promise<User | null>;
  revokeApiKey(userId: UserId): Promise<void>;
  
  // Organization management
  switchOrganization(userId: UserId, organizationId: OrganizationId): Promise<void>;
  getUserOrganizations(userId: UserId): Promise<Organization[]>;
  
  // User-Organization relationship management  
  addUserToOrganization(data: CreateUserOrganizationData): Promise<UserOrganization>;
  removeUserFromOrganization(userId: UserId, organizationId: OrganizationId): Promise<void>;
  
  // Role management now handled via RBAC system - use IRBACRepository
  // updateUserRole method removed - use RBAC assignRole() method instead
  
  // User queries for admin operations
  findByOrganizationId(organizationId: OrganizationId): Promise<User[]>;
  // findByRole removed - use RBAC permission-based queries instead
  
  // Role checking now handled via RBAC system - use IRBACRepository
  // getUserOrganizationRole removed - use RBAC getUserRoles() method instead
  
  // Business logic operations
  verifyEmail(userId: UserId): Promise<User>;
  getUserWithOrganizations(userId: UserId): Promise<(User & { organizations: Organization[] }) | null>;
  
}