"use client";

import React from "react";
import { usePublicAppAuth } from "@/components/providers/PublicAppAuthProvider";
import { SignInButton } from "@/components/auth/SignInButton";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { useLinkContext } from "@/components/puck/link-context";
import { resolveLinkAction } from "@/components/puck/utils/resolve-link-action";
import type { LinkActionConfig } from "@/components/puck/custom-fields/link-action-field";
import type { FourCornerRadius } from "@/components/puck/types/spacing-types";
import { useTheme } from "@/components/puck/theme-context";
import { computeFourCornerRadiusShorthand } from "@/components/puck/utils/spacing";

export interface LoginBlockProps {
  title: string;
  description: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAction: LinkActionConfig;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  radius?: FourCornerRadius;
}

export function LoginBlock({
  title,
  description,
  showGithub,
  showGoogle,
  showEmail,
  redirectAction,
  backgroundColor,
  textColor,
  buttonColor,
  buttonTextColor,
  borderColor,
  radius,
}: LoginBlockProps) {
  const theme = useTheme();

  // Compute borderRadius shorthand string for CSS and child components
  const borderRadius = radius ? computeFourCornerRadiusShorthand(radius, theme) : undefined;
  const { isAuthenticated, isLoading, user, appId } = usePublicAppAuth();
  const isPreviewMode = appId === 0;
  const linkContext = useLinkContext();

  // Show loading state (but not in preview mode)
  if (isLoading && !isPreviewMode) {
    return (
      <div className="flex items-center justify-center p-4">
        <div
          style={{
            color: textColor || 'var(--theme-text-muted, #64748b)'
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  // In preview mode, always show login form even if authenticated
  // In normal mode, show success message if already authenticated
  if (isAuthenticated && user && !isPreviewMode) {
    return (
      <div
        className="flex flex-col items-center gap-4 text-center p-6 rounded-lg"
        style={{
          backgroundColor: backgroundColor || 'var(--theme-surface, #f8fafc)',
          borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
          border: borderColor ? `1px solid ${borderColor}` : '1px solid var(--theme-border, #e2e8f0)',
        }}
      >
        <CheckCircle
          className="w-12 h-12"
          style={{ color: 'var(--theme-success, #10b981)' }}
        />
        <h2
          className="text-2xl font-bold"
          style={{ color: textColor || 'var(--theme-text, #1e293b)' }}
        >
          You're signed in
        </h2>
        <p style={{ color: 'var(--theme-text-muted, #64748b)' }}>
          Welcome back, {user.name || user.email}!
        </p>
      </div>
    );
  }

  // Resolve the redirect action to get the callback URL
  const resolvedAction = resolveLinkAction(redirectAction, linkContext);
  const callbackUrl = resolvedAction.href !== '#'
    ? resolvedAction.href
    : (typeof window !== 'undefined' ? window.location.pathname : '/');

  return (
    <div className="flex items-center justify-center">
      <div
        className="relative w-full max-w-md rounded-lg p-6"
        style={{
          backgroundColor: backgroundColor || 'var(--theme-background, #ffffff)',
          borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
          border: borderColor ? `1px solid ${borderColor}` : '1px solid var(--theme-border, #e2e8f0)',
        }}
      >
        {/* Preview Badge in top-right corner */}
        {isPreviewMode && (
          <Badge variant="secondary" className="absolute top-3 right-3 text-xs">
            Preview
          </Badge>
        )}

        {/* Header Section */}
        <div className="space-y-2 mb-6">
          <h2
            className="text-lg font-bold"
            style={{ color: textColor || 'var(--theme-text, #1e293b)' }}
          >
            {title}
          </h2>
          {description && (
            <p
              className="text-sm"
              style={{ color: 'var(--theme-text-muted, #64748b)' }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Login Options */}
        <div className="space-y-3">
          {/* OAuth Providers */}
          {showGithub && (
            <SignInButton
              provider="github"
              callbackUrl={callbackUrl}
              buttonColor={buttonColor}
              buttonTextColor={buttonTextColor}
              borderColor={borderColor}
              borderRadius={borderRadius}
            />
          )}
          {showGoogle && (
            <SignInButton
              provider="google"
              callbackUrl={callbackUrl}
              buttonColor={buttonColor}
              buttonTextColor={buttonTextColor}
              borderColor={borderColor}
              borderRadius={borderRadius}
            />
          )}

          {/* Divider if both OAuth and Email are shown */}
          {(showGithub || showGoogle) && showEmail && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span
                  className="w-full border-t"
                  style={{ borderColor: borderColor || 'var(--theme-border, #e2e8f0)' }}
                />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span
                  className="px-2"
                  style={{
                    backgroundColor: backgroundColor || 'var(--theme-background, #ffffff)',
                    color: 'var(--theme-text-muted, #64748b)',
                  }}
                >
                  Or continue with
                </span>
              </div>
            </div>
          )}

          {/* Email Login */}
          {showEmail && (
            <EmailSignInForm
              callbackUrl={callbackUrl}
              buttonColor={buttonColor}
              buttonTextColor={buttonTextColor}
              borderColor={borderColor}
              borderRadius={borderRadius}
              textColor={textColor}
            />
          )}

          {/* Message if no providers are enabled */}
          {!showGithub && !showGoogle && !showEmail && (
            <p
              className="text-center text-sm"
              style={{ color: 'var(--theme-text-muted, #64748b)' }}
            >
              No login providers configured. Please enable at least one login option.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
