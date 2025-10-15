import NextAuth, { DefaultSession } from "next-auth"

interface OrganizationWithRole {
  id: number
  name: string
  mission?: string | null
  userRole: string
  viewConfig?: Record<string, any> | null
  createdAt?: Date | null
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      currentOrganizationId?: number | null
      currentOrganization?: OrganizationWithRole | null
      availableOrganizations?: OrganizationWithRole[]
      roleId?: number
      jobTitle?: string
      isFirstUser?: boolean
      needsSetup?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    currentOrganizationId?: number | null
    currentOrganization?: OrganizationWithRole | null
    availableOrganizations?: OrganizationWithRole[]
    roleId?: number
    jobTitle?: string
    isFirstUser?: boolean
    needsSetup?: boolean
  }
}
