'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import { ModelSelector } from '@/components/ai/ModelSelector';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { SkillEditor } from './SkillEditor';
import { useSkillEditor } from './useSkillEditor';

interface EditSkillViewProps {
  agent: AgentDTO;
  skill: SkillDTO;
}

/**
 * Full-page skill editor view with minimal header.
 * Header contains: back, name, model, delete, share, save.
 * Canvas fills the remaining height.
 */
export function EditSkillView({ agent, skill }: EditSkillViewProps) {
  const router = useRouter();

  const {
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
  } = useSkillEditor({
    skill,
    agentId: agent.id,
    onDeleteRedirect: `/agents/${agent.id}`,
  });

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
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="gap-1.5 h-8"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>

        <ShareButton
          resourceType="skill"
          resourceId={skill.id}
          onShare={() => setShareDialogOpen(true)}
          variant="outline"
          size="sm"
        />

        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="gap-1.5 h-8"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Full-height Editor */}
      <div className="flex-1 min-h-0">
        <SkillEditor
          value={formData}
          onChange={setFormData}
          agentId={agent.id}
          skillId={skill.id}
          organizationTier={organizationTier}
          availableSkills={availableSkills}
        />
      </div>

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
