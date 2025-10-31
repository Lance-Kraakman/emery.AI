'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { updateSkill, deleteSkill } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor, type SkillFormData } from './SkillEditor';

interface EditSkillViewProps {
  agent: AgentDTO;
  skill: SkillDTO;
}

export function EditSkillView({ agent, skill }: EditSkillViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<SkillFormData>({
    name: skill.name,
    description: skill.description,
    inputs: skill.inputs,
    outputs: skill.outputs,
    instructions: skill.instructions,
    tools: skill.tools
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Skill name is required');
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateSkill(skill.id, {
        name: formData.name,
        description: formData.description,
        inputs: formData.inputs,
        outputs: formData.outputs,
        instructions: formData.instructions,
        tools: formData.tools
      });

      if (result.success) {
        toast.success('Skill updated successfully');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update skill');
      }
    } catch (error) {
      console.error('Error updating skill:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this skill? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteSkill(skill.id);

      if (result.success) {
        toast.success('Skill deleted successfully');
        router.push(`/agents/${agent.id}`);
      } else {
        toast.error(result.error || 'Failed to delete skill');
      }
    } catch (error) {
      console.error('Error deleting skill:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Skill</h1>
          <p className="text-muted-foreground mt-1">
            Agent: {agent.name}
          </p>
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
        <SkillEditor
          value={formData}
          onChange={setFormData}
          agentId={agent.id}
          skillId={skill.id}
        />
      </Card>
    </div>
  );
}
