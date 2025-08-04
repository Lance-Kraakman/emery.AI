import NextAuth from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db/client"
import { users, accounts, sessions, verificationTokens, roles } from "./db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { getSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react"

const authOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email"
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }: any) {
      if (session.user) {
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        
        const userRecord = dbUser[0];

        session.user.id = user.id;
        session.user.organizationId = userRecord?.organizationId;
        session.user.roleId = userRecord?.roleId;
        session.user.jobTitle = userRecord?.jobTitle;
      }
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "database" as const,
  },
}

export default NextAuth(authOptions)

// For server components
export async function auth() {
  return getServerSession(authOptions)
}

// For client components  
export { getSession }

// Sign in/out functions
export const signIn = nextAuthSignIn
export const signOut = nextAuthSignOut

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const userQuery = await db
      .select({
        user: users,
        role: roles,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    const user = userQuery[0];
    if (!user?.role?.permissions) {
      return false;
    }

    return user.role.permissions.includes(permission);
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

export async function requirePermission(userId: string, permission: string) {
  const hasAccess = await hasPermission(userId, permission);
  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission}`);
  }
}