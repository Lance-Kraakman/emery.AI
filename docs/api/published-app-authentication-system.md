# Published App Authentication System - Technical Design Document

**Version:** 1.0
**Date:** 2025-01-14
**Status:** Design Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema Changes](#database-schema-changes)
4. [Domain Model Updates](#domain-model-updates)
5. [Authentication Flow](#authentication-flow)
6. [Public Routes Structure](#public-routes-structure)
7. [LoginBlock Component](#loginblock-component)
8. [Permission & Access Control](#permission--access-control)
9. [Security Considerations](#security-considerations)
10. [API Endpoints](#api-endpoints)
11. [Implementation Checklist](#implementation-checklist)

---

## 1. Overview

### Purpose
Enable published Puck applications to have authenticated user access where:
- **Organization users** can log into published apps with their existing Emery accounts
- **App-only users** can be created who have access ONLY to specific published apps (not the main Emery platform)
- Reuse existing NextAuth.js + RBAC permission system
- Support role-based page and element visibility

### Key Requirements
- `/public/[orgSlug]/[appSlug]/[pageSlug]` URL structure
- LoginBlock component for Puck editor
- Page-level authentication requirements (public, authenticated, role-based)
- Prevent app-only users from accessing main platform
- Use existing RBAC system for permissions
- Session management via NextAuth

### User Types Comparison

| Feature | Organization User | App-Only User |
|---------|------------------|---------------|
| Access to Emery Platform | ✅ Yes | ❌ No |
| Access to Published Apps | ✅ Yes | ✅ Yes (specific apps only) |
| Can create/edit Apps | ✅ Yes (with permissions) | ❌ No |
| Can create/edit Agents | ✅ Yes (with permissions) | ❌ No |
| Billing | Organization subscription | Per-user app access fee (future) |
| Authentication | GitHub/Google OAuth + Email | GitHub/Google OAuth + Email |
| First Signup Location | Anywhere (platform or published apps) | Must be from `/public/*` routes |
| Session Type | Full Emery session | Restricted app session |

---

## 2. Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Published App                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  /public/[orgSlug]/[appSlug]/[pageSlug]                  │  │
│  │                                                           │  │
│  │  ┌─────────────┐         ┌──────────────────┐           │  │
│  │  │   Puck      │         │ LoginBlock       │           │  │
│  │  │   Renderer  │────────▶│ (if needed)      │           │  │
│  │  └─────────────┘         └──────────────────┘           │  │
│  │         │                         │                      │  │
│  │         │                         ▼                      │  │
│  │         │              ┌──────────────────┐              │  │
│  │         │              │ PublicAppAuth    │              │  │
│  │         │              │ Provider         │              │  │
│  │         │              └──────────────────┘              │  │
│  │         │                         │                      │  │
│  └─────────┼─────────────────────────┼──────────────────────┘  │
│            │                         │                         │
│            ▼                         ▼                         │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │  NextAuth Session    │  │  Access Control      │           │
│  │  - User ID           │  │  - Page permissions  │           │
│  │  - isAppOnlyUser     │  │  - Role checks       │           │
│  │  - allowedApps       │  │  - RBAC integration  │           │
│  └──────────────────────┘  └──────────────────────┘           │
│            │                         │                         │
└────────────┼─────────────────────────┼─────────────────────────┘
             │                         │
             ▼                         ▼
    ┌────────────────────┐    ┌────────────────────┐
    │   Database         │    │  RLS Policies      │
    │   - users          │    │  - Public access   │
    │   - pages          │    │  - Auth checks     │
    │   - apps           │    │  - Role filtering  │
    └────────────────────┘    └────────────────────┘
```

### Data Flow

**1. Public Page Access (No Auth Required)**
```
User → /public/org/app/page → Check page.isPublic → Render content
```

**2. Protected Page Access (Auth Required)**
```
User → /public/org/app/protected-page
     → Check page.requiresAuth
     → No session? → Redirect to /public/org/app/login?redirect=/protected-page
     → Has session? → Check allowedRoles → Render or 403
```

**3. App-Only User Login**
```
User → /public/org/app/login
     → Enter credentials
     → NextAuth signIn
     → Session callback checks isAppOnlyUser
     → Set restricted session
     → Redirect to original page
```

**4. Organization User Login**
```
User → /public/org/app/login
     → OAuth (GitHub/Google) or Email
     → NextAuth signIn
     → Full session created
     → Check app access permissions
     → Redirect to page or Emery platform
```

**5. OAuth Sign-In Context Detection**
```
User → Signs in with GitHub/Google OAuth
     → NextAuth signIn callback checks: Is this from /public/* route?
     → If YES and new user → Create as app-only user with allowedApps
     → If YES and existing app-only user → Check allowedApps, grant access
     → If YES and existing org user → Allow access (org users can use published apps)
     → If NO (platform route) and app-only user → Block with error
     → If NO (platform route) and org user → Normal platform access
     → Session created with appropriate flags (isAppOnlyUser, allowedApps)
```

**Note:** The same OAuth providers (GitHub/Google) work for both organization users and app-only users. Account type is determined by where they first sign up (platform vs `/public/*` routes).

---

## 3. Database Schema Changes

### 3.1 Users Table Updates

**File:** `src/lib/db/schema.ts`

**New Fields:**
```typescript
export const users = pgTable("users", {
  // ... existing fields ...
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  currentOrganizationId: integer("current_organization_id").references(() => organizations.id),
  jobTitle: text("job_title"),
  teams: text("teams").array(),
  apiKey: text("api_key").unique(),
  createdAt: timestamp("created_at").defaultNow(),

  // NEW FIELDS for published app authentication
  isAppOnlyUser: boolean("is_app_only_user").default(false).notNull(),
  allowedApps: integer("allowed_apps").array(), // Array of app IDs this user can access
  passwordHash: text("password_hash"), // For app-only users (NextAuth stores in accounts table for OAuth)
}, (table) => [
  // ... existing policies ...

  // NEW: Public read policy for app-only users in published apps
  pgPolicy("users_public_app_read", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`is_app_only_user = true AND id = current_setting('app.current_user_id', true)::uuid`,
  }),
]);
```

**Migration Strategy:**
```sql
-- Add new columns with defaults
ALTER TABLE users
ADD COLUMN is_app_only_user BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN allowed_apps INTEGER[],
ADD COLUMN password_hash TEXT;

-- Create index for app-only user queries
CREATE INDEX idx_users_app_only ON users(is_app_only_user) WHERE is_app_only_user = true;

-- Create index for allowed apps array
CREATE INDEX idx_users_allowed_apps ON users USING GIN(allowed_apps);
```

### 3.2 Pages Table Updates

**New Fields:**
```typescript
export const pages = pgTable("pages", {
  // ... existing fields ...
  id: serial("id").primaryKey(),
  appId: integer("app_id").notNull().references(() => apps.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  order: integer("order").default(0).notNull(),
  templateData: jsonb("template_data").notNull().$type<PuckDataStructure>(),
  themeConfig: jsonb("theme_config"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // UPDATED: Rename for clarity
  isPublic: boolean("is_public").default(false).notNull(), // Was: isPublished

  // NEW FIELDS for authentication control
  requiresAuth: boolean("requires_auth").default(false).notNull(), // Does page require login?
  allowedRoles: text("allowed_roles").array(), // If set, only these roles can access (empty/null = all authenticated)
}, (table) => [
  // ... existing policies ...

  // UPDATED: Public read policy (anyone can view public pages)
  pgPolicy("pages_public_read", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`is_public = true AND requires_auth = false`,
  }),

  // NEW: Authenticated read policy (logged-in users can view auth-required pages)
  pgPolicy("pages_authenticated_read", {
    as: "permissive",
    for: "select",
    to: "public",
    using: sql`
      is_public = true
      AND requires_auth = true
      AND current_setting('app.current_user_id', true)::uuid IS NOT NULL
      AND (
        allowed_roles IS NULL
        OR allowed_roles = '{}'
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = current_setting('app.current_user_id', true)::uuid
          AND r.name = ANY(allowed_roles)
        )
      )
    `,
  }),
]);
```

**Migration Strategy:**
```sql
-- Rename column
ALTER TABLE pages RENAME COLUMN is_published TO is_public;

-- Add new columns
ALTER TABLE pages
ADD COLUMN requires_auth BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN allowed_roles TEXT[];

-- Create index for auth queries
CREATE INDEX idx_pages_auth ON pages(is_public, requires_auth);

-- Create index for role filtering
CREATE INDEX idx_pages_allowed_roles ON pages USING GIN(allowed_roles);
```

### 3.3 Apps Table Updates (Optional)

**New Fields (for app-level settings):**
```typescript
export const apps = pgTable("apps", {
  // ... existing fields ...

  // NEW: App-level authentication settings
  enablePublicAccess: boolean("enable_public_access").default(true).notNull(),
  defaultRequiresAuth: boolean("default_requires_auth").default(false).notNull(), // Default for new pages
  allowedDomains: text("allowed_domains").array(), // Future: custom domain support
}, (table) => [
  // ... existing policies ...
]);
```

---

## 4. Domain Model Updates

### 4.1 User Entity

**File:** `src/ddd/domain/users/entities/user.ts`

**Updated Interface:**
```typescript
import { UserId } from '../value-objects/user-id';
import { OrganizationId } from '@/ddd/domain/organizations/value-objects/organization-id';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { EmailAddress } from '../value-objects/email-address';
import { ApiKey } from '../value-objects/api-key';

export interface UserProps {
  id: UserId;
  name?: string;
  email?: EmailAddress;
  emailVerified?: Date;
  image?: string;
  currentOrganizationId?: OrganizationId;
  jobTitle?: string;
  teams?: string[];
  apiKey?: ApiKey;
  createdAt?: Date;

  // NEW: App-only user properties
  isAppOnlyUser?: boolean;
  allowedApps?: AppId[]; // null/undefined = all apps
  passwordHash?: string; // Only for app-only users
}

export class User {
  // ... existing implementation ...

  // NEW: Check if user can access specific app
  canAccessApp(appId: AppId): boolean {
    if (!this.props.isAppOnlyUser) {
      return true; // Organization users can access all published apps
    }

    if (!this.props.allowedApps || this.props.allowedApps.length === 0) {
      return true; // No restrictions means access all
    }

    return this.props.allowedApps.some(allowed => allowed.equals(appId));
  }

  // NEW: Check if user is restricted to apps only
  isRestrictedToApps(): boolean {
    return this.props.isAppOnlyUser === true;
  }

  // NEW: Grant app access
  grantAppAccess(appId: AppId): void {
    if (!this.props.isAppOnlyUser) {
      throw new Error('Cannot grant app access to organization users');
    }

    if (!this.props.allowedApps) {
      this.props.allowedApps = [];
    }

    if (!this.props.allowedApps.some(id => id.equals(appId))) {
      this.props.allowedApps.push(appId);
    }
  }

  // NEW: Revoke app access
  revokeAppAccess(appId: AppId): void {
    if (!this.props.allowedApps) return;

    this.props.allowedApps = this.props.allowedApps.filter(
      id => !id.equals(appId)
    );
  }
}
```

### 4.2 PuckPage Entity

**File:** `src/ddd/domain/puck/entities/puck-page.ts`

**Updated Interface:**
```typescript
export interface PuckPageProps {
  // ... existing fields ...
  id?: PageId;
  appId: AppId;
  name: string;
  slug: string;
  description?: string;
  order: number;
  templateData: PuckData;
  themeConfig?: ThemeConfig;
  createdBy: UserId;
  createdAt?: Date;
  updatedAt?: Date;

  // UPDATED: Rename for clarity
  isPublic: boolean; // Was: isPublished

  // NEW: Authentication control
  requiresAuth: boolean;
  allowedRoles?: string[]; // null/undefined/empty = all authenticated users
}

export class PuckPage extends AggregateRoot<PuckPageProps> {
  // ... existing implementation ...

  // NEW: Check if page is publicly accessible (no auth required)
  isPubliclyAccessible(): boolean {
    return this.props.isPublic && !this.props.requiresAuth;
  }

  // NEW: Check if user can access this page
  canUserAccess(userRoles?: string[]): boolean {
    // Public pages with no auth requirement
    if (this.isPubliclyAccessible()) {
      return true;
    }

    // Not published = no public access
    if (!this.props.isPublic) {
      return false;
    }

    // Published but requires auth
    if (this.props.requiresAuth) {
      // No user roles means not authenticated
      if (!userRoles || userRoles.length === 0) {
        return false;
      }

      // No role restrictions = any authenticated user
      if (!this.props.allowedRoles || this.props.allowedRoles.length === 0) {
        return true;
      }

      // Check if user has any of the allowed roles
      return userRoles.some(role => this.props.allowedRoles!.includes(role));
    }

    return false;
  }

  // NEW: Update authentication settings
  updateAccessControl(requiresAuth: boolean, allowedRoles?: string[]): void {
    this.props.requiresAuth = requiresAuth;
    this.props.allowedRoles = allowedRoles;
    this.props.updatedAt = new Date();
  }

  // NEW: Publish page (rename from setPublished)
  publish(): void {
    this.props.isPublic = true;
    this.props.updatedAt = new Date();
  }

  // NEW: Unpublish page
  unpublish(): void {
    this.props.isPublic = false;
    this.props.updatedAt = new Date();
  }
}
```

---

## 5. Authentication Flow

### 5.1 NextAuth Configuration Updates

**File:** `src/lib/auth.ts`

**Session Callback Enhancement:**
```typescript
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
  // ... existing config ...

  callbacks: {
    async session({ session, user }): Promise<Session> {
      // ... existing session enrichment ...

      // NEW: Add app-only user flags to session
      const dbUser = await getUserById(user.id);

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          isAppOnlyUser: dbUser.isAppOnlyUser || false,
          allowedApps: dbUser.allowedApps || null,
          currentOrganizationId: dbUser.currentOrganizationId,
          organizations: await getUserOrganizations(user.id),
          // ... existing fields ...
        }
      };
    },

    async signIn({ user, account, profile, callbackUrl }): Promise<boolean> {
      // NEW: OAuth context detection - determine account type based on signup location
      const dbUser = await getUserById(user.id);
      const isPublicAppRoute = callbackUrl?.includes('/public/') || false;

      // NEW USER - Create with appropriate type based on signup context
      if (!dbUser) {
        if (isPublicAppRoute) {
          // Create as app-only user
          const appContext = extractAppContextFromUrl(callbackUrl);
          await createUser({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            isAppOnlyUser: true,
            allowedApps: appContext?.appId ? [appContext.appId] : [],
          });
        } else {
          // Create as organization user (normal platform signup)
          await createUser({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            isAppOnlyUser: false,
          });
        }
        return true;
      }

      // EXISTING USER - Validate access based on user type and route
      if (dbUser.isAppOnlyUser && !isPublicAppRoute) {
        throw new Error('App-only users cannot access the main platform');
      }

      // Organization users can access everything (platform + published apps)
      // App-only users accessing /public/* routes will be validated for app access later

      return true;
    },

    async redirect({ url, baseUrl }): Promise<string> {
      // NEW: Handle app-only user redirects
      const session = await getSession();

      if (session?.user?.isAppOnlyUser) {
        // App-only users should never be redirected to main platform
        if (url.startsWith(baseUrl) && !url.includes('/public/')) {
          // Extract app context from URL or session
          const lastAppAccess = session.user.lastAppAccess; // Store in session
          if (lastAppAccess) {
            return `${baseUrl}/public/${lastAppAccess}`;
          }

          // Fallback: redirect to first allowed app
          if (session.user.allowedApps && session.user.allowedApps.length > 0) {
            const firstApp = await getAppById(session.user.allowedApps[0]);
            return `${baseUrl}/public/${firstApp.orgSlug}/${firstApp.slug}`;
          }

          // No allowed apps = sign out
          return `${baseUrl}/api/auth/signout`;
        }
      }

      // Default NextAuth behavior for org users
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  // NEW: Custom pages for public app auth
  pages: {
    signIn: '/auth/signin', // Default for platform
    // Public apps will use /public/[org]/[app]/login instead
  },
};
```

### 5.2 Session Type Extensions

**File:** `src/types/next-auth.d.ts`

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      currentOrganizationId?: number;
      organizations: Array<{
        id: number;
        name: string;
        slug: string;
      }>;

      // NEW: App-only user properties
      isAppOnlyUser: boolean;
      allowedApps: number[] | null;
      lastAppAccess?: string; // Format: "orgSlug/appSlug"
    };
  }
}
```

---

## 6. Public Routes Structure

### 6.1 Route Organization

```
src/app/public/
├── [orgSlug]/
│   ├── [appSlug]/
│   │   ├── layout.tsx                 # App-level layout with auth provider
│   │   ├── [pageSlug]/
│   │   │   └── page.tsx              # Individual page renderer
│   │   ├── login/
│   │   │   └── page.tsx              # Login page for this app
│   │   └── auth/
│   │       ├── signup/
│   │       │   └── page.tsx          # App user registration
│   │       └── error/
│   │           └── page.tsx          # Auth errors
│   └── not-found.tsx                 # Org not found
└── not-found.tsx                     # Root not found
```

### 6.2 Page Renderer Implementation

**File:** `src/app/public/[orgSlug]/[appSlug]/[pageSlug]/page.tsx`

```typescript
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PuckRenderer } from '@/components/puck/PuckRenderer';
import { getPublicPage } from '@/app/actions/public-pages';
import { checkPageAccess } from '@/app/actions/permissions';

interface PublicPageProps {
  params: {
    orgSlug: string;
    appSlug: string;
    pageSlug: string;
  };
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { orgSlug, appSlug, pageSlug } = params;

  // Fetch page data (no auth required for query)
  const result = await getPublicPage(orgSlug, appSlug, pageSlug);

  if (!result.success || !result.data) {
    notFound();
  }

  const page = result.data;
  const session = await getServerSession(authOptions);

  // Check access permissions
  const accessCheck = await checkPageAccess(
    page.id,
    session?.user?.id || null
  );

  if (!accessCheck.allowed) {
    if (accessCheck.redirectToLogin) {
      // Save requested URL for post-login redirect
      const callbackUrl = `/public/${orgSlug}/${appSlug}/${pageSlug}`;
      redirect(`/public/${orgSlug}/${appSlug}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } else {
      // User is authenticated but doesn't have access
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p>You don't have permission to view this page.</p>
          </div>
        </div>
      );
    }
  }

  // Render the Puck page
  return (
    <PuckRenderer
      data={page.templateData}
      config={config}
      theme={page.themeConfig}
    />
  );
}

// Generate static params for published pages (optional, for SSG)
export async function generateStaticParams() {
  const publishedPages = await getAllPublishedPages();

  return publishedPages.map((page) => ({
    orgSlug: page.orgSlug,
    appSlug: page.appSlug,
    pageSlug: page.slug,
  }));
}
```

### 6.3 App Layout with Auth Provider

**File:** `src/app/public/[orgSlug]/[appSlug]/layout.tsx`

```typescript
import { notFound } from 'next/navigation';
import { getPublicApp } from '@/app/actions/public-apps';
import { PublicAppAuthProvider } from '@/components/providers/PublicAppAuthProvider';
import { ThemeProvider } from '@/components/puck/theme-context';
import { ThemeConfig } from '@/ddd/domain/puck/value-objects/theme-config';

interface PublicAppLayoutProps {
  children: React.ReactNode;
  params: {
    orgSlug: string;
    appSlug: string;
  };
}

export default async function PublicAppLayout({
  children,
  params
}: PublicAppLayoutProps) {
  const { orgSlug, appSlug } = params;

  // Fetch app data
  const result = await getPublicApp(orgSlug, appSlug);

  if (!result.success || !result.data) {
    notFound();
  }

  const app = result.data;
  const theme = app.themeConfig
    ? ThemeConfig.create(app.themeConfig)
    : ThemeConfig.default();

  return (
    <PublicAppAuthProvider
      appId={app.id}
      orgSlug={orgSlug}
      appSlug={appSlug}
    >
      <ThemeProvider value={theme}>
        {children}
      </ThemeProvider>
    </PublicAppAuthProvider>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PublicAppLayoutProps) {
  const { orgSlug, appSlug } = params;
  const result = await getPublicApp(orgSlug, appSlug);

  if (!result.success || !result.data) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: result.data.name,
    description: result.data.description,
  };
}
```

### 6.4 Login Page Implementation

**File:** `src/app/public/[orgSlug]/[appSlug]/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FaGithub, FaGoogle } from 'react-icons/fa';

interface PublicLoginPageProps {
  params: {
    orgSlug: string;
    appSlug: string;
  };
}

export default function PublicLoginPage({ params }: PublicLoginPageProps) {
  const { orgSlug, appSlug } = params;
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || `/public/${orgSlug}/${appSlug}`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: true,
      });

      if (result?.error) {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setIsLoading(true);
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Sign in to continue</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your account to view this page
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in with Email'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => handleOAuthSignIn('github')}
            disabled={isLoading}
          >
            <FaGithub className="mr-2" />
            GitHub
          </Button>

          <Button
            variant="outline"
            onClick={() => handleOAuthSignIn('google')}
            disabled={isLoading}
          >
            <FaGoogle className="mr-2" />
            Google
          </Button>
        </div>

        <div className="text-center text-sm">
          <a
            href={`/public/${orgSlug}/${appSlug}/auth/signup`}
            className="text-blue-600 hover:text-blue-500"
          >
            Don't have an account? Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. LoginBlock Component

### 7.1 Component Structure

**File:** `src/components/puck/blocks/LoginBlock/index.tsx`

```typescript
import { ComponentConfig } from "@measured/puck";
import { LoginBlock as LoginBlockComponent } from "./LoginBlock";

export type LoginBlockProps = {
  title?: string;
  subtitle?: string;
  showOAuthProviders?: boolean;
  allowSignup?: boolean;
  redirectAfterLogin?: string;
  buttonText?: string;
  showOnlyWhenUnauthenticated?: boolean;
};

export const LoginBlock: ComponentConfig<LoginBlockProps> = {
  label: "Login Form",

  fields: {
    title: {
      type: "text",
      label: "Title",
    },
    subtitle: {
      type: "text",
      label: "Subtitle",
    },
    showOAuthProviders: {
      type: "radio",
      label: "Show OAuth Providers",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    allowSignup: {
      type: "radio",
      label: "Allow Signup",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    redirectAfterLogin: {
      type: "text",
      label: "Redirect After Login",
      placeholder: "Leave empty for current page",
    },
    buttonText: {
      type: "text",
      label: "Button Text",
    },
    showOnlyWhenUnauthenticated: {
      type: "radio",
      label: "Visibility",
      options: [
        { label: "Always show", value: false },
        { label: "Only when logged out", value: true },
      ],
    },
  },

  defaultProps: {
    title: "Sign in to your account",
    subtitle: "Access your personalized experience",
    showOAuthProviders: true,
    allowSignup: true,
    buttonText: "Sign in",
    showOnlyWhenUnauthenticated: true,
  },

  render: (props) => <LoginBlockComponent {...props} />,
};
```

### 7.2 Client Component Implementation

**File:** `src/components/puck/blocks/LoginBlock/LoginBlock.tsx`

```typescript
'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FaGithub, FaGoogle } from 'react-icons/fa';
import type { LoginBlockProps } from './index';

export function LoginBlock({
  title,
  subtitle,
  showOAuthProviders,
  allowSignup,
  redirectAfterLogin,
  buttonText,
  showOnlyWhenUnauthenticated,
}: LoginBlockProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide if user is authenticated and visibility is set to unauthenticated only
  if (showOnlyWhenUnauthenticated && status === 'authenticated') {
    return null;
  }

  // Show loading state during session check
  if (status === 'loading') {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-8"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const callbackUrl = redirectAfterLogin || pathname;

    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: true,
      });

      if (result?.error) {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // OAuth sign-in works for both org users and app-only users
  // Account type is determined by callbackUrl context (contains /public/* or not)
  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setIsLoading(true);
    const callbackUrl = redirectAfterLogin || pathname;
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        {title && <h2 className="text-2xl font-bold mb-2">{title}</h2>}
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailSignIn} className="space-y-4 mb-6">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : (buttonText || 'Sign in')}
        </Button>
      </form>

      {showOAuthProviders && (
        <>
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
              type="button"
            >
              <FaGithub className="mr-2" />
              GitHub
            </Button>

            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
              type="button"
            >
              <FaGoogle className="mr-2" />
              Google
            </Button>
          </div>
        </>
      )}

      {allowSignup && (
        <div className="text-center text-sm">
          <span className="text-gray-600">Don't have an account? </span>
          <a
            href={`${pathname.replace(/\/[^/]+$/, '')}/auth/signup`}
            className="text-blue-600 hover:text-blue-500"
          >
            Sign up
          </a>
        </div>
      )}
    </div>
  );
}
```

### 7.3 Registration in Puck Config

**File:** `src/components/puck/config.tsx`

```typescript
import { Config } from "@measured/puck";
// ... other imports ...
import { LoginBlock } from "./blocks/LoginBlock";

export const config: Config = {
  // ... existing config ...

  categories: {
    // ... existing categories ...
    interactive: {
      components: ["Button", "LoginBlock"], // Add LoginBlock here
    },
  },

  components: {
    // ... existing components ...
    LoginBlock,
  },
};
```

---

## 8. Permission & Access Control

### 8.1 Public App Auth Provider

**File:** `src/components/providers/PublicAppAuthProvider.tsx`

```typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface PublicAppAuthContextValue {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    roles: string[];
    isAppOnlyUser: boolean;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  appId: number;
  orgSlug: string;
  appSlug: string;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const PublicAppAuthContext = createContext<PublicAppAuthContextValue | null>(null);

interface PublicAppAuthProviderProps {
  children: ReactNode;
  appId: number;
  orgSlug: string;
  appSlug: string;
}

export function PublicAppAuthProvider({
  children,
  appId,
  orgSlug,
  appSlug
}: PublicAppAuthProviderProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    // Fetch user roles for this app
    if (session?.user?.id) {
      fetch(`/api/public/${orgSlug}/${appSlug}/user-roles`)
        .then(res => res.json())
        .then(data => setUserRoles(data.roles || []))
        .catch(err => console.error('Failed to fetch user roles:', err));
    } else {
      setUserRoles([]);
    }
  }, [session?.user?.id, orgSlug, appSlug]);

  // Track last app access in session
  useEffect(() => {
    if (session?.user?.id) {
      // Update last app access for redirects
      fetch('/api/auth/update-last-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appContext: `${orgSlug}/${appSlug}` }),
      }).catch(err => console.error('Failed to update last app access:', err));
    }
  }, [session?.user?.id, orgSlug, appSlug]);

  const value: PublicAppAuthContextValue = {
    user: session?.user ? {
      id: session.user.id,
      email: session.user.email || null,
      name: session.user.name || null,
      roles: userRoles,
      isAppOnlyUser: session.user.isAppOnlyUser || false,
    } : null,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    appId,
    orgSlug,
    appSlug,
    hasRole: (role: string) => userRoles.includes(role),
    hasAnyRole: (roles: string[]) => roles.some(role => userRoles.includes(role)),
  };

  return (
    <PublicAppAuthContext.Provider value={value}>
      {children}
    </PublicAppAuthContext.Provider>
  );
}

export function usePublicAppAuth() {
  const context = useContext(PublicAppAuthContext);
  if (!context) {
    throw new Error('usePublicAppAuth must be used within PublicAppAuthProvider');
  }
  return context;
}
```

### 8.2 Page Access Check Action

**File:** `src/app/actions/public-pages.ts`

```typescript
'use server';

import { z } from 'zod';
import { getPuckPageApplicationService } from '@/ddd/application/di/container';
import { getRBACRepository } from '@/ddd/application/di/container';
import { PageId } from '@/ddd/domain/puck/value-objects/page-id';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';
import type { Result } from './types';

/**
 * Check if user can access a published page
 * NO requirePermission() - this is for public access
 */
export async function checkPageAccess(
  pageId: number,
  userId: string | null
): Promise<{ allowed: boolean; redirectToLogin: boolean; reason?: string }> {
  try {
    const pageService = getPuckPageApplicationService();
    const page = await pageService.getPage(PageId.fromNumber(pageId));

    // Page must be published
    if (!page.isPublic) {
      return { allowed: false, redirectToLogin: false, reason: 'Page not published' };
    }

    // Public pages (no auth required)
    if (!page.requiresAuth) {
      return { allowed: true, redirectToLogin: false };
    }

    // Auth required but no user
    if (!userId) {
      return { allowed: false, redirectToLogin: true, reason: 'Authentication required' };
    }

    // No role restrictions = all authenticated users allowed
    if (!page.allowedRoles || page.allowedRoles.length === 0) {
      return { allowed: true, redirectToLogin: false };
    }

    // Check user roles
    const rbacRepo = getRBACRepository();
    const userRoles = await rbacRepo.getUserRoles(
      UserId.fromString(userId),
      page.appId.toNumber() // Get org from app
    );

    const userRoleNames = userRoles.map(r => r.name);
    const hasAllowedRole = page.allowedRoles.some(role => userRoleNames.includes(role));

    if (!hasAllowedRole) {
      return { allowed: false, redirectToLogin: false, reason: 'Insufficient permissions' };
    }

    return { allowed: true, redirectToLogin: false };
  } catch (error) {
    console.error('[checkPageAccess] Error:', error);
    return { allowed: false, redirectToLogin: false, reason: 'Internal error' };
  }
}

/**
 * Get published page by org/app/page slug (public access)
 */
export async function getPublicPage(
  orgSlug: string,
  appSlug: string,
  pageSlug: string
): Promise<Result<any>> {
  try {
    const pageService = getPuckPageApplicationService();
    const page = await pageService.getPublishedPageBySlug(orgSlug, appSlug, pageSlug);

    if (!page) {
      return { success: false, error: 'Page not found' };
    }

    return {
      success: true,
      data: {
        id: page.id.toNumber(),
        name: page.name,
        slug: page.slug,
        templateData: page.templateData.toJSON(),
        themeConfig: page.themeConfig?.toJSON(),
        requiresAuth: page.requiresAuth,
        allowedRoles: page.allowedRoles,
      },
    };
  } catch (error) {
    console.error('[getPublicPage] Error:', error);
    return { success: false, error: 'Failed to load page' };
  }
}
```

### 8.3 App User Management Actions

**File:** `src/app/actions/app-users.ts` (NEW)

```typescript
'use server';

import { z } from 'zod';
import { hash } from 'bcryptjs';
import { requirePermission } from './permissions';
import { getUserRepository, getRBACRepository } from '@/ddd/application/di/container';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { EmailAddress } from '@/ddd/domain/users/value-objects/email-address';
import type { Result } from './types';

const createAppUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  appIds: z.array(z.number()),
  roleId: z.number(), // Which role to assign
});

/**
 * Create app-only user manually (requires apps:manage permission)
 *
 * NOTE: App-only users can also be created automatically when they sign up
 * via OAuth (GitHub/Google) from /public/* routes. This function is for
 * manual creation by organization admins, typically with email/password.
 */
export async function createAppUser(
  data: z.infer<typeof createAppUserSchema>
): Promise<Result> {
  try {
    const session = await requirePermission('apps:manage');
    const validatedData = createAppUserSchema.parse(data);

    const userRepo = getUserRepository();
    const rbacRepo = getRBACRepository();

    // Hash password
    const passwordHash = await hash(validatedData.password, 10);

    // Create user
    const user = await userRepo.create({
      email: EmailAddress.create(validatedData.email),
      name: validatedData.name,
      isAppOnlyUser: true,
      allowedApps: validatedData.appIds.map(id => AppId.fromNumber(id)),
      passwordHash,
    });

    // Assign role
    await rbacRepo.assignUserRole(
      user.id,
      validatedData.roleId,
      session.user.currentOrganizationId!
    );

    return {
      success: true,
      data: {
        id: user.id.toString(),
        email: user.email?.toString(),
        name: user.name,
      },
    };
  } catch (error) {
    console.error('[createAppUser] Error:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: 'Failed to create app user' };
  }
}

/**
 * Get app users for a specific app (requires apps:view permission)
 */
export async function getAppUsers(appId: number): Promise<Result> {
  try {
    await requirePermission('apps:view');

    const userRepo = getUserRepository();
    const users = await userRepo.findAppUsers(AppId.fromNumber(appId));

    return {
      success: true,
      data: users.map(user => ({
        id: user.id.toString(),
        email: user.email?.toString(),
        name: user.name,
        createdAt: user.createdAt,
      })),
    };
  } catch (error) {
    console.error('[getAppUsers] Error:', error);
    return { success: false, error: 'Failed to fetch app users' };
  }
}

/**
 * Grant app access to user (requires apps:manage permission)
 */
export async function grantAppAccess(
  userId: string,
  appId: number
): Promise<Result> {
  try {
    await requirePermission('apps:manage');

    const userRepo = getUserRepository();
    const user = await userRepo.findById(UserId.fromString(userId));

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    user.grantAppAccess(AppId.fromNumber(appId));
    await userRepo.update(user);

    return { success: true };
  } catch (error) {
    console.error('[grantAppAccess] Error:', error);
    return { success: false, error: 'Failed to grant app access' };
  }
}

/**
 * Revoke app access from user (requires apps:manage permission)
 */
export async function revokeAppAccess(
  userId: string,
  appId: number
): Promise<Result> {
  try {
    await requirePermission('apps:manage');

    const userRepo = getUserRepository();
    const user = await userRepo.findById(UserId.fromString(userId));

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    user.revokeAppAccess(AppId.fromNumber(appId));
    await userRepo.update(user);

    return { success: true };
  } catch (error) {
    console.error('[revokeAppAccess] Error:', error);
    return { success: false, error: 'Failed to revoke app access' };
  }
}
```

---

## 9. Security Considerations

### 9.1 Middleware for App-Only User Protection

**File:** `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Allow public routes
  if (request.nextUrl.pathname.startsWith('/public/')) {
    return NextResponse.next();
  }

  // Block app-only users from accessing main platform
  if (token?.isAppOnlyUser) {
    const url = request.nextUrl.clone();

    // Redirect to their last accessed app or sign out
    if (token.lastAppAccess) {
      url.pathname = `/public/${token.lastAppAccess}`;
      return NextResponse.redirect(url);
    }

    // No app access, sign them out
    url.pathname = '/api/auth/signout';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

### 9.2 Row-Level Security Policies Summary

**Users Table:**
```sql
-- App-only users can only read their own record when authenticated
CREATE POLICY users_public_app_read ON users
  FOR SELECT
  TO public
  USING (
    is_app_only_user = true
    AND id = current_setting('app.current_user_id', true)::uuid
  );
```

**Pages Table:**
```sql
-- Public read for published pages without auth requirement
CREATE POLICY pages_public_read ON pages
  FOR SELECT
  TO public
  USING (is_public = true AND requires_auth = false);

-- Authenticated read for auth-required pages with role checks
CREATE POLICY pages_authenticated_read ON pages
  FOR SELECT
  TO public
  USING (
    is_public = true
    AND requires_auth = true
    AND current_setting('app.current_user_id', true)::uuid IS NOT NULL
    AND (
      allowed_roles IS NULL
      OR allowed_roles = '{}'
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = current_setting('app.current_user_id', true)::uuid
        AND r.name = ANY(allowed_roles)
      )
    )
  );
```

### 9.3 Security Best Practices

1. **Password Hashing:**
   - Use `bcryptjs` with 10+ rounds for app-only user passwords
   - Store in `users.passwordHash` field (separate from NextAuth's `accounts` table)

2. **Session Security:**
   - Set `httpOnly: true` on cookies (already in NextAuth config)
   - Set `secure: true` in production
   - Use `sameSite: 'lax'` or `'strict'`

3. **CSRF Protection:**
   - NextAuth provides CSRF tokens automatically
   - Validate tokens on all mutation operations

4. **Rate Limiting:**
   - Implement rate limiting on login endpoints (future enhancement)
   - Use `@upstash/ratelimit` or similar

5. **Input Validation:**
   - Validate all inputs with Zod schemas
   - Sanitize user-generated content in Puck blocks

6. **XSS Prevention:**
   - Puck renderer sanitizes content automatically
   - Use `dangerouslySetInnerHTML` sparingly
   - Validate and escape user inputs

### 9.4 OAuth Account Type Detection

**How It Works:**
1. User clicks "Sign in with GitHub" from `/public/acme/crm/login`
2. OAuth flow completes, user returns to callback
3. NextAuth `signIn` callback receives `callbackUrl` parameter
4. If `callbackUrl` contains `/public/` → app-only user context
5. If new user → create with `isAppOnlyUser: true`, `allowedApps: [crmAppId]`
6. If existing user → validate access based on user type

**Helper Function:**
```typescript
function extractAppContextFromUrl(url: string): { orgSlug: string; appSlug: string; appId: number } | null {
  // Parse URL like "/public/acme/crm/..."
  const match = url.match(/\/public\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const [_, orgSlug, appSlug] = match;

  // Look up app by slug (cached or from database)
  const app = await getAppBySlug(orgSlug, appSlug);

  return app ? { orgSlug, appSlug, appId: app.id } : null;
}
```

**Benefits:**
- Same OAuth providers for all users (no confusion)
- Context-based account creation (seamless UX)
- No duplicate OAuth app configuration needed
- Org users can seamlessly access published apps

**Edge Case Handling:**
- **Org user signs in from `/public/`** → Works perfectly (they have full access)
- **App-only user tries platform route** → Blocked by `signIn` callback
- **App-only user tries different app** → Validate against `allowedApps` array
- **User switches between platform and app** → Session type determines access

**Security Considerations:**
- Always validate `allowedApps` for app-only users
- Don't trust client-side route detection alone
- Use `callbackUrl` from NextAuth (server-controlled)
- Log suspicious access attempts

---

## 10. API Endpoints

### 10.1 Public API Routes

**File:** `src/app/api/public/[orgSlug]/[appSlug]/user-roles/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRBACRepository } from '@/ddd/application/di/container';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';

export async function GET(
  request: Request,
  { params }: { params: { orgSlug: string; appSlug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ roles: [] });
    }

    const rbacRepo = getRBACRepository();
    const userRoles = await rbacRepo.getUserRoles(
      UserId.fromString(session.user.id),
      session.user.currentOrganizationId!
    );

    return NextResponse.json({
      roles: userRoles.map(r => r.name),
    });
  } catch (error) {
    console.error('[user-roles] Error:', error);
    return NextResponse.json({ roles: [] }, { status: 500 });
  }
}
```

### 10.2 Auth Context Update Endpoint

**File:** `src/app/api/auth/update-last-app/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appContext } = await request.json();

    // Update session (in-memory, will persist on next request)
    // Or update database if you want persistence across sessions

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[update-last-app] Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
```

---

## 11. Implementation Checklist

### Phase 1: Database & Domain (Week 1)

- [ ] **Database Schema**
  - [ ] Create migration for users table (add `isAppOnlyUser`, `allowedApps`, `passwordHash`)
  - [ ] Create migration for pages table (rename `isPublished` → `isPublic`, add `requiresAuth`, `allowedRoles`)
  - [ ] Run migrations on development database
  - [ ] Test RLS policies with app-only users

- [ ] **Domain Model**
  - [ ] Update `User` entity with new fields and methods
  - [ ] Update `PuckPage` entity with new fields and access control methods
  - [ ] Create/update value objects if needed
  - [ ] Write unit tests for new entity methods

- [ ] **Repository Updates**
  - [ ] Add `findAppUsers()` method to UserRepository
  - [ ] Add `findPublishedPageBySlug()` to PuckPageRepository
  - [ ] Update existing queries to handle new fields

### Phase 2: Authentication & Routes (Week 2)

- [ ] **NextAuth Updates**
  - [ ] Update session callback to include app-only user flags
  - [ ] Update signIn callback for OAuth context detection (check `callbackUrl`)
  - [ ] Implement new user creation logic in signIn callback (app-only vs org users)
  - [ ] Add `extractAppContextFromUrl()` helper function
  - [ ] Update redirect callback for app context
  - [ ] Extend session type definitions
  - [ ] Test OAuth flow from both platform and `/public/*` routes

- [ ] **Public Routes**
  - [ ] Create `/public/[orgSlug]/[appSlug]/layout.tsx`
  - [ ] Create `/public/[orgSlug]/[appSlug]/[pageSlug]/page.tsx`
  - [ ] Create `/public/[orgSlug]/[appSlug]/login/page.tsx`
  - [ ] Create `/public/[orgSlug]/[appSlug]/auth/signup/page.tsx`
  - [ ] Add proper error handling and not-found pages

- [ ] **Server Actions**
  - [ ] Create `app-users.ts` actions file
  - [ ] Implement `createAppUser()`, `getAppUsers()`, `grantAppAccess()`, `revokeAppAccess()`
  - [ ] Create `public-pages.ts` actions file
  - [ ] Implement `checkPageAccess()`, `getPublicPage()`, `getPublicApp()`

### Phase 3: Components & UI (Week 3)

- [ ] **PublicAppAuthProvider**
  - [ ] Create context and provider component
  - [ ] Implement `usePublicAppAuth()` hook
  - [ ] Add role checking methods
  - [ ] Test with different auth states

- [ ] **LoginBlock**
  - [ ] Create block structure and config
  - [ ] Implement client component with form
  - [ ] Add OAuth provider buttons
  - [ ] Add visibility controls
  - [ ] Register in Puck config
  - [ ] Test in Puck editor

- [ ] **Block Visibility Controls**
  - [ ] Add conditional rendering to existing blocks based on auth
  - [ ] Create `useCurrentUser()` hook for blocks
  - [ ] Update TableBlock to support current user filtering
  - [ ] Update FormBlock to support current user context

### Phase 4: Security & Testing (Week 4)

- [ ] **Middleware**
  - [ ] Create middleware to block app-only users from platform
  - [ ] Test redirect logic for different user types
  - [ ] Ensure public routes remain accessible

- [ ] **API Endpoints**
  - [ ] Create `/api/public/[orgSlug]/[appSlug]/user-roles` endpoint
  - [ ] Create `/api/auth/update-last-app` endpoint
  - [ ] Add rate limiting (optional)

- [ ] **Testing**
  - [ ] Test public page access (no auth)
  - [ ] Test protected page access (with auth)
  - [ ] Test role-based access control
  - [ ] Test app-only user restrictions
  - [ ] Test org user access to both platform and apps
  - [ ] Test LoginBlock in various configurations
  - [ ] Security audit of RLS policies

- [ ] **Documentation**
  - [ ] Update README with published app authentication info
  - [ ] Create user guide for creating app users
  - [ ] Document LoginBlock usage in Puck
  - [ ] API documentation for app user management

---

## Appendix A: Example Workflows

### Creating an App-Only User

```typescript
// In app settings UI
const result = await createAppUser({
  email: 'customer@example.com',
  password: 'securePassword123',
  name: 'Customer Name',
  appIds: [1, 3], // Can access apps 1 and 3
  roleId: 5, // Viewer role
});
```

### Publishing a Page with Auth Requirements

```typescript
// In page settings
await updatePage(pageId, {
  isPublic: true,
  requiresAuth: true,
  allowedRoles: ['premium', 'admin'], // Only premium and admin users
});
```

### Using LoginBlock in Puck Editor

1. Drag "Login Form" block into page
2. Configure title, subtitle
3. Enable/disable OAuth providers
4. Set redirect URL after login
5. Choose visibility (always or only when logged out)
6. Publish page

### Checking User Access in Block

```typescript
'use client';

export function RestrictedContent() {
  const { user, hasRole } = usePublicAppAuth();

  if (!hasRole('premium')) {
    return <div>Upgrade to premium to view this content</div>;
  }

  return <div>Premium content here</div>;
}
```

---

## Appendix B: Future Enhancements

1. **Custom Domains**
   - Allow apps to be served from custom domains
   - SSL certificate management
   - Domain verification

2. **Advanced User Management**
   - Bulk user import
   - User groups/teams
   - User activity logging

3. **Enhanced Security**
   - Two-factor authentication
   - IP whitelisting
   - Session management UI

4. **Analytics & Monitoring**
   - Track app user logins
   - Monitor page access
   - Usage analytics for app users

5. **Social Login**
   - Add more OAuth providers (LinkedIn, Microsoft, etc.)
   - Social profile sync

6. **API Access for App Users**
   - Generate API keys for app users
   - REST/GraphQL endpoints for published apps
   - Webhook support

---

**End of Technical Design Document**
