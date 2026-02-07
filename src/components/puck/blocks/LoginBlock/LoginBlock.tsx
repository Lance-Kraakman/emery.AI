"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePublicAppAuth } from "@/components/providers/PublicAppAuthProvider";
import { SignInButton } from "@/components/auth/SignInButton";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { useLinkContext, useTheme } from "@/components/puck/contexts/PageContext";
import { resolveLinkAction } from "@/components/puck/utils/resolve-link-action";
import type { LinkActionConfig } from "@/components/puck/custom-fields/link-action-field";
import type { RoleSelectorFieldValue } from "@/components/puck/custom-fields/role-selector-field";
import type { FourCornerRadius } from "@/components/puck/types/spacing-types";
import { computeFourCornerRadiusShorthand } from "@/components/puck/utils/spacing";
import { useInterpolatedText } from "@/components/puck/hooks/useInterpolatedText";
import { assignSignUpRole } from "@/app/actions/signup-role";

export interface LoginBlockProps {
  mode: 'sign_in' | 'sign_up' | 'dual';
  title: string;
  description: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAction: LinkActionConfig;
  defaultSignUpRole: RoleSelectorFieldValue | null;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  radius?: FourCornerRadius;
}

export function LoginBlock({
  mode,
  title,
  description,
  showGithub,
  showGoogle,
  showEmail,
  redirectAction,
  defaultSignUpRole,
  backgroundColor,
  textColor,
  buttonColor,
  buttonTextColor,
  borderColor,
  radius,
}: LoginBlockProps) {
  // State for dual mode toggle
  const [currentView, setCurrentView] = useState<'sign_in' | 'sign_up'>('sign_in');

  // Determine if this is sign-up mode for different UI text
  const isSignUp = mode === 'sign_up' || (mode === 'dual' && currentView === 'sign_up');
  const theme = useTheme();

  // Get the signUpRoleId for auth components
  const signUpRoleId = isSignUp && defaultSignUpRole ? defaultSignUpRole.id : undefined;

  // Use mode-aware default title when title is a default value
  const defaultTitle = isSignUp ? "Create Account" : "Sign In";
  const displayTitle = (title === "Sign In" || title === "Create Account" || !title)
    ? defaultTitle
    : title;

  // Interpolate variables in title and description
  const interpolatedTitle = useInterpolatedText(displayTitle);
  const interpolatedDescription = useInterpolatedText(description);

  // Compute borderRadius shorthand string for CSS and child components
  const borderRadius = radius ? computeFourCornerRadiusShorthand(radius, theme) : undefined;
  const { isAuthenticated, isLoading, user, appId, orgSlug } = usePublicAppAuth();
  const isPreviewMode = appId === 0;
  const linkContext = useLinkContext();

  // Track if we've already processed the signup role assignment
  const roleAssignmentProcessed = useRef(false);

  // Handle role assignment after successful auth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (roleAssignmentProcessed.current) return;
    if (!isAuthenticated || isLoading || isPreviewMode) return;

    // Check for signupRole in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const signupRoleParam = urlParams.get('signupRole');

    if (signupRoleParam && orgSlug) {
      roleAssignmentProcessed.current = true;
      const roleId = parseInt(signupRoleParam, 10);

      if (!isNaN(roleId)) {
        // Call the server action to assign the role
        assignSignUpRole(roleId, orgSlug)
          .then((result) => {
            if (!result.success && result.error) {
              console.warn('[LoginBlock] Role assignment failed:', result.error);
            }
          })
          .catch((error) => {
            console.error('[LoginBlock] Role assignment error:', error);
          })
          .finally(() => {
            // Clean up the URL param
            urlParams.delete('signupRole');
            const newUrl = urlParams.toString()
              ? `${window.location.pathname}?${urlParams.toString()}`
              : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          });
      }
    }
  }, [isAuthenticated, isLoading, isPreviewMode, orgSlug]);

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
          You&apos;re signed in
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
            {interpolatedTitle}
          </h2>
          {interpolatedDescription && (
            <p
              className="text-sm"
              style={{ color: 'var(--theme-text-muted, #64748b)' }}
            >
              {interpolatedDescription}
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
              isSignUp={isSignUp}
              signUpRoleId={signUpRoleId}
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
              isSignUp={isSignUp}
              signUpRoleId={signUpRoleId}
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
              isSignUp={isSignUp}
              signUpRoleId={signUpRoleId}
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

          {/* Toggle link for dual mode */}
          {mode === 'dual' && (
            <p
              className="text-center text-sm mt-4"
              style={{ color: 'var(--theme-text-muted, #64748b)' }}
            >
              {currentView === 'sign_in' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setCurrentView('sign_up')}
                    className="font-medium hover:underline"
                    style={{ color: buttonColor || 'var(--theme-primary, #2563eb)' }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setCurrentView('sign_in')}
                    className="font-medium hover:underline"
                    style={{ color: buttonColor || 'var(--theme-primary, #2563eb)' }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
