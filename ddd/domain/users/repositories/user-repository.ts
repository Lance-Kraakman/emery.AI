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
  ApiKey, 
  OrganizationRole 
} from '@/ddd/domain/shared/value-objects';

// Transaction context type for RLS support
export type TransactionContext = any; // Will be the Drizzle transaction type

export interface IUserRepository {
  // Basic CRUD operations
  findById(id: UserId, tx?: TransactionContext): Promise<User | null>;
  findByEmail(email: EmailAddress, tx?: TransactionContext): Promise<User | null>;
  create(data: CreateUserData, tx?: TransactionContext): Promise<User>;
  update(id: UserId, data: UpdateUserData, tx?: TransactionContext): Promise<User>;
  delete(id: UserId, tx?: TransactionContext): Promise<void>;
  
  // API Key management
  generateApiKey(userId: UserId, tx?: TransactionContext): Promise<ApiKey>;
  findByApiKey(apiKey: ApiKey, tx?: TransactionContext): Promise<User | null>;
  revokeApiKey(userId: UserId, tx?: TransactionContext): Promise<void>;
  
  // Organization management
  switchOrganization(userId: UserId, organizationId: OrganizationId, tx?: TransactionContext): Promise<void>;
  getUserOrganizations(userId: UserId, tx?: TransactionContext): Promise<Organization[]>;
  
  // User-Organization relationship management  
  addUserToOrganization(data: CreateUserOrganizationData, tx?: TransactionContext): Promise<UserOrganization>;
  removeUserFromOrganization(userId: UserId, organizationId: OrganizationId, tx?: TransactionContext): Promise<void>;
  
  // Simplified role management - just update the user's organizationRole
  updateUserRole(userId: UserId, role: string, tx?: TransactionContext): Promise<User>;
  
  // User queries for admin operations
  findByOrganizationId(organizationId: OrganizationId, tx?: TransactionContext): Promise<User[]>;
  findByRole(organizationId: OrganizationId, role: string, tx?: TransactionContext): Promise<User[]>;
  
  // Role checking
  getUserOrganizationRole(userId: UserId, organizationId: OrganizationId, tx?: TransactionContext): Promise<string | null>;
  
  // Business logic operations
  verifyEmail(userId: UserId, tx?: TransactionContext): Promise<User>;
  updateLastLogin(userId: UserId, tx?: TransactionContext): Promise<void>;
  getUserWithOrganizations(userId: UserId, tx?: TransactionContext): Promise<(User & { organizations: Organization[] }) | null>;
  
  // Bootstrap methods for system-level operations
  createWithinTransaction(data: CreateUserData, tx: TransactionContext): Promise<User>;
}