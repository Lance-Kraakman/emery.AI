'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Globe, Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import { ModelSelector } from '@/components/ai/ModelSelector';
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
    <div className="h-full flex flex-col">
      {/* Minimal Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Globe className="h-4 w-4 text-muted-foreground" />

        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Skill name..."
          className="h-8 w-64 text-sm"
          disabled={isSystem}
        />

        {isSystem && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Lock className="h-3 w-3" />
            System
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
          disabled={isSystem}
        />

        <div className="flex-1" />

        {isSystem ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className="gap-1.5 h-8"
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
          </>
        )}
      </div>

      {/* Full-height Editor */}
      <div className="flex-1 min-h-0">
        <SkillEditor
          value={formData}
          onChange={setFormData}
          agentId={null}
          skillId={skill.id}
          isReadOnly={isSystem}
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
