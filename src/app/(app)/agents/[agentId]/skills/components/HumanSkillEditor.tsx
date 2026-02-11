'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TableGroupedInputPanel } from '@/components/skill-config/TableGroupedInputPanel';
import { TableGroupedOutputPanel } from '@/components/skill-config/TableGroupedOutputPanel';
import { UserSelect } from '@/components/ui/UserSelect';
import { getOrganizationMembers } from '@/app/actions/invitations';
import { getOrganizationRolesForSelection } from '@/app/actions/roles';
import type { SkillFormData } from './SkillEditor';
import type { HumanSkillConfig } from '@/ddd/domain/skills/entities/skill';

interface HumanSkillEditorProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  skillId?: number;
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  isReadOnly?: boolean;
  /** Offset for floating panels when header is above */
  hasFloatingHeader?: boolean;
}

interface OrgMember {
  id: string;
  name: string;
  email: string;
  systemRole?: string;
}

interface OrgRole {
  id: number;
  name: string;
  description?: string;
}

/**
 * Human skill editor - Configure skills executed by humans
 *
 * Layout:
 *   Instructions
 *   Assignee Configuration
 *   Timeout Configuration
 *   Inputs (left) | Outputs (right)
 */
export function HumanSkillEditor({
  value,
  onChange,
  isReadOnly = false,
  hasFloatingHeader = false,
}: HumanSkillEditorProps) {
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  // Load organization members and roles
  useEffect(() => {
    async function loadMembers() {
      try {
        setIsLoadingMembers(true);
        const members = await getOrganizationMembers();
        setOrgMembers(members.map(m => ({
          id: m.userId,
          name: m.name || m.email || 'Unknown',
          email: m.email || '',
          systemRole: m.roles?.[0]?.name,
        })));
      } catch (error) {
        console.error('Failed to load organization members:', error);
      } finally {
        setIsLoadingMembers(false);
      }
    }

    async function loadRoles() {
      try {
        setIsLoadingRoles(true);
        const roles = await getOrganizationRolesForSelection();
        setOrgRoles(roles.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
        })));
      } catch (error) {
        console.error('Failed to load organization roles:', error);
      } finally {
        setIsLoadingRoles(false);
      }
    }

    loadMembers();
    loadRoles();
  }, []);

  // Get current config or create default
  const config: HumanSkillConfig = value.humanSkillConfig || {
    instructions: '',
    assigneeType: 'owner',
    timeoutBehavior: 'wait_forever',
  };

  const handleConfigChange = (updates: Partial<HumanSkillConfig>) => {
    onChange({
      ...value,
      humanSkillConfig: {
        ...config,
        ...updates,
      },
    });
  };

  const handleChange = (updates: Partial<SkillFormData>) => {
    onChange({ ...value, ...updates });
  };

  return (
    <div className={cn(
      'h-full flex flex-col p-4 overflow-y-auto space-y-6',
      hasFloatingHeader && 'pt-24'
    )}>
      {/* Instructions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Instructions</Label>
        <p className="text-xs text-muted-foreground">
          Markdown instructions for the human completing this task. Include links to external resources if needed.
        </p>
        <Textarea
          value={config.instructions}
          onChange={(e) => handleConfigChange({ instructions: e.target.value })}
          placeholder="Enter instructions for the human to complete this task..."
          className="min-h-[120px] resize-y"
          disabled={isReadOnly}
        />
      </div>

      {/* Assignee Configuration */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Assignee</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Who should complete this task when the skill is executed?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Assignment Type</Label>
            <Select
              value={config.assigneeType}
              onValueChange={(value: 'owner' | 'specific_user' | 'role') => {
                handleConfigChange({
                  assigneeType: value,
                  // Clear related fields when type changes
                  assigneeId: undefined,
                  assigneeRole: undefined,
                });
              }}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Task Owner</SelectItem>
                <SelectItem value="specific_user">Specific User</SelectItem>
                <SelectItem value="role">Role</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User selector - shown when specific_user */}
          {config.assigneeType === 'specific_user' && (
            <div className="space-y-2">
              <Label className="text-xs">Select User</Label>
              {isLoadingMembers ? (
                <div className="h-9 flex items-center text-sm text-muted-foreground">
                  Loading users...
                </div>
              ) : (
                <UserSelect
                  value={config.assigneeId}
                  onValueChange={(userId) => handleConfigChange({ assigneeId: userId })}
                  users={orgMembers}
                  placeholder="Select a user..."
                  disabled={isReadOnly}
                  className="h-9"
                />
              )}
            </div>
          )}

          {/* Role selector - shown when role */}
          {config.assigneeType === 'role' && (
            <div className="space-y-2">
              <Label className="text-xs">Select Role</Label>
              {isLoadingRoles ? (
                <div className="h-9 flex items-center text-sm text-muted-foreground">
                  Loading roles...
                </div>
              ) : (
                <Select
                  value={config.assigneeRole}
                  onValueChange={(role) => handleConfigChange({ assigneeRole: role })}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orgRoles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeout Configuration */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Timeout Behavior</Label>
          <p className="text-xs text-muted-foreground mt-1">
            What happens if the human doesn&apos;t complete the task?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">On Timeout</Label>
            <Select
              value={config.timeoutBehavior || 'wait_forever'}
              onValueChange={(value: 'wait_forever' | 'fail' | 'skip_with_default') => {
                handleConfigChange({
                  timeoutBehavior: value,
                  // Clear timeout hours when waiting forever
                  timeoutHours: value === 'wait_forever' ? undefined : config.timeoutHours,
                });
              }}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wait_forever">Wait Forever</SelectItem>
                <SelectItem value="fail">Fail Task</SelectItem>
                <SelectItem value="skip_with_default">Skip with Defaults</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timeout hours - shown when not wait_forever */}
          {config.timeoutBehavior && config.timeoutBehavior !== 'wait_forever' && (
            <div className="space-y-2">
              <Label className="text-xs">Timeout (hours)</Label>
              <Input
                type="number"
                min={1}
                value={config.timeoutHours || ''}
                onChange={(e) => handleConfigChange({ timeoutHours: parseInt(e.target.value) || undefined })}
                placeholder="24"
                className="h-9"
                disabled={isReadOnly}
              />
            </div>
          )}
        </div>
      </div>

      {/* Inputs (left) | Outputs (right) */}
      <div className="grid grid-cols-2 gap-4">
        <TableGroupedInputPanel
          inputs={value.inputs}
          onInputsChange={(inputs) => handleChange({ inputs })}
          isReadOnly={isReadOnly}
        />
        <TableGroupedOutputPanel
          outputs={value.outputs}
          inputs={value.inputs}
          onOutputsChange={(outputs) => handleChange({ outputs })}
          isReadOnly={isReadOnly}
        />
      </div>
    </div>
  );
}
