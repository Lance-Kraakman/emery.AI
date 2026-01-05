'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { createOrganizationSkill, getSkillTemplate } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor, type SkillFormData } from '../../agents/[agentId]/skills/components/SkillEditor';
import { useOrganizationPlan } from '@/stores/app-state.store';

interface NewOrganizationSkillViewProps {
  organizationId: number;
  templateId?: number;
}

/**
 * Full-page organization skill editor view with minimal header.
 * Header contains: back, name, model, save.
 * Canvas fills the remaining height.
 */
export function NewOrganizationSkillView({
  organizationId,
  templateId,
}: NewOrganizationSkillViewProps) {
  const router = useRouter();
  const organizationTier = useOrganizationPlan();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [formData, setFormData] = useState<SkillFormData>({
    name: 'Untitled Organization Skill',
    description: '',
    inputs: [],
    outputs: [],
    steps: [],
    model: null,
  });

  // Load template if templateId is provided
  useEffect(() => {
    if (!templateId) return;

    async function loadTemplate() {
      if (!templateId) return;

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
            steps: result.data.steps || [],
            model: result.data.model,
          });
          toast.success('Template loaded successfully');
        } else {
          toast.error(result.error || 'Failed to load template');
          router.push('/skills/new');
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
      const result = await createOrganizationSkill({
        organizationId,
        name: formData.name,
        description: formData.description,
        inputs: formData.inputs,
        outputs: formData.outputs,
        steps: formData.steps,
        model: formData.model,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to create organization skill');
        return;
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

  if (isLoadingTemplate) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Minimal Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Globe className="h-4 w-4 text-muted-foreground" />

        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Organization skill name..."
          className="h-8 w-64 text-sm"
        />

        {templateName && (
          <Badge variant="secondary" className="text-xs">
            Based on: {templateName}
          </Badge>
        )}

        <ModelSelector
          value={formData.model}
          onChange={(model) => setFormData({ ...formData, model })}
          organizationTier={organizationTier}
          showInherit={true}
          inheritLabel="Inherit"
          inheritFromModel="IBM Granite 3.3 8B"
          requiredCapabilities={['toolCalling']}
          className="w-[180px] h-8"
        />

        <div className="flex-1" />

        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="gap-1.5 h-8"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Creating...' : 'Create Skill'}
        </Button>
      </div>

      {/* Full-height Editor */}
      <div className="flex-1 min-h-0">
        <SkillEditor
          value={formData}
          onChange={setFormData}
          agentId={null}
          organizationTier={organizationTier}
        />
      </div>
    </div>
  );
}
