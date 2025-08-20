export interface Organization {
  id: number;
  name: string;
  mission?: string | null;
  sharedTools?: string[] | null;
  sharedServers?: string[] | null;
  databaseId?: string | null;
  viewConfig?: Record<string, any> | null;
  plan?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  createdAt?: Date | null;
  // Note: No updatedAt field - not present in organizations table schema
}

export interface CreateOrganizationData {
  name: string;
  mission?: string;
  sharedTools?: string[];
  sharedServers?: string[];
  databaseId?: string;
  viewConfig?: Record<string, any>;
  plan?: string;
}

export interface UpdateOrganizationData extends Partial<CreateOrganizationData> {}

export interface OrganizationWithMembers extends Organization {
  memberCount: number;
  members?: OrganizationMember[];
}

export interface OrganizationMember {
  userId: string;
  name?: string | null;
  email?: string | null;
  role: string; // owner, admin, member
  joinedAt?: Date | null;
}