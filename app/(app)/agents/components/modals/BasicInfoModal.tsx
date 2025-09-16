'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, X } from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { updateAgentFromClient } from '@/app/actions/agents';

interface BasicInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
}

interface FormData {
  name: string;
  role: string;
  description: string;
  status: string;
}

export function BasicInfoModal({ isOpen, onClose, agent, onUpdate }: BasicInfoModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    role: '',
    description: '',
    status: 'active'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && agent) {
      const initialData = {
        name: agent.name || '',
        role: agent.role || '',
        description: agent.description || '',
        status: agent.status || 'active'
      };
      setFormData(initialData);
      setHasChanges(false);
    }
  }, [isOpen, agent]);

  // Track changes
  useEffect(() => {
    if (agent) {
      const hasChanged = (
        formData.name !== (agent.name || '') ||
        formData.role !== (agent.role || '') ||
        formData.description !== (agent.description || '') ||
        formData.status !== (agent.status || 'active')
      );
      setHasChanges(hasChanged);
    }
  }, [formData, agent]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const result = await updateAgentFromClient(agent.id, {
        name: formData.name.trim(),
        role: formData.role.trim(),
        description: formData.description.trim(),
        status: formData.status
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update agent');
      }

      // Call onUpdate to refresh the parent component
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error updating agent:', error);
      // TODO: Add proper error handling/toast notification
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      // TODO: Add confirmation dialog for unsaved changes
      const shouldDiscard = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!shouldDiscard) return;
    }
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {hasChanges && 'You have unsaved changes'}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving || !formData.name.trim()}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Edit Agent Information"
      description="Update the basic information for this agent"
      size="md"
      footer={footer}
      closeOnEscape={!hasChanges}
      closeOnOutsideClick={!hasChanges}
    >
      <div className="p-6 space-y-6">
        {/* Agent Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Agent Name *
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter agent name"
            disabled={isSaving}
          />
        </div>

        {/* Role */}
        <div className="space-y-2">
          <Label htmlFor="role" className="text-sm font-medium">
            Role
          </Label>
          <Input
            id="role"
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            placeholder="e.g., Data Analyst, Customer Support, Content Writer"
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            Describe what this agent does or its primary function
          </p>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status" className="text-sm font-medium">
            Status
          </Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleInputChange('status', value)}
            disabled={isSaving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Active agents can be executed, inactive agents are paused
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe what this agent does, its purpose, and how it should be used..."
            rows={4}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            Optional: Provide details about the agent's purpose and capabilities
          </p>
        </div>
      </div>
    </BaseModal>
  );
}