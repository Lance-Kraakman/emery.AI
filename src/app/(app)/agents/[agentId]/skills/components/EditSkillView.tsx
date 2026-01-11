'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/permissions/ShareDialog';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

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

  // Handle back navigation based on returnTo param
  const handleBack = () => {
    if (returnTo?.startsWith('org-chart')) {
      // Parse selected node from returnTo (format: org-chart&selected=skill-5)
      const selectedMatch = returnTo.match(/selected=([^&]+)/);
      const selected = selectedMatch ? selectedMatch[1] : null;
      router.push(selected ? `/organization?selected=${selected}` : '/organization');
    } else {
      router.back();
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Back button when navigated from org chart */}
      {returnTo?.startsWith('org-chart') && (
        <div className="absolute top-2 left-2 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="bg-background/50 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Org Chart
          </Button>
        </div>
      )}

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
