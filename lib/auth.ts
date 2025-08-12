import NextAuth from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db/client"
import { users, accounts, sessions, verificationTokens, roles, organizations, userOrganizations } from "./db/schema"
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
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || "localhost",
        port: parseInt(process.env.EMAIL_SERVER_PORT || "1025"),
        // MailHog doesn't require authentication, so omit auth for localhost
        ...(process.env.EMAIL_SERVER_HOST === "localhost" || !process.env.EMAIL_SERVER_HOST 
          ? {} 
          : {
              auth: {
                user: process.env.EMAIL_SERVER_USER || "",
                pass: process.env.EMAIL_SERVER_PASSWORD || "",
              }
            }
        ),
      },
      from: process.env.EMAIL_FROM || "noreply@emery.dev",
    }),
  ],
  callbacks: {
    async session({ session, user }: any) {
      if (session.user) {
        try {
          const dbUser = await db
            .select()
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);
          
          const userRecord = dbUser[0];

          session.user.id = user.id;
          session.user.currentOrganizationId = userRecord?.currentOrganizationId;
          session.user.roleId = userRecord?.roleId;
          session.user.jobTitle = userRecord?.jobTitle;
          
          // Get user's organizations and current organization details
          if (userRecord) {
            try {
              const userOrgs = await db
                .select({
                  organization: organizations,
                  userOrg: userOrganizations
                })
                .from(userOrganizations)
                .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
                .where(eq(userOrganizations.userId, user.id));

              session.user.availableOrganizations = userOrgs.map(uo => ({
                ...uo.organization,
                userRole: uo.userOrg.role
              }));

              // Get current organization details
              if (userRecord.currentOrganizationId) {
                const currentOrg = userOrgs.find(uo => uo.organization.id === userRecord.currentOrganizationId);
                session.user.currentOrganization = currentOrg ? {
                  ...currentOrg.organization,
                  userRole: currentOrg.userOrg.role
                } : null;
              }
            } catch (orgError) {
              console.warn("Could not load user organizations:", orgError);
              session.user.availableOrganizations = [];
            }
          }
          
          // Check if this is the first user (potential super admin)
          if (!userRecord?.currentOrganizationId || !userRecord?.roleId || !session.user.availableOrganizations?.length) {
            try {
              const userCount = await db.select().from(users);
              session.user.isFirstUser = userCount.length === 1;
              session.user.needsSetup = true;
            } catch (countError) {
              console.warn("Could not check user count in session callback:", countError);
              session.user.isFirstUser = false;
              session.user.needsSetup = true; // Assume setup needed if we can't check
            }
          }
        } catch (dbError) {
          console.error("Database error in session callback:", dbError);
          // Continue with basic session info even if DB lookup fails
          session.user.id = user.id;
          session.user.needsSetup = true;
        }
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
    // Check if it's a user
    const userQuery = await db
      .select({
        user: users,
        role: roles,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (userQuery.length > 0) {
      const user = userQuery[0];
      if (!user?.role?.permissions) {
        return false;
      }
      return user.role.permissions.includes(permission);
    }

    // If not a user, check if it's a worker (by API key or worker ID)
    // This allows workers to have permissions too
    return false; // For now, workers need separate handling
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