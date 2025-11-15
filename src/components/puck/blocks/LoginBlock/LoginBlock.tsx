"use client";

import React from "react";
import { usePublicAppAuth } from "@/components/providers/PublicAppAuthProvider";
import { SignInButton } from "@/components/auth/SignInButton";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { CheckCircle } from "lucide-react";

export interface LoginBlockProps {
  title: string;
  description: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAfterLogin: string;
}

export function LoginBlock({
  title,
  description,
  showGithub,
  showGoogle,
  showEmail,
  redirectAfterLogin,
}: LoginBlockProps) {
  const { isAuthenticated, isLoading, user, appId } = usePublicAppAuth();
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

  // Show success message if already authenticated
  if (isAuthenticated && user) {
    return (
      <div className="w-full max-w-md mx-auto p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-12 h-12 text-green-600" />
          <h2 className="text-2xl font-bold">You're signed in</h2>
          <p className="text-muted-foreground">
            Welcome back, {user.name || user.email}!
          </p>
        </div>
      </div>
    );
  }

  // Determine callback URL - use redirectAfterLogin if provided, otherwise current page
  const callbackUrl = redirectAfterLogin || (typeof window !== 'undefined' ? window.location.pathname : '/');

  return (
    <div className="w-full max-w-md mx-auto p-8">
      {/* Editor Mode Indicator */}
      {isEditorMode && (
        <div className="mb-4 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-700 text-center font-medium">
            Preview Mode - Login functionality will work on published pages
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{title}</h2>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Login Options */}
        <div className="space-y-4">
          {/* OAuth Providers */}
          {showGithub && (
            <SignInButton provider="github" callbackUrl={callbackUrl} />
          )}
          {showGoogle && (
            <SignInButton provider="google" callbackUrl={callbackUrl} />
          )}

          {/* Divider if both OAuth and Email are shown */}
          {(showGithub || showGoogle) && showEmail && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
          )}

          {/* Email Login */}
          {showEmail && <EmailSignInForm callbackUrl={callbackUrl} />}

          {/* Message if no providers are enabled */}
          {!showGithub && !showGoogle && !showEmail && (
            <p className="text-center text-sm text-muted-foreground">
              No login providers configured. Please enable at least one login option.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
