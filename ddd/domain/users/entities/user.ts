export interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  currentOrganizationId?: number | null;
  roleId?: number | null;
  jobTitle?: string | null;
  role?: string | null;
  teams?: string[] | null;
  apiKey?: string | null;
  createdAt?: Date | null;
}

export interface CreateUserData {
  id?: string;                         // Optional, will generate UUID if not provided
  name?: string;
  email: string;                       // Required for creation
  emailVerified?: Date;
  image?: string;
  currentOrganizationId?: number;
  roleId?: number;
  jobTitle?: string;
  role?: string;
  teams?: string[];
  apiKey?: string;                     // Usually generated, not provided
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  currentOrganizationId?: number;
  roleId?: number;
  jobTitle?: string;
  role?: string;
  teams?: string[];
  // Note: apiKey updates handled through separate methods for security
}

export interface UserOrganization {
  id: number;
  userId: string;
  organizationId: number;
  role: string;                        // owner, admin, member
  createdAt?: Date | null;
  // Note: No updatedAt field - not present in user_organizations table schema
}

export interface CreateUserOrganizationData {
  userId: string;
  organizationId: number;
  role?: string;                       // defaults to 'member'
}

// Session data for NextAuth integration
export interface SessionData {
  sessionToken: string;
  userId: string;
  expires: Date;
}

export interface CreateSessionData {
  sessionToken: string;
  userId: string;
  expires: Date;
}