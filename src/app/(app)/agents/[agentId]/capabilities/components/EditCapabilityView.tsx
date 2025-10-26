'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { updateSkill, deleteSkill } from '@/app/actions/capabilities';
import { toast } from 'sonner';
import { CapabilityEditor, type CapabilityFormData } from './CapabilityEditor';

interface EditCapabilityViewProps {
  agent: AgentDTO;
  capability: SkillDTO;
}

export function EditCapabilityView({ agent, capability }: EditCapabilityViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<CapabilityFormData>({
    name: capability.name,
    description: capability.description,
    steps: capability.steps.map(step => ({
      type: step.type as 'TOOL_STEP' | 'CODE_STEP',
      instructions: step.instructions,
      model: step.model,
      tools: step.tools,
      servers: step.servers
    }))
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Capability name is required');
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateSkill(capability.id, {
        name: formData.name,
        description: formData.description
      });

      if (result.success) {
        toast.success('Capability updated successfully');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update capability');
      }
    } catch (error) {
      console.error('Error updating capability:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this capability? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteSkill(capability.id);

      if (result.success) {
        toast.success('Capability deleted successfully');
        router.push(`/agents/${agent.id}/capabilities`);
      } else {
        toast.error(result.error || 'Failed to delete capability');
      }
    } catch (error) {
      console.error('Error deleting capability:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/agents/${agent.id}/capabilities`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Capability</h1>
            <p className="text-muted-foreground mt-1">
              Agent: {agent.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <Card className="p-6">
        <CapabilityEditor
          value={formData}
          onChange={setFormData}
          agentId={agent.id}
          capabilityId={capability.id}
        />
      </Card>
    </div>
  );
}
