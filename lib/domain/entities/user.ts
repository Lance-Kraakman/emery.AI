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
  id?: string; // Optional, will generate UUID if not provided
  name?: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  currentOrganizationId?: number;
  roleId?: number;
  jobTitle?: string;
  role?: string;
  teams?: string[];
}

export interface UpdateUserData extends Partial<CreateUserData> {}

export interface UserOrganization {
  id: number;
  userId: string;
  organizationId: number;
  role: string; // owner, admin, member
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface CreateUserOrganizationData {
  userId: string;
  organizationId: number;
  role?: string; // defaults to 'member'
}