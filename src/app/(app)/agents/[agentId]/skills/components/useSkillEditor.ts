'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { SkillFormData } from './SkillEditor';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';
import { updateSkill, deleteSkill, uploadSkillAttachment, getSkillsByAgent, getOrganizationSkills } from '@/app/actions/skills';
import { useOrganizationPlan } from '@/stores/app-state.store';

interface UseSkillEditorOptions {
  skill: SkillDTO;
  agentId?: number | null;
  onDeleteRedirect?: string;
}

export function useSkillEditor({ skill, agentId, onDeleteRedirect }: UseSkillEditorOptions) {
  const router = useRouter();
  const organizationTier = useOrganizationPlan();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<{ id: number; name: string }[]>([]);

  const [formData, setFormData] = useState<SkillFormData>({
    name: skill.name,
    description: skill.description,
    inputs: skill.inputs,
    outputs: skill.outputs,
    instructions: skill.instructions,
    tools: skill.tools,
    model: skill.model,
    agentType: skill.agentType,
    content: skill.content,
    pendingAttachments: [],
    executionType: skill.executionType,
    taskModelConfig: skill.taskModelConfig,
    toolExecutionConfig: skill.toolExecutionConfig,
    writeConfig: skill.writeConfig,
    steps: skill.steps || []
  });

  // Ref to always have current formData (fixes stale closure in handleSave)
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Fetch available skills for step builder
  useEffect(() => {
    async function fetchSkills() {
      let result;
      if (agentId) {
        // Agent-scoped skill: fetch skills for this agent
        result = await getSkillsByAgent(agentId);
      } else {
        // Org-level skill: fetch all org-level skills
        result = await getOrganizationSkills(skill.organizationId);
      }

      if (result.success && result.data) {
        setAvailableSkills(
          result.data
            .filter(s => s.id !== skill.id)
            .map(s => ({ id: s.id, name: s.name }))
        );
      }
    }
    fetchSkills();
  }, [agentId, skill.id, skill.organizationId]);

  const handleSave = async () => {
    if (isSaving) return;

    const currentFormData = formDataRef.current;

    if (!currentFormData.name.trim()) {
      toast.error('Skill name is required');
      return;
    }

    setIsSaving(true);

    try {
      // Upload pending attachments
      let updatedContent = [...(currentFormData.content || [])];

      if (currentFormData.pendingAttachments && currentFormData.pendingAttachments.length > 0) {
        toast.info(`Uploading ${currentFormData.pendingAttachments.length} attachment(s)...`);

        for (const file of currentFormData.pendingAttachments) {
          const attachFormData = new FormData();
          attachFormData.append('file', file);
          attachFormData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

          const uploadResult = await uploadSkillAttachment(skill.id, attachFormData);

          if (uploadResult.success && uploadResult.data) {
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

      // Update skill
      const result = await updateSkill(skill.id, {
        name: currentFormData.name,
        description: currentFormData.description,
        inputs: currentFormData.inputs,
        outputs: currentFormData.outputs,
        instructions: currentFormData.instructions,
        tools: currentFormData.tools,
        model: currentFormData.model,
        agentType: currentFormData.agentType,
        content: updatedContent,
        executionType: currentFormData.executionType,
        taskModelConfig: currentFormData.taskModelConfig,
        toolExecutionConfig: currentFormData.toolExecutionConfig,
        writeConfig: currentFormData.writeConfig,
        steps: currentFormData.steps || []
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
        router.push(onDeleteRedirect || '/skills');
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

  return {
    formData,
    setFormData,
    isSaving,
    isDeleting,
    shareDialogOpen,
    setShareDialogOpen,
    availableSkills,
    organizationTier,
    handleSave,
    handleDelete,
  };
}
