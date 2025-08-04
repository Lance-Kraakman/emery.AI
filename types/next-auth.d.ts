import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      organizationId?: number
      roleId?: number
      jobTitle?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    organizationId?: number
    roleId?: number
    jobTitle?: string
  }
}