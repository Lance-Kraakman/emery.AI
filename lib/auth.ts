import NextAuth from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db/client"
import { sendVerificationRequestEmail } from "./email"
import { users, accounts, sessions, verificationTokens, roles, organizations, userOrganizations } from "./db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { getSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react"

// AIDEV-NOTE: Development bypass for testing - allows tests to authenticate as specific user
export function getTestUserId(): string {
  return "550e8400-e29b-41d4-a716-446655440000";
}

export function isDevelopmentBypass(): boolean {
  return process.env.NODE_ENV === "development";
}

// AIDEV-NOTE: Reusable development bypass for API routes
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const session = await auth();
  
  // Return authenticated user ID if available
  if (session?.user?.id) {
    return session.user.id;
  }
  
  // Development bypass for testing
  if (isDevelopmentBypass()) {
    const testUserId = request.headers.get('x-test-user-id');
    if (testUserId === getTestUserId()) {
      return testUserId;
    }
  }
  
  return null;
}

export const authOptions = {
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
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: sendVerificationRequestEmail,
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

              session.user.availableOrganizations = userOrgs.map((uo: any) => ({
                ...uo.organization,
                userRole: uo.userOrg.role
              }));

              // Get current organization details
              if (userRecord.currentOrganizationId) {
                const currentOrg = userOrgs.find((uo: any) => uo.organization.id === userRecord.currentOrganizationId);
                session.user.currentOrganization = currentOrg ? {
                  ...currentOrg.organization,
                  userRole: currentOrg.userOrg.role
                } : null;
              }

              // If no current organization is set, but the user has available organizations,
              // set the first one as the current organization.
              if (!session.user.currentOrganization && userOrgs.length > 0) {
                const firstOrg = userOrgs[0];
                session.user.currentOrganization = {
                  ...firstOrg.organization,
                  userRole: firstOrg.userOrg.role
                };
                session.user.currentOrganizationId = firstOrg.organization.id;

                // Update the user record in the database
                await db.update(users)
                  .set({ currentOrganizationId: firstOrg.organization.id })
                  .where(eq(users.id, user.id));
              }
            } catch (orgError) {
              console.warn("Could not load user organizations:", orgError);
              session.user.availableOrganizations = [];
            }
          }
          
          // After attempting to set the organization, check if the user still needs setup.
          const needsSetup = !session.user.currentOrganizationId || !userRecord.roleId;
          session.user.needsSetup = needsSetup;

          if (needsSetup) {
            try {
              const userCountResult = await db.select().from(users);
              session.user.isFirstUser = userCountResult.length === 1;
            } catch (countError) {
              console.warn("Could not check user count in session callback:", countError);
              session.user.isFirstUser = false;
            }
          } else {
            session.user.isFirstUser = false;
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
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to true if using HTTPS
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to true if using HTTPS
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to true if using HTTPS
      }
    }
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
