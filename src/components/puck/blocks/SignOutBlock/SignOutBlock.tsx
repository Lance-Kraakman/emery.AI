"use client";

import React from "react";
import { signOut, useSession } from "next-auth/react";
import { usePublicAppAuth } from "@/components/providers/PublicAppAuthProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

export interface SignOutBlockProps {
  buttonText: string;
  showUserInfo: boolean;
  redirectAfterSignOut: string;
  variant: "default" | "destructive" | "outline" | "secondary" | "ghost";
}

export function SignOutBlock({
  buttonText,
  showUserInfo,
  redirectAfterSignOut,
  variant,
}: SignOutBlockProps) {
  const { isAuthenticated, isLoading, user, appId } = usePublicAppAuth();
  const { data: sessionData } = useSession();
  const isEditorMode = appId === 0;

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto p-8">
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't show anything if user is not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="w-full max-w-md mx-auto p-8">
        <div className="text-center text-sm text-muted-foreground">
          You are not signed in.
        </div>
      </div>
    );
  }

  // Determine callback URL - use redirectAfterSignOut if provided, otherwise current page
  const callbackUrl = redirectAfterSignOut || (typeof window !== 'undefined' ? window.location.pathname : '/');

  const handleSignOut = async () => {
    await signOut({ callbackUrl });
  };

  return (
    <div className="w-full max-w-md mx-auto p-8">
      {/* Editor Mode Indicator */}
      {isEditorMode && (
        <div className="mb-4 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-700 text-center font-medium">
            Preview Mode - Sign out functionality will work on published pages
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* User Info Card - matching sidebar dashlet style */}
        {showUserInfo && (
          <div className="p-4 border border-border rounded-lg">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={sessionData?.user?.image || undefined}
                  alt={user.name || "User"}
                />
                <AvatarFallback className="text-lg">
                  {user.name?.charAt(0).toUpperCase() ||
                    user.email?.charAt(0).toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1">
                <span className="text-base font-semibold text-foreground">
                  {user.name || "User"}
                </span>
                {user.email && (
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                  </span>
                )}
                {user.roles && user.roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-muted text-muted-foreground"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sign Out Button - matching sidebar style */}
        <Button
          onClick={handleSignOut}
          variant={variant}
          size="lg"
          className="w-full gap-2"
        >
          <LogOut className="h-4 w-4" />
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
