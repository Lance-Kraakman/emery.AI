"use client";

import React from "react";
import { usePublicAppAuth } from "@/components/providers/PublicAppAuthProvider";
import { SignInButton } from "@/components/auth/SignInButton";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, LogIn } from "lucide-react";

export interface LoginBlockProps {
  title: string;
  description: string;
  triggerText: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAfterLogin: string;
  popoverSide: "top" | "bottom" | "left" | "right";
  popoverAlign: "start" | "center" | "end";
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  borderRadius?: string;
}

export function LoginBlock({
  title,
  description,
  triggerText,
  showGithub,
  showGoogle,
  showEmail,
  redirectAfterLogin,
  popoverSide,
  popoverAlign,
  backgroundColor,
  textColor,
  buttonColor,
  buttonTextColor,
  borderColor,
  borderRadius,
}: LoginBlockProps) {
  const { isAuthenticated, isLoading, user, appId } = usePublicAppAuth();
  const isEditorMode = appId === 0;

  // Show loading state
  if (isLoading) {
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

  // Show success message if already authenticated
  if (isAuthenticated && user) {
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

  // Determine callback URL
  const callbackUrl = redirectAfterLogin || (typeof window !== 'undefined' ? window.location.pathname : '/');

  return (
    <div className="flex items-center justify-center">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-2 px-6 py-3 font-medium transition-colors hover:opacity-90"
            style={{
              backgroundColor: buttonColor || 'var(--theme-primary, #2563eb)',
              color: buttonTextColor || '#ffffff',
              borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
              border: borderColor ? `1px solid ${borderColor}` : 'none',
            }}
          >
            <LogIn className="w-4 h-4" />
            {triggerText}
            {isEditorMode && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Preview
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={popoverSide}
          align={popoverAlign}
          className="w-80 p-0"
          style={{
            backgroundColor: backgroundColor || 'var(--theme-background, #ffffff)',
            borderColor: borderColor || 'var(--theme-border, #e2e8f0)',
            borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
          }}
        >
          {/* Header Section */}
          <div
            className="p-4 space-y-2"
            style={{
              borderBottom: borderColor
                ? `1px solid ${borderColor}`
                : '1px solid var(--theme-border, #e2e8f0)',
            }}
          >
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
          <div className="p-4 space-y-3">
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
            {showEmail && <EmailSignInForm callbackUrl={callbackUrl} />}

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
        </PopoverContent>
      </Popover>
    </div>
  );
}
