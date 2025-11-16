'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useResourcePermission } from "@/hooks/use-resource-permission";

interface ShareButtonProps {
  resourceType: string;
  resourceId: number;
  permissionCount?: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onShare?: () => void;
}

/**
 * ShareButton - Inline button for resource sharing
 *
 * Shows a share icon with optional permission count badge.
 * Disabled if user lacks manage permission on the resource.
 *
 * @example
 * ```tsx
 * <ShareButton
 *   resourceType="app"
 *   resourceId={app.id}
 *   permissionCount={5}
 *   onShare={() => setShareDialogOpen(true)}
 * />
 * ```
 */
export function ShareButton({
  resourceType,
  resourceId,
  permissionCount,
  variant = 'ghost',
  size = 'sm',
  onShare
}: ShareButtonProps) {
  // Check if user has manage permission on this resource
  const { hasPermission, isLoading } = useResourcePermission(
    `${resourceType}s:manage`, // e.g., "apps:manage", "agents:manage"
    resourceType,
    resourceId
  );

  const handleClick = () => {
    if (onShare) {
      onShare();
    }
  };

  // Don't render if user doesn't have permission
  if (!isLoading && !hasPermission) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading || !hasPermission}
      className="gap-2"
    >
      <Share2 className="w-4 h-4" />
      {permissionCount !== undefined && permissionCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {permissionCount}
        </Badge>
      )}
    </Button>
  );
}
