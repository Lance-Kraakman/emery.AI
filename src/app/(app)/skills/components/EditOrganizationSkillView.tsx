'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Globe, Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { duplicateSkill } from '@/app/actions/skills';
import { toast } from 'sonner';
import { SkillEditor } from '../../agents/[agentId]/skills/components/SkillEditor';
import { useSkillEditor } from '../../agents/[agentId]/skills/components/useSkillEditor';

interface EditOrganizationSkillViewProps {
  skill: SkillDTO;
  isSystem?: boolean;
}

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">
              {isSystem ? 'View Organization Skill' : 'Edit Organization Skill'}
            </h1>
            {isSystem && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                System
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <Globe className="h-3 w-3" />
              Organization
            </Badge>
          </div>
          <p className="text-base text-muted-foreground">
            {isSystem
              ? 'System skills are read-only. Duplicate to create an editable copy.'
              : 'Available to all agents in your organization'
            }
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          {isSystem ? (
            <>
              <Button
                variant="outline"
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                {isDuplicating ? 'Duplicating...' : 'Duplicate to Edit'}
              </Button>
              <ShareButton
                resourceType="skill"
                resourceId={skill.id}
                onShare={() => setShareDialogOpen(true)}
                variant="outline"
                size="default"
              />
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
              <ShareButton
                resourceType="skill"
                resourceId={skill.id}
                onShare={() => setShareDialogOpen(true)}
                variant="outline"
                size="default"
              />
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <Card className="p-6">
        <SkillEditor
          value={formData}
          onChange={setFormData}
          agentId={null}
          skillId={skill.id}
          isReadOnly={isSystem}
          organizationTier={organizationTier}
          availableSkills={availableSkills}
        />
      </Card>

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
