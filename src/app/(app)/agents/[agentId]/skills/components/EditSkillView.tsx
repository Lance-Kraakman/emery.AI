'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { updateSkill, deleteSkill, uploadSkillAttachment } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor, type SkillFormData } from './SkillEditor';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';
import { useOrganizationPlan } from '@/stores/app-state.store';

interface EditSkillViewProps {
  agent: AgentDTO;
  skill: SkillDTO;
}

export function EditSkillView({ agent, skill }: EditSkillViewProps) {
  const router = useRouter();
  const organizationTier = useOrganizationPlan();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [formData, setFormData] = useState<SkillFormData>({
    name: skill.name,
    description: skill.description,
    inputs: skill.inputs,
    outputs: skill.outputs,
    instructions: skill.instructions,
    tools: skill.tools,
    content: skill.content, // Load existing attachments
    pendingAttachments: [], // Start with no pending attachments
    executionType: skill.executionType,
    taskModelConfig: skill.taskModelConfig
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Skill name is required');
      return;
    }

    setIsSaving(true);

    try {
      // Step 1: Upload pending attachments if any and collect metadata
      let updatedContent = [...(formData.content || [])];

      if (formData.pendingAttachments && formData.pendingAttachments.length > 0) {
        toast.info(`Uploading ${formData.pendingAttachments.length} attachment(s)...`);

        for (const file of formData.pendingAttachments) {
          const attachFormData = new FormData();
          attachFormData.append('file', file);
          attachFormData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

          const uploadResult = await uploadSkillAttachment(skill.id, attachFormData);

          if (uploadResult.success && uploadResult.data) {
            // Convert upload metadata to MessagePart and add to content
            const metadata = uploadResult.data;
            const messagePart: MessagePart = metadata.type === 'image'
              ? { imageUrl: { url: metadata.url } }
              : {
                  file: {
                    url: metadata.url,
                    filename: metadata.filename,
                    size: metadata.sizeBytes,
                    mimeType: metadata.mimeType
                  }
                };
            updatedContent.push(messagePart);
          } else {
            console.error('Failed to upload attachment:', file.name, uploadResult.error);
            toast.error(`Failed to upload ${file.name}`);
          }
        }
      }

      // Step 2: Update the skill WITH the content
      const result = await updateSkill(skill.id, {
        name: formData.name,
        description: formData.description,
        inputs: formData.inputs,
        outputs: formData.outputs,
        instructions: formData.instructions,
        tools: formData.tools,
        content: updatedContent, // Include attachment metadata
        executionType: formData.executionType,
        taskModelConfig: formData.taskModelConfig
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to update skill');
        return;
      }

      toast.success('Skill updated successfully');
      router.refresh();
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
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2 -ml-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">Edit Skill</h1>
          </div>
          <p className="text-base text-muted-foreground">
            Assigned to <span className="font-medium text-foreground">{agent.name}</span>
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <ShareButton
            resourceType="skill"
            resourceId={skill.id}
            onShare={() => setShareDialogOpen(true)}
            variant="outline"
            size="default"
          />
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
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
          organizationTier={organizationTier}
        />
      </Card>

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        resourceType="skill"
        resourceId={skill.id}
        resourceName={skill.name}
      />
    </div>
  );
}
