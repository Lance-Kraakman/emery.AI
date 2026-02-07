'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, ChevronDown, ChevronRight, Shield, Eye, Edit, Plus, Play, Users, Database } from "lucide-react";
import { getAvailablePermissions } from "@/app/actions/roles";
import { InlineScopeSelector } from "./InlineScopeSelector";
import { ResourceSelector } from "./ResourceSelector";
import type { PermissionAssignment } from "./PermissionSelector";

interface Permission {
  id: number;
  resource: string;
  action: string;
  description: string | null;
}

interface CompactPermissionListProps {
  selectedPermissions: PermissionAssignment[];
  onSelectionChange: (assignments: PermissionAssignment[]) => void;
  disabled?: boolean;
}

export function CompactPermissionList({
  selectedPermissions,
  onSelectionChange,
  disabled = false
}: CompactPermissionListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAvailablePermissions();
  }, []);

  const loadAvailablePermissions = async () => {
    try {
      setLoading(true);
      const permissions = await getAvailablePermissions();
      setAvailablePermissions(permissions);

      // Expand all groups by default for better UX
      const resourceStrings = permissions.map((p: Permission) => p.resource);
      const uniqueResources = [...new Set(resourceStrings)];
      setExpandedGroups(new Set<string>(uniqueResources));
    } catch (error) {
      console.error('Error loading permissions:', error);
      setAvailablePermissions([]);
    } finally {
      setLoading(false);
    }
  };

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

  // Group permissions by resource
  const permissionsByResource = useMemo(() => {
    return availablePermissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [availablePermissions]);

  // Filter permissions based on search term
  const filteredResourceGroups = useMemo(() => {
    if (!searchTerm) return permissionsByResource;

    return Object.entries(permissionsByResource).reduce((acc, [resource, perms]) => {
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
  }, [permissionsByResource, searchTerm]);

  const getPermissionAssignment = (permissionId: number): PermissionAssignment | undefined => {
    return selectedPermissions.find(p => p.permissionId === permissionId);
  };

  const isPermissionSelected = (permissionId: number): boolean => {
    return selectedPermissions.some(p => p.permissionId === permissionId);
  };

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

  const toggleGroup = (resource: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(resource)) {
      newExpanded.delete(resource);
    } else {
      newExpanded.add(resource);
    }
    setExpandedGroups(newExpanded);
  };

  const handleGroupToggle = (resourcePermissions: Permission[]) => {
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
        return <Database className="w-4 h-4" />;
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
      case 'invite':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const selectedCount = selectedPermissions.length;
  const totalCount = availablePermissions.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading permissions...</span>
      </div>
    );
  }

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
            className="pl-10 h-10"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Permission Groups - AWS Style */}
      <div className="space-y-2">
        {Object.entries(filteredResourceGroups).map(([resource, permissions]) => {
          const resourcePermissionIds = permissions.map(p => p.id);
          const selectedInResource = resourcePermissionIds.filter(id => isPermissionSelected(id));
          const allSelected = selectedInResource.length === resourcePermissionIds.length;
          const someSelected = selectedInResource.length > 0;
          const isExpanded = expandedGroups.has(resource);

          return (
            <div key={resource} className="border rounded-lg">
              <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(resource)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      {getResourceIcon(resource)}
                      <span className="font-medium">
                        {resource.charAt(0).toUpperCase() + resource.slice(1)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={(checked) => {
                            handleGroupToggle(permissions);
                          }}
                          disabled={disabled}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedInResource.length}/{resourcePermissionIds.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t bg-muted/20">
                    <div className="p-3 space-y-2">
                      {permissions.map((permission) => {
                        const isSelected = isPermissionSelected(permission.id);
                        const assignment = getPermissionAssignment(permission.id);
                        const isResourceSpecific = isResourceSpecificPermission(permission.resource);
                        const scopeOptions = getScopeOptions(permission.resource);

                        return (
                          <div key={permission.id} className="space-y-2">
                            {/* Permission Row */}
                            <div className="flex items-center justify-between py-2 hover:bg-background/50 rounded px-2">
                              <div className="flex items-center gap-3 flex-1">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handlePermissionToggle(permission)}
                                  disabled={disabled}
                                />
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={getActionBadgeVariant(permission.action)}
                                    className="flex items-center gap-1 text-xs"
                                  >
                                    {getActionIcon(permission.action)}
                                    {permission.action}
                                  </Badge>
                                  <span className="text-sm font-medium">
                                    {permission.resource}:{permission.action}
                                  </span>
                                </div>
                              </div>

                              {/* Inline Scope Selector */}
                              {isSelected && isResourceSpecific && (
                                <div className="flex items-center gap-2">
                                  <InlineScopeSelector
                                    value={assignment?.resourceScope || 'all'}
                                    options={scopeOptions}
                                    onValueChange={(value) => handleScopeChange(permission.id, value)}
                                    disabled={disabled}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Description */}
                            {permission.description && (
                              <div className="pl-8 text-xs text-muted-foreground">
                                {permission.description}
                              </div>
                            )}

                            {/* Resource Selection (only for specific scope) */}
                            {isSelected && assignment?.resourceScope === 'specific' && assignment.resourceType && (
                              <div className="pl-8 pt-2">
                                <ResourceSelector
                                  resourceType={assignment.resourceType}
                                  selectedResourceIds={assignment.resourceIds || []}
                                  onSelectionChange={(resourceIds) => handleResourceSelection(permission.id, resourceIds)}
                                  disabled={disabled}
                                  className="border-0 shadow-none bg-muted/50"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
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