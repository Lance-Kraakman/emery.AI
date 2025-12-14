'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createOrganizationSkill, getSkillTemplate, uploadSkillAttachment, updateSkill } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor, type SkillFormData } from '../../agents/[agentId]/skills/components/SkillEditor';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';

interface NewOrganizationSkillViewProps {
  organizationId: number;
  templateId?: number;
}

export function NewOrganizationSkillView({ organizationId, templateId }: NewOrganizationSkillViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [formData, setFormData] = useState<SkillFormData>({
    name: 'Untitled Organization Skill',
    description: '',
    inputs: [],
    outputs: [],
    instructions: '',
    tools: []
  });

  // Load template if templateId is provided
  useEffect(() => {
    if (!templateId) return;

    async function loadTemplate() {
      if (!templateId) return; // Type guard inside nested function

      try {
        setIsLoadingTemplate(true);
        const result = await getSkillTemplate(templateId);

        if (result.success && result.data) {
          setTemplateName(result.data.name);
          setFormData({
            name: `${result.data.name} (Copy)`,
            description: result.data.description,
            inputs: result.data.inputs,
            outputs: result.data.outputs,
            instructions: result.data.instructions,
            tools: result.data.tools,
            executionType: result.data.executionType,
            taskModelConfig: result.data.taskModelConfig
          });
          toast.success('Template loaded successfully');
        } else {
          toast.error(result.error || 'Failed to load template');
          router.push('/skills/new'); // Remove templateId param on error
        }
      } catch (error) {
        console.error('Error loading template:', error);
        toast.error('An unexpected error occurred');
        router.push('/skills/new');
      } finally {
        setIsLoadingTemplate(false);
      }
    }

    loadTemplate();
  }, [templateId, router]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Skill name is required');
      return;
    }

    setIsSaving(true);

    try {
      // Step 1: Create the skill
      const result = await createOrganizationSkill({
        organizationId,
        name: formData.name,
        description: formData.description,
        inputs: formData.inputs,
        outputs: formData.outputs,
        instructions: formData.instructions,
        tools: formData.tools,
        executionType: formData.executionType,
        taskModelConfig: formData.taskModelConfig
      });

      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to create organization skill');
        return;
      }

      const skillId = result.data.id;

      // Step 2: Upload pending attachments if any and collect metadata
      let contentParts: MessagePart[] = [];

      if (formData.pendingAttachments && formData.pendingAttachments.length > 0) {
        toast.info(`Uploading ${formData.pendingAttachments.length} attachment(s)...`);

        for (const file of formData.pendingAttachments) {
          const attachFormData = new FormData();
          attachFormData.append('file', file);
          attachFormData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

          const uploadResult = await uploadSkillAttachment(skillId, attachFormData);

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
            contentParts.push(messagePart);
          } else {
            console.error('Failed to upload attachment:', file.name, uploadResult.error);
            toast.error(`Failed to upload ${file.name}`);
          }
        }

        // Step 3: Update skill with content metadata
        if (contentParts.length > 0) {
          const updateResult = await updateSkill(skillId, {
            content: contentParts
          });

          if (!updateResult.success) {
            console.error('Failed to save attachment metadata:', updateResult.error);
            toast.warning('Skill created but attachment metadata may not be saved');
          }
        }
      }

      toast.success('Organization skill created successfully');
      router.push('/skills');
    } catch (error) {
      console.error('Error creating organization skill:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Organization Skill Builder</h1>
          {templateName && (
            <Badge variant="secondary">
              Based on: {templateName}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {templateName
            ? 'Creating skill from template - customize as needed'
            : 'Create a new organization skill available to all agents'
          }
        </p>
      </div>

      {/* Editor */}
      <Card className="p-6">
        {isLoadingTemplate ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading template...</p>
            </div>
          </div>
        ) : (
          <SkillEditor
            value={formData}
            onChange={setFormData}
            agentId={null} // No agentId for organization skills
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </Card>
    </div>
  );
}
