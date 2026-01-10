'use client';

import React from 'react';
import { Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { SaveStatusIndicator } from '@/components/ui/save-status-indicator';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { SkillEditor } from './SkillEditor';
import { useSkillEditor } from './useSkillEditor';

interface EditSkillViewProps {
  agent: AgentDTO;
  skill: SkillDTO;
}

/**
 * Full-page skill editor view with floating panels.
 * Left panel: name + save status
 * Right panel: config + model/delete/share when no node selected
 * Canvas fills full height. Auto-saves on changes.
 */
export function EditSkillView({ agent, skill }: EditSkillViewProps) {
  const {
    formData,
    setFormData,
    saveStatus,
    isDeleting,
    shareDialogOpen,
    setShareDialogOpen,
    availableSkills,
    organizationTier,
    handleDelete,
  } = useSkillEditor({
    skill,
    agentId: agent.id,
    onDeleteRedirect: `/agents/${agent.id}`,
  });

  return (
    <div className="relative h-full w-full">
      {/* Full-height Editor - takes entire space */}
      <SkillEditor
        value={formData}
        onChange={setFormData}
        agentId={agent.id}
        skillId={skill.id}
        organizationTier={organizationTier}
        availableSkills={availableSkills}
        // Pass header controls to render in floating panels
        headerControls={{
          name: formData.name,
          onNameChange: (name) => setFormData({ ...formData, name }),
          saveStatus,
          model: formData.model,
          onModelChange: (model) => setFormData({ ...formData, model }),
          agentDefaultModel: agent.defaultModel || 'IBM Granite 3.3 8B',
          isDeleting,
          onDelete: handleDelete,
          skillId: skill.id,
          onShareClick: () => setShareDialogOpen(true),
          organizationTier,
        }}
      />

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
