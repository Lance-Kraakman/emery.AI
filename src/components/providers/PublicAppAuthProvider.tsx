'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { getUserRolesForApp } from '@/app/actions/public-pages';

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
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    // Fetch user roles for this app
    async function loadRoles() {
      if (session?.user?.id) {
        try {
          const roles = await getUserRolesForApp(orgSlug, session.user.id);
          setUserRoles(roles);
        } catch (err) {
          console.error('Failed to fetch user roles:', err);
          setUserRoles([]);
        }
      } else {
        setUserRoles([]);
      }
    }

    loadRoles();
  }, [session?.user?.id, orgSlug, appSlug]);

  // NOTE: Last app access tracking removed - not needed for org-wide user model
  // Users are org members, not app-specific, so no need to track last app

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
