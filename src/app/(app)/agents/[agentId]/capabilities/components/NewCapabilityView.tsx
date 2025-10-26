'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { createSkill } from '@/app/actions/capabilities';
import { toast } from 'sonner';
import { CapabilityEditor, type CapabilityFormData } from './CapabilityEditor';

interface NewCapabilityViewProps {
  agent: AgentDTO;
}

export function NewCapabilityView({ agent }: NewCapabilityViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<CapabilityFormData>({
    name: 'Untitled Skill',
    description: '',
    steps: [
      {
        type: 'TOOL_STEP',
        instructions: '',
        tools: [],
        servers: []
      }
    ]
  });

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
        steps: formData.steps
      });

      if (result.success) {
        toast.success('Skill created successfully');
        router.push(`/agents/${agent.id}/capabilities`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Skill Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new skill for {agent.name}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/agents/${agent.id}/capabilities`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Editor */}
      <Card className="p-6">
        <CapabilityEditor
          value={formData}
          onChange={setFormData}
          agentId={agent.id}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </Card>
    </div>
  );
}
