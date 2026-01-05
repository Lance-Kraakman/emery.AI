'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ModelSelector } from '@/components/ai/ModelSelector';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { createSkill, getSkillTemplate } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor, type SkillFormData } from './SkillEditor';
import { useOrganizationPlan } from '@/stores/app-state.store';

interface NewSkillViewProps {
  agent: AgentDTO;
  templateId?: number;
}

/**
 * Full-page new skill view with minimal header.
 * Header contains: back, name, model, save.
 * Canvas fills the remaining height.
 */
export function NewSkillView({ agent, templateId }: NewSkillViewProps) {
  const router = useRouter();
  const organizationTier = useOrganizationPlan();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [formData, setFormData] = useState<SkillFormData>({
    name: 'Untitled Skill',
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
            name: result.data.name,
            description: result.data.description,
            inputs: result.data.inputs,
            outputs: result.data.outputs,
            steps: result.data.steps || [],
            model: result.data.model,
          });
          toast.success('Template loaded successfully');
        } else {
          toast.error(result.error || 'Failed to load template');
        }
      } catch (error) {
        console.error('Error loading template:', error);
        toast.error('An unexpected error occurred');
      } finally {
        setIsLoadingTemplate(false);
      }
    }

    loadTemplate();
  }, [templateId]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Skill name is required');
      return;
    }

    setIsSaving(true);

    try {
      const result = await createSkill({
        agentId: agent.id,
        name: formData.name,
        description: formData.description,
        inputs: formData.inputs,
        outputs: formData.outputs,
        steps: formData.steps,
        model: formData.model,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to create skill');
        return;
      }

      toast.success('Skill created successfully');
      router.push(`/agents/${agent.id}`);
    } catch (error) {
      console.error('Error creating skill:', error);
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
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Skill name..."
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
          inheritFromModel={agent.defaultModel || 'IBM Granite 3.3 8B'}
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
          agentId={agent.id}
          organizationTier={organizationTier}
        />
      </div>
    </div>
  );
}
