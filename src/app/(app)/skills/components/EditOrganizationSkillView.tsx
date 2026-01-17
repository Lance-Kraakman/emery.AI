'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Globe, Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { SaveStatusIndicator } from '@/components/ui/save-status-indicator';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { duplicateSkill } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor } from '../../agents/[agentId]/skills/components/SkillEditor';
import { useSkillEditor } from '../../agents/[agentId]/skills/components/useSkillEditor';

interface EditOrganizationSkillViewProps {
  skill: SkillDTO;
  isSystem?: boolean;
}

/**
 * Full-page organization skill editor view with minimal header.
 */
export function EditOrganizationSkillView({ skill, isSystem = false }: EditOrganizationSkillViewProps) {
  const router = useRouter();
  const [isDuplicating, setIsDuplicating] = useState(false);

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
    agentId: null,
    onDeleteRedirect: '/skills',
  });

  const handleDuplicate = async () => {
    setIsDuplicating(true);

    try {
      const result = await duplicateSkill(skill.id);

      if (result.success && result.data) {
        toast.success('Skill duplicated successfully');
        router.push(`/skills/${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to duplicate skill');
      }
    } catch (error) {
      console.error('Error duplicating skill:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <div className="h-full relative">
      {/* Floating Header - centered in canvas area (between side panels) */}
      <div className="absolute top-2 left-56 right-[21.5rem] z-20 flex justify-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-background/50 backdrop-blur-sm border rounded-full shadow-sm">
        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />

        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Skill name..."
          className="h-8 w-[180px] text-sm bg-transparent border-0 focus-visible:ring-1"
          disabled={isSystem}
        />

        {isSystem && (
          <Badge variant="secondary" className="gap-1 text-xs shrink-0">
            <Lock className="h-3 w-3" />
            Template
          </Badge>
        )}

        {!isSystem && <SaveStatusIndicator status={saveStatus} />}

        <ModelSelector
          value={formData.model}
          onChange={(model) => setFormData({ ...formData, model })}
          organizationTier={organizationTier}
          showInherit={true}
          inheritLabel="Inherit"
          inheritFromModel="IBM Granite 3.3 8B"
          requiredCapabilities={['toolCalling']}
          className="w-[180px] h-8"
          disabled={isSystem}
        />

        {isSystem ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className="gap-1.5 h-8 shrink-0"
            >
              <Copy className="h-3.5 w-3.5" />
              {isDuplicating ? 'Duplicating...' : 'Duplicate'}
            </Button>
            <ShareButton
              resourceType="skill"
              resourceId={skill.id}
              onShare={() => setShareDialogOpen(true)}
              variant="outline"
              size="sm"
            />
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gap-1.5 h-8 shrink-0"
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
          </>
        )}
      </div>
      </div>

      {/* Full-height Editor */}
      <SkillEditor
        value={formData}
        onChange={setFormData}
        agentId={null}
        skillId={skill.id}
        isReadOnly={isSystem}
        organizationTier={organizationTier}
        availableSkills={availableSkills}
        hasFloatingHeader={true}
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
