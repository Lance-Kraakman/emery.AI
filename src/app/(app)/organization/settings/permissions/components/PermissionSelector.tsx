'use client'

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye, Edit, Plus, Play, Users, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResourceSelector } from "./ResourceSelector";

interface Permission {
  id: number;
  resource: string;
  action: string;
  description: string | null;
}

// Extended permission with resource scope information
export interface PermissionAssignment {
  permissionId: number;
  resourceType?: 'agent' | 'team' | 'user' | null;
  resourceScope: 'all' | 'specific' | 'owned' | 'team';
  resourceIds?: (number | string)[]; // number for entities with numeric IDs, string for UUIDs (users)
}

interface PermissionSelectorProps {
  availablePermissions: Permission[];
  selectedPermissions: PermissionAssignment[];
  onSelectionChange: (assignments: PermissionAssignment[]) => void;
  disabled?: boolean;
}

export function PermissionSelector({
  availablePermissions,
  selectedPermissions,
  onSelectionChange,
  disabled = false
}: PermissionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Helper functions for resource-specific permissions
  const isResourceSpecificPermission = (resource: string): boolean => {
    return ['agents', 'teams', 'data'].includes(resource.toLowerCase());
  };

  const getResourceType = (resource: string): 'agent' | 'team' | 'user' | null => {
    switch (resource.toLowerCase()) {
      case 'agents': return 'agent';
      case 'teams': return 'team';
      case 'users': return 'user';
      default: return null;
    }
  };

  const getScopeOptions = (resource: string): Array<{value: 'all' | 'specific' | 'owned' | 'team', label: string}> => {
    const resourceType = resource.toLowerCase();
    switch (resourceType) {
      case 'agents':
        return [
          { value: 'all', label: 'All Agents' },
          { value: 'owned', label: 'Owned Agents Only' },
          { value: 'specific', label: 'Specific Agents' }
        ];
      case 'teams':
        return [
          { value: 'all', label: 'All Teams' },
          { value: 'team', label: 'Team Member Only' },
          { value: 'specific', label: 'Specific Teams' }
        ];
      case 'data':
        return [
          { value: 'all', label: 'All Tables' },
          { value: 'owned', label: 'Owned Tables Only' },
          { value: 'specific', label: 'Specific Tables' }
        ];
      default:
        return [{ value: 'all', label: 'All' }];
    }
  };

  const getPermissionAssignment = (permissionId: number): PermissionAssignment | undefined => {
    return selectedPermissions.find(p => p.permissionId === permissionId);
  };

  const isPermissionSelected = (permissionId: number): boolean => {
    return selectedPermissions.some(p => p.permissionId === permissionId);
  };

  // Group permissions by resource
  const permissionsByResource = availablePermissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Filter permissions based on search term
  const filteredResourceGroups = Object.entries(permissionsByResource).reduce((acc, [resource, perms]) => {
    const filteredPerms = perms.filter(p => 
      p.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    if (filteredPerms.length > 0) {
      acc[resource] = filteredPerms;
    }
    
    return acc;
  }, {} as Record<string, Permission[]>);

  const handlePermissionToggle = (permission: Permission) => {
    if (disabled) return;

    const isSelected = isPermissionSelected(permission.id);

    if (isSelected) {
      // Remove permission
      onSelectionChange(selectedPermissions.filter(p => p.permissionId !== permission.id));
    } else {
      // Add permission with default scope
      const resourceType = getResourceType(permission.resource);
      const isResourceSpecific = isResourceSpecificPermission(permission.resource);

      const newAssignment: PermissionAssignment = {
        permissionId: permission.id,
        resourceType,
        resourceScope: isResourceSpecific ? 'all' : 'all',
        resourceIds: undefined
      };

      onSelectionChange([...selectedPermissions, newAssignment]);
    }
  };

  const handleScopeChange = (permissionId: number, newScope: 'all' | 'specific' | 'owned' | 'team') => {
    if (disabled) return;

    const updatedPermissions = selectedPermissions.map(p =>
      p.permissionId === permissionId
        ? { ...p, resourceScope: newScope, resourceIds: newScope === 'specific' ? (p.resourceIds || []) : undefined }
        : p
    );

    onSelectionChange(updatedPermissions);
  };

  const handleResourceSelection = (permissionId: number, resourceIds: (number | string)[]) => {
    if (disabled) return;

    const updatedPermissions = selectedPermissions.map(p =>
      p.permissionId === permissionId
        ? { ...p, resourceIds }
        : p
    );

    onSelectionChange(updatedPermissions);
  };

  const handleResourceToggle = (resourcePermissions: Permission[]) => {
    if (disabled) return;

    const resourcePermissionIds = resourcePermissions.map(p => p.id);
    const allSelected = resourcePermissionIds.every(id => isPermissionSelected(id));

    if (allSelected) {
      // Unselect all permissions in this resource
      onSelectionChange(selectedPermissions.filter(p => !resourcePermissionIds.includes(p.permissionId)));
    } else {
      // Select all permissions in this resource
      const newAssignments = [...selectedPermissions];

      resourcePermissions.forEach(permission => {
        if (!isPermissionSelected(permission.id)) {
          const resourceType = getResourceType(permission.resource);
          const isResourceSpecific = isResourceSpecificPermission(permission.resource);

          newAssignments.push({
            permissionId: permission.id,
            resourceType,
            resourceScope: isResourceSpecific ? 'all' : 'all',
            resourceIds: undefined
          });
        }
      });

      onSelectionChange(newAssignments);
    }
  };

  const getResourceIcon = (resource: string) => {
    switch (resource.toLowerCase()) {
      case 'organizations':
        return <Shield className="w-4 h-4" />;
      case 'users':
        return <Users className="w-4 h-4" />;
      case 'teams':
        return <Users className="w-4 h-4" />;
      case 'agents':
        return <Play className="w-4 h-4" />;
      case 'tasks':
        return <Play className="w-4 h-4" />;
      case 'data':
        return <Eye className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'view':
        return <Eye className="w-3 h-3" />;
      case 'manage':
      case 'edit':
        return <Edit className="w-3 h-3" />;
      case 'create':
        return <Plus className="w-3 h-3" />;
      case 'execute':
        return <Play className="w-3 h-3" />;
      case 'invite':
        return <Users className="w-3 h-3" />;
      default:
        return <Shield className="w-3 h-3" />;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action.toLowerCase()) {
      case 'view':
        return 'secondary';
      case 'manage':
        return 'destructive';
      case 'create':
        return 'default';
      case 'execute':
        return 'outline';
      case 'invite':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const selectedCount = selectedPermissions.length;
  const totalCount = availablePermissions.length;

  return (
    <div className="space-y-4">
      {/* Summary and Search */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedCount} of {totalCount} permissions selected
        </div>
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Permission Groups */}
      <div className="grid gap-4">
        {Object.entries(filteredResourceGroups).map(([resource, permissions]) => {
          const resourcePermissionIds = permissions.map(p => p.id);
          const selectedInResource = resourcePermissionIds.filter(id => isPermissionSelected(id));
          const allSelected = selectedInResource.length === resourcePermissionIds.length;
          const someSelected = selectedInResource.length > 0;

          return (
            <Card key={resource}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {getResourceIcon(resource)}
                    {resource.charAt(0).toUpperCase() + resource.slice(1)}
                    <Badge variant="outline" className="ml-2">
                      {selectedInResource.length}/{resourcePermissionIds.length}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => handleResourceToggle(permissions)}
                      disabled={disabled}
                    />
                    <label className="text-sm font-medium">Select All</label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {permissions.map((permission) => {
                  const isSelected = isPermissionSelected(permission.id);
                  const assignment = getPermissionAssignment(permission.id);
                  const isResourceSpecific = isResourceSpecificPermission(permission.resource);
                  const scopeOptions = getScopeOptions(permission.resource);

                  return (
                    <div
                      key={permission.id}
                      className={`border rounded-lg transition-colors ${
                        isSelected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      } ${disabled ? 'opacity-50' : ''}`}
                    >
                      <div
                        className={`flex items-center justify-between p-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => !disabled && handlePermissionToggle(permission)}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <Checkbox
                            checked={isSelected}
                            disabled={disabled}
                            // Prevent double-click when clicking checkbox directly
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant={getActionBadgeVariant(permission.action)}
                                className="flex items-center gap-1"
                              >
                                {getActionIcon(permission.action)}
                                {permission.action}
                              </Badge>
                              <span className="font-medium">
                                {permission.resource}:{permission.action}
                              </span>
                            </div>
                            {permission.description && (
                              <p className="text-sm text-muted-foreground">
                                {permission.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Scope Selection for Resource-Specific Permissions */}
                      {isSelected && isResourceSpecific && (
                        <div className="border-t border-border/50 bg-muted/20">
                          <div className="flex items-center gap-3 p-3">
                            <label className="text-sm font-medium text-muted-foreground min-w-[60px]">
                              Scope:
                            </label>
                            <Select
                              value={assignment?.resourceScope || 'all'}
                              onValueChange={(value: 'all' | 'specific' | 'owned' | 'team') =>
                                handleScopeChange(permission.id, value)
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {scopeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {assignment?.resourceScope === 'specific' && (
                              <Badge variant="outline" className="text-xs">
                                {(assignment.resourceIds?.length || 0) === 0
                                  ? "Select specific resources below"
                                  : `${assignment.resourceIds?.length} selected`
                                }
                              </Badge>
                            )}
                          </div>

                          {/* Resource Selection for Specific Scope */}
                          {assignment?.resourceScope === 'specific' && assignment.resourceType && (
                            <div className="px-3 pb-3">
                              <ResourceSelector
                                resourceType={assignment.resourceType}
                                selectedResourceIds={assignment.resourceIds || []}
                                onSelectionChange={(resourceIds) => handleResourceSelection(permission.id, resourceIds)}
                                disabled={disabled}
                                className="border-0 shadow-none bg-transparent"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No Results */}
      {Object.keys(filteredResourceGroups).length === 0 && searchTerm && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No permissions found matching &quot;{searchTerm}&quot;</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSearchTerm("")}
            className="mt-2"
          >
            Clear search
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      {!disabled && (
        <div className="flex items-center gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const allAssignments: PermissionAssignment[] = availablePermissions.map(permission => {
                const resourceType = getResourceType(permission.resource);
                const isResourceSpecific = isResourceSpecificPermission(permission.resource);

                return {
                  permissionId: permission.id,
                  resourceType,
                  resourceScope: isResourceSpecific ? 'all' : 'all',
                  resourceIds: undefined
                };
              });
              onSelectionChange(allAssignments);
            }}
            disabled={selectedCount === totalCount}
          >
            Select All ({totalCount})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectionChange([])}
            disabled={selectedCount === 0}
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}