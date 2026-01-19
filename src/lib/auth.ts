import NextAuth from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/ddd/infrastructure/db/client"
import { sendVerificationRequestEmail } from "./email"
import { users, accounts, sessions, verificationTokens, organizations, userOrganizations } from "@/ddd/infrastructure/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { getSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react"
import { Permission, type PermissionCheck } from '@/ddd/domain/shared/value-objects/permission'
import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects'
import { getRBACRepository } from "@/ddd/application/di/container"
import { PermissionDeniedError } from '@/lib/errors'
import { apps } from "@/ddd/infrastructure/db/schema"

// AIDEV-NOTE: Helper function to extract app context from public URL
// Determines which app user is signing into from the callbackUrl
async function extractAppContextFromUrl(url: string | null): Promise<{ orgSlug: string; appSlug: string; appId: number } | null> {
  if (!url) return null;

  // Parse URL like "/public/acme/crm/..." or "http://localhost:3000/public/acme/crm/..."
  const match = url.match(/\/public\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const [_, orgSlug, appSlug] = match;

  try {
    // Look up app by slug to get appId
    const appResults = await db
      .select({
        id: apps.id,
        slug: apps.slug,
        orgId: apps.organizationId
      })
      .from(apps)
      .innerJoin(organizations, eq(apps.organizationId, organizations.id))
      .where(eq(apps.slug, appSlug))
      .limit(1);

    if (appResults.length === 0) return null;

    const app = appResults[0];
    return { orgSlug, appSlug, appId: app.id };
  } catch (error) {
    console.error('Error extracting app context from URL:', error);
    return null;
  }
}

// AIDEV-NOTE: Get authenticated user ID from request session
// SECURITY: Development bypass removed - use proper test authentication instead
export async function getUserIdFromRequest(_request: Request): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
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
          session.user.jobTitle = userRecord?.jobTitle;

          // NEW: Add app-only user fields
          session.user.isAppOnlyUser = userRecord?.isAppOnlyUser || false;
          session.user.allowedApps = userRecord?.allowedApps || null;

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
                ...uo.organization
              }));

              // Get current organization details
              if (userRecord.currentOrganizationId) {
                const currentOrg = userOrgs.find((uo: any) => uo.organization.id === userRecord.currentOrganizationId);
                session.user.currentOrganization = currentOrg ? {
                  ...currentOrg.organization
                } : null;
              }

              // If no current organization is set, but the user has available organizations,
              // set the first one as the current organization.
              if (!session.user.currentOrganization && userOrgs.length > 0) {
                const firstOrg = userOrgs[0];
                session.user.currentOrganization = {
                  ...firstOrg.organization
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
          // User needs setup if they don't have a current organization
          const needsSetup = !session.user.currentOrganizationId;
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
    async signIn({ user, account, profile }: any) {
      try {
        // Check if user already exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        const userExists = existingUser.length > 0;

        // For existing users, validate access based on user type
        if (userExists) {
          const dbUser = existingUser[0];
          // App-only users are allowed to sign in from /public/* routes
          // Organization users can sign in from anywhere
          // This check happens in middleware for platform route protection
          return true;
        }

        // For new users, they will be created by the adapter automatically
        // We'll set isAppOnlyUser in a separate callback or during first session
        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return true; // Allow sign in to proceed, let NextAuth handle errors
      }
    },
    async redirect({ url, baseUrl }: any) {
      // Allow relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      // Allow same origin URLs
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch (error) {
        console.warn('Invalid URL in redirect:', url);
      }

      // Default redirect: check if it's a public app context or platform
      // If URL is from public app route, keep them there
      // Otherwise, send to platform dashboard
      if (url.includes('/public/')) {
        return url;
      }

      // Default to platform dashboard
      return `${baseUrl}/mission-control/dashboard`;
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
    // SECURITY: secure=true for all deployed environments, false only for localhost
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? true,
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? true,
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? true,
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

export async function hasPermission(userId: string, permission: PermissionCheck, organizationId: number): Promise<boolean> {
  try {
    const rbac = getRBACRepository();
    const userIdVO = UserId.fromString(userId);
    const orgIdVO = OrganizationId.fromNumber(organizationId);
    const permissionVO = typeof permission === 'string' ? Permission.fromString(permission) : permission;
    
    return await rbac.hasPermission(userIdVO, permissionVO, orgIdVO);
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

export async function requirePermission(userId: string, permission: PermissionCheck, organizationId: number): Promise<void> {
  try {
    const rbac = getRBACRepository();
    const userIdVO = UserId.fromString(userId);
    const orgIdVO = OrganizationId.fromNumber(organizationId);
    const permissionVO = typeof permission === 'string' ? Permission.fromString(permission) : permission;
    
    await rbac.requirePermission(userIdVO, permissionVO, orgIdVO);
  } catch (error) {
    const permissionString = typeof permission === 'string' ? permission : permission.toString();
    console.error('🚫 RBAC permission check failed:', {
      userId,
      organizationId,
      requiredPermission: permissionString,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Throw structured error that Python agent layer can parse
    throw PermissionDeniedError.fromPermission(permissionString);
  }
}