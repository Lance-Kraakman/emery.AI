import React from 'react';
import { Badge } from '@/components/ui/badge';

export interface Role {
  id: number;
  name: string;
  isSystem: boolean;
}

interface RoleDisplayProps {
  roles: Role[];
  variant?: 'badge' | 'text' | 'primary' | 'compact';
  showSystemBadge?: boolean;
}

/**
 * Consistent role display component across the application
 * Handles single and multiple roles appropriately for different contexts
 */
export function RoleDisplay({
  roles,
  variant = 'badge',
  showSystemBadge = true
}: RoleDisplayProps) {
  if (!roles || roles.length === 0) {
    return <span className="text-muted-foreground">No roles</span>;
  }

  // Primary role variant - show only the primary role name
  if (variant === 'primary') {
    const primaryRole = roles.find(r => r.isSystem) || roles[0];
    return <span>{primaryRole?.name || 'Member'}</span>;
  }

  // Text variant - compact text representation
  if (variant === 'text') {
    if (roles.length === 1) {
      return <span>{roles[0].name}</span>;
    }

    const primaryRole = roles.find(r => r.isSystem) || roles[0];
    const additionalCount = roles.length - 1;
    return <span>{primaryRole.name}{additionalCount > 0 ? ` +${additionalCount}` : ''}</span>;
  }

  // Compact variant - same as text but for very small spaces
  if (variant === 'compact') {
    const primaryRole = roles.find(r => r.isSystem) || roles[0];
    return <span className="text-xs">{primaryRole?.name || 'Member'}</span>;
  }

  // Badge variant (default) - show all roles with badges
  return (
    <div className="flex gap-1 flex-wrap">
      {roles.map(role => (
        <Badge
          key={role.id}
          variant={role.isSystem ? 'default' : 'secondary'}
          className="text-xs"
          title={role.isSystem ? 'System role' : 'Custom role'}
        >
          {role.name}
          {showSystemBadge && role.isSystem && (
            <span className="ml-1 opacity-70">★</span>
          )}
        </Badge>
      ))}
    </div>
  );
}

// Utility functions for role operations
export function getPrimaryRole(roles: Role[]): Role | null {
  return roles.find(r => r.isSystem) || roles[0] || null;
}

export function getPrimaryRoleName(roles: Role[]): string {
  const primaryRole = getPrimaryRole(roles);
  return primaryRole?.name || 'Member';
}

export function hasRole(roles: Role[], roleName: string): boolean {
  return roles.some(r => r.name === roleName);
}

export function hasSystemRole(roles: Role[]): boolean {
  return roles.some(r => r.isSystem);
}