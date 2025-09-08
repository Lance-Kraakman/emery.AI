'use client'

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye, Edit, Plus, Play, Users, Shield } from "lucide-react";

interface Permission {
  id: number;
  resource: string;
  action: string;
  description: string | null;
}

interface PermissionSelectorProps {
  availablePermissions: Permission[];
  selectedPermissions: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  disabled?: boolean;
}

export function PermissionSelector({ 
  availablePermissions, 
  selectedPermissions, 
  onSelectionChange,
  disabled = false
}: PermissionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

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

  const handlePermissionToggle = (permissionId: number) => {
    if (disabled) return;
    
    if (selectedPermissions.includes(permissionId)) {
      onSelectionChange(selectedPermissions.filter(id => id !== permissionId));
    } else {
      onSelectionChange([...selectedPermissions, permissionId]);
    }
  };

  const handleResourceToggle = (resourcePermissions: Permission[]) => {
    if (disabled) return;
    
    const resourcePermissionIds = resourcePermissions.map(p => p.id);
    const allSelected = resourcePermissionIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      // Unselect all permissions in this resource
      onSelectionChange(selectedPermissions.filter(id => !resourcePermissionIds.includes(id)));
    } else {
      // Select all permissions in this resource
      const newSelections = [...selectedPermissions];
      resourcePermissionIds.forEach(id => {
        if (!newSelections.includes(id)) {
          newSelections.push(id);
        }
      });
      onSelectionChange(newSelections);
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
          const selectedInResource = resourcePermissionIds.filter(id => selectedPermissions.includes(id));
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
                      checked={allSelected}
                      // @ts-ignore - Shadcn Checkbox supports indeterminate
                      indeterminate={someSelected && !allSelected}
                      onCheckedChange={() => handleResourceToggle(permissions)}
                      disabled={disabled}
                    />
                    <label className="text-sm font-medium">Select All</label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {permissions.map((permission) => {
                  const isSelected = selectedPermissions.includes(permission.id);
                  
                  return (
                    <div 
                      key={permission.id} 
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                        isSelected 
                          ? 'border-primary/50 bg-primary/5' 
                          : 'border-border hover:border-primary/30'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={() => handlePermissionToggle(permission.id)}
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
          <p>No permissions found matching "{searchTerm}"</p>
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
            onClick={() => onSelectionChange(availablePermissions.map(p => p.id))}
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