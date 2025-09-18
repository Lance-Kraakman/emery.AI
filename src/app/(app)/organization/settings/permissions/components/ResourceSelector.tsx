'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Badge } from "@/src/components/ui/badge";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Search, Users, Play, Database, Loader2 } from "lucide-react";
import { getAgents } from "@/src/app/actions/agents";
import { getTeams } from "@/src/app/actions/teams";
import { getOrganizationMembers } from "@/src/app/actions/user-organizations";

interface Resource {
  id: number;
  name: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  isOwned?: boolean;
}

interface ResourceSelectorProps {
  resourceType: 'agent' | 'team' | 'user';
  selectedResourceIds: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  disabled?: boolean;
  className?: string;
}

export function ResourceSelector({
  resourceType,
  selectedResourceIds,
  onSelectionChange,
  disabled = false,
  className = ""
}: ResourceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      setError(null);

      try {
        let fetchedResources: Resource[] = [];

        switch (resourceType) {
          case 'agent':
            const agents = await getAgents();
            fetchedResources = agents.map(agent => ({
              id: agent.id,
              name: agent.name,
              description: agent.description || 'AI Agent',
              ownerId: agent.ownerId,
              ownerName: 'Owner', // TODO: Look up owner name from ownerId
              isOwned: false // TODO: Determine if current user owns this agent
            }));
            break;
          case 'team':
            const teams = await getTeams();
            fetchedResources = teams.map(team => ({
              id: team.id,
              name: team.name,
              description: team.description || 'Team'
            }));
            break;
          case 'user':
            const members = await getOrganizationMembers();
            fetchedResources = members.map(member => ({
              id: Number(member.userId.value), // Convert UserId to number
              name: member.name || 'Unknown User',
              description: member.systemRole || 'Member'
            }));
            break;
        }

        setResources(fetchedResources);
      } catch (err) {
        setError(`Failed to load ${resourceType}s`);
        console.error(`Error loading ${resourceType}s:`, err);
      } finally {
        setLoading(false);
      }
    };

    loadResources();
  }, [resourceType]);

  // Filter resources based on search term
  const filteredResources = resources.filter(resource =>
    resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (resource.description && resource.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (resource.ownerName && resource.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleResourceToggle = (resourceId: number) => {
    if (disabled) return;

    if (selectedResourceIds.includes(resourceId)) {
      onSelectionChange(selectedResourceIds.filter(id => id !== resourceId));
    } else {
      onSelectionChange([...selectedResourceIds, resourceId]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onSelectionChange(filteredResources.map(r => r.id));
  };

  const handleClearAll = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  const getResourceIcon = () => {
    switch (resourceType) {
      case 'agent':
        return <Play className="w-4 h-4" />;
      case 'team':
        return <Users className="w-4 h-4" />;
      case 'user':
        return <Users className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getResourceTypeLabel = () => {
    switch (resourceType) {
      case 'agent':
        return 'Agents';
      case 'team':
        return 'Teams';
      case 'user':
        return 'Users';
      default:
        return 'Resources';
    }
  };

  const selectedCount = selectedResourceIds.length;
  const filteredCount = filteredResources.length;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading {getResourceTypeLabel().toLowerCase()}...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <div className="text-destructive text-sm">{error}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {getResourceIcon()}
            Select Specific {getResourceTypeLabel()}
            <Badge variant="outline" className="ml-2">
              {selectedCount}/{filteredCount}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={disabled || filteredCount === 0 || selectedCount === filteredCount}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={disabled || selectedCount === 0}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder={`Search ${getResourceTypeLabel().toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={disabled}
          />
        </div>

        {/* Resource List */}
        <div className="max-h-60 overflow-y-auto space-y-2">
          {filteredResources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? (
                <>
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No {getResourceTypeLabel().toLowerCase()} found matching "{searchTerm}"</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                </>
              ) : (
                <p>No {getResourceTypeLabel().toLowerCase()} available</p>
              )}
            </div>
          ) : (
            filteredResources.map((resource) => {
              const isSelected = selectedResourceIds.includes(resource.id);

              return (
                <div
                  key={resource.id}
                  className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors ${
                    isSelected
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => !disabled && handleResourceToggle(resource.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{resource.name}</span>
                      {resource.isOwned && (
                        <Badge variant="secondary" className="text-xs">
                          Owned
                        </Badge>
                      )}
                    </div>
                    {resource.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {resource.description}
                      </p>
                    )}
                    {resource.ownerName && (
                      <p className="text-xs text-muted-foreground">
                        Owner: {resource.ownerName}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary */}
        {selectedCount > 0 && (
          <div className="text-sm text-muted-foreground pt-2 border-t">
            {selectedCount} {getResourceTypeLabel().toLowerCase()} selected
          </div>
        )}
      </CardContent>
    </Card>
  );
}