'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { createSkill, getSkillTemplate } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor, type SkillFormData } from './SkillEditor';

interface NewSkillViewProps {
  agent: AgentDTO;
  templateId?: number;
}

export function NewSkillView({ agent, templateId }: NewSkillViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(!!templateId);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [formData, setFormData] = useState<SkillFormData>({
    name: 'Untitled Skill',
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
      if (!templateId) return; // Type guard

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
            instructions: result.data.instructions,
            tools: result.data.tools
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
        instructions: formData.instructions,
        tools: formData.tools
      });

      if (result.success) {
        toast.success('Skill created successfully');
        router.push(`/agents/${agent.id}`);
      } else {
        toast.error(result.error || 'Failed to create skill');
      }
    } catch (error) {
      console.error('Error creating skill:', error);
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
          <h1 className="text-2xl font-semibold">Skill Builder</h1>
          {templateName && (
            <Badge variant="secondary">
              Based on: {templateName}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {templateName
            ? `Creating skill from template for ${agent.name}`
            : `Create a new skill for ${agent.name}`
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
            agentId={agent.id}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </Card>
    </div>
  );
}
