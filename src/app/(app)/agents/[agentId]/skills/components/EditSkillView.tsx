'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Bot, Sparkles, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
    <div className="h-full relative">
      {/* Floating Header - centered, fits content */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 px-4 py-2 bg-background/50 backdrop-blur-sm border rounded-full shadow-sm">
        {/* Back button when navigated from org chart */}
        {returnTo?.startsWith('org-chart') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-1 h-8 -ml-1 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Org Chart
          </Button>
        )}

        <Bot className="h-4 w-4 text-muted-foreground shrink-0" />

        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Skill name..."
          className="h-8 w-[180px] text-sm bg-transparent border-0 focus-visible:ring-1"
        />

        <SaveStatusIndicator status={saveStatus} />

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

        {/* Mode Toggle - non-destructive switching */}
        <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg h-8">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={formData.executionType !== 'agent' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFormData({ ...formData, executionType: 'agentic' })}
                className="h-7 px-1.5 lg:px-2.5 gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Agentic</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="lg:hidden">Agentic</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={formData.executionType === 'agent' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFormData({ ...formData, executionType: 'agent' })}
                className="h-7 px-1.5 lg:px-2.5 gap-1.5"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Workflow</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="lg:hidden">Workflow</TooltipContent>
          </Tooltip>
        </div>

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
      </div>
    </div>

      {/* Full-height Editor */}
      <SkillEditor
        value={formData}
        onChange={setFormData}
        agentId={agent.id}
        skillId={skill.id}
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
