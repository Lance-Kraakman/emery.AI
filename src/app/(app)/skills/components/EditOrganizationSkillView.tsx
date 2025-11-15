'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { updateSkill, deleteSkill, uploadSkillAttachment } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor, type SkillFormData } from '../../agents/[agentId]/skills/components/SkillEditor';

interface EditOrganizationSkillViewProps {
  skill: SkillDTO;
}

export function EditOrganizationSkillView({ skill }: EditOrganizationSkillViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<SkillFormData>({
    name: skill.name,
    description: skill.description,
    inputs: skill.inputs,
    outputs: skill.outputs,
    instructions: skill.instructions,
    tools: skill.tools,
    content: skill.content, // Load existing attachments
    pendingAttachments: [] // Start with no pending attachments
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Skill name is required');
      return;
    }

    setIsSaving(true);

    try {
      // Step 1: Update the skill
      const result = await updateSkill(skill.id, {
        name: formData.name,
        description: formData.description,
        inputs: formData.inputs,
        outputs: formData.outputs,
        instructions: formData.instructions,
        tools: formData.tools
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to update skill');
        return;
      }

      // Step 2: Upload pending attachments if any
      if (formData.pendingAttachments && formData.pendingAttachments.length > 0) {
        toast.info(`Uploading ${formData.pendingAttachments.length} attachment(s)...`);

        for (const file of formData.pendingAttachments) {
          const attachFormData = new FormData();
          attachFormData.append('file', file);
          attachFormData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

          const uploadResult = await uploadSkillAttachment(skill.id, attachFormData);
          if (!uploadResult.success) {
            console.error('Failed to upload attachment:', file.name, uploadResult.error);
            toast.error(`Failed to upload ${file.name}`);
          }
        }
      }

      toast.success('Organization skill updated successfully');
      router.refresh();
    } catch (error) {
      console.error('Error updating skill:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this organization skill? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteSkill(skill.id);

      if (result.success) {
        toast.success('Organization skill deleted successfully');
        router.push('/skills');
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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Edit Organization Skill</h1>
            <Badge variant="secondary">
              <Globe className="h-3 w-3 mr-1" />
              Organization
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Available to all agents in your organization
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
          agentId={null} // No agentId for organization skills
          skillId={skill.id}
        />
      </Card>
    </div>
  );
}
