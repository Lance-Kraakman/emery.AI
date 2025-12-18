"use client";

import React from "react";
import { signOut, useSession } from "next-auth/react";
import { usePublicAppAuth } from "@/components/providers/PublicAppAuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { LogOut, ChevronDown } from "lucide-react";
import { useLinkContext, useTheme } from "@/components/puck/contexts/PageContext";
import { resolveLinkAction } from "@/components/puck/utils/resolve-link-action";
import type { LinkActionConfig } from "@/components/puck/custom-fields/link-action-field";
import type { FourCornerRadius } from "@/components/puck/types/spacing-types";
import { computeFourCornerRadiusShorthand } from "@/components/puck/utils/spacing";

export interface SignOutBlockProps {
  buttonText: string;
  showUserInfo: boolean;
  showAvatar: boolean;
  redirectAction: LinkActionConfig;
  variant: "default" | "destructive" | "outline" | "secondary" | "ghost";
  popoverSide: "top" | "bottom" | "left" | "right";
  popoverAlign: "start" | "center" | "end";
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  radius?: FourCornerRadius;
}

export function SignOutBlock({
  buttonText,
  showUserInfo,
  showAvatar,
  redirectAction,
  variant,
  popoverSide,
  popoverAlign,
  backgroundColor,
  textColor,
  buttonColor,
  buttonTextColor,
  borderColor,
  radius,
}: SignOutBlockProps) {
  const theme = useTheme();
  const borderRadius = radius ? computeFourCornerRadiusShorthand(radius, theme) : undefined;
  const { isAuthenticated, isLoading, user, appId } = usePublicAppAuth();
  const { data: sessionData } = useSession();
  const isPreviewMode = appId === 0;
  const linkContext = useLinkContext();

  // In preview mode, always show sign out button with mock data
  const previewUser = {
    name: "Preview User",
    email: "preview@example.com",
    roles: ["viewer"],
  };

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

  // In preview mode, always show the sign out UI
  const displayUser = isPreviewMode ? previewUser : user;
  const shouldShowSignOut = isPreviewMode || (isAuthenticated && user);

  // Don't show anything if user is not authenticated (and not in preview mode)
  if (!shouldShowSignOut) {
    return (
      <div
        className="flex items-center justify-center p-4 rounded-lg"
        style={{
          backgroundColor: backgroundColor || 'var(--theme-surface, #f8fafc)',
          borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
          border: borderColor ? `1px solid ${borderColor}` : '1px solid var(--theme-border, #e2e8f0)',
        }}
      >
        <p
          className="text-sm text-center"
          style={{ color: 'var(--theme-text-muted, #64748b)' }}
        >
          You are not signed in.
        </p>
      </div>
    );
  }

  // Resolve the redirect action to get the callback URL
  const resolvedAction = resolveLinkAction(redirectAction, linkContext);
  const callbackUrl = resolvedAction.href !== '#'
    ? resolvedAction.href
    : (typeof window !== 'undefined' ? window.location.pathname : '/');

  const handleSignOut = async () => {
    await signOut({ callbackUrl });
  };

  return (
    <div className="flex items-center justify-center">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-3 px-4 py-2 font-medium transition-colors hover:opacity-90"
            style={{
              backgroundColor: buttonColor || 'var(--theme-surface, #f8fafc)',
              color: textColor || 'var(--theme-text, #1e293b)',
              borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
              border: borderColor ? `1px solid ${borderColor}` : '1px solid var(--theme-border, #e2e8f0)',
            }}
          >
            {showAvatar && (
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={sessionData?.user?.image || undefined}
                  alt={displayUser?.name || "User"}
                />
                <AvatarFallback className="text-sm">
                  {displayUser?.name?.charAt(0).toUpperCase() ||
                    displayUser?.email?.charAt(0).toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
            )}
            <span>{displayUser?.name || "User"}</span>
            <ChevronDown className="w-4 h-4 opacity-50" />
            {isPreviewMode && (
              <Badge variant="secondary" className="text-xs">
                Preview
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={popoverSide}
          align={popoverAlign}
          className="w-64 p-0"
          style={{
            backgroundColor: backgroundColor || 'var(--theme-background, #ffffff)',
            borderColor: borderColor || 'var(--theme-border, #e2e8f0)',
            borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
          }}
        >
          {/* User Info Section */}
          {showUserInfo && (
            <div
              className="p-3"
              style={{
                borderBottom: borderColor
                  ? `1px solid ${borderColor}`
                  : '1px solid var(--theme-border, #e2e8f0)',
              }}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={sessionData?.user?.image || undefined}
                    alt={displayUser?.name || "User"}
                  />
                  <AvatarFallback className="text-base">
                    {displayUser?.name?.charAt(0).toUpperCase() ||
                      displayUser?.email?.charAt(0).toUpperCase() ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className="text-sm font-semibold truncate"
                    style={{ color: textColor || 'var(--theme-text, #1e293b)' }}
                  >
                    {displayUser?.name || "User"}
                  </span>
                  {displayUser?.email && (
                    <span
                      className="text-xs truncate"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      {displayUser.email}
                    </span>
                  )}
                  {displayUser?.roles && displayUser.roles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {displayUser.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded"
                          style={{
                            backgroundColor: 'var(--theme-surface, #f8fafc)',
                            color: 'var(--theme-text-muted, #64748b)',
                          }}
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

          {/* Sign Out Button */}
          <div className="p-1">
            <button
              onClick={handleSignOut}
              className="w-full inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors hover:opacity-90"
              style={{
                backgroundColor: variant === "destructive"
                  ? 'var(--theme-error, #ef4444)'
                  : buttonColor || 'transparent',
                color: variant === "destructive"
                  ? '#ffffff'
                  : buttonTextColor || 'var(--theme-text, #1e293b)',
                borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
              }}
            >
              <LogOut className="h-4 w-4" />
              {buttonText}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
