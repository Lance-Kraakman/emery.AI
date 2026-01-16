'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { SkillFormData } from './SkillEditor';
import { updateSkill, deleteSkill, getSkillsByAgent, getOrganizationSkills } from '@/app/actions/skills';
import { useOrganizationPlan } from '@/stores/app-state.store';
import type { SaveStatus } from '@/components/ui/save-status-indicator';

interface UseSkillEditorOptions {
  skill: SkillDTO;
  agentId?: number | null;
  onDeleteRedirect?: string;
}

export function useSkillEditor({ skill, agentId, onDeleteRedirect }: UseSkillEditorOptions) {
  const router = useRouter();
  const organizationTier = useOrganizationPlan();
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<{ id: number; name: string }[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Extract plan from first agentic step if present (for workflow mode)
  // For agentic mode, plan can be stored at skill level or in steps[0].agenticConfig.plan
  const initialPlan = skill.steps?.[0]?.agenticConfig?.plan;

  const [formData, setFormData] = useState<SkillFormData>({
    name: skill.name,
    description: skill.description,
    inputs: skill.inputs,
    outputs: skill.outputs,
    steps: skill.steps || [],
    canvasMetadata: skill.canvasMetadata,
    model: skill.model,
    // Execution mode - default to 'agentic' for new skills, respect existing for loaded skills
    executionType: skill.executionType || 'agentic',
    // Agentic mode fields
    instructions: skill.instructions,
    tools: skill.tools,
    agentType: skill.agentType,
    // Stored plan (from first agentic step)
    plan: initialPlan,
  });

  // Ref to always have current formData (fixes stale closure in auto-save)
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Track last saved state to avoid unnecessary saves
  const lastSavedRef = useRef<string>(JSON.stringify(formData));
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Fetch available skills for workflow canvas skillRef nodes
  useEffect(() => {
    async function fetchSkills() {
      let result;
      if (agentId) {
        result = await getSkillsByAgent(agentId);
      } else {
        result = await getOrganizationSkills(skill.organizationId);
      }

      if (result.success && result.data) {
        setAvailableSkills(
          result.data
            .filter(s => s.id !== skill.id)
            .map(s => ({ id: s.id, name: s.name }))
        );
      }
    }
    fetchSkills();
  }, [agentId, skill.id, skill.organizationId]);

  // Auto-save effect - debounced 2 seconds after changes
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Skip if name is empty (validation)
    if (!formData.name.trim()) {
      return;
    }

    // Check if data actually changed
    const currentJson = JSON.stringify(formData);
    if (currentJson === lastSavedRef.current) {
      return;
    }

    // Mark as unsaved
    setSaveStatus('unsaved');

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      const dataToSave = formDataRef.current;

      // Double-check name isn't empty
      if (!dataToSave.name.trim()) {
        return;
      }

      setSaveStatus('saving');

      try {
        // Build steps with plan stored in first agentic step's config
        const stepsWithPlan = dataToSave.plan && dataToSave.steps?.[0]?.agenticConfig
          ? [
              {
                ...dataToSave.steps[0],
                agenticConfig: {
                  ...dataToSave.steps[0].agenticConfig,
                  plan: dataToSave.plan,
                },
              },
              ...dataToSave.steps.slice(1),
            ]
          : dataToSave.steps;

        const result = await updateSkill(skill.id, {
          name: dataToSave.name,
          description: dataToSave.description,
          inputs: dataToSave.inputs,
          outputs: dataToSave.outputs,
          steps: stepsWithPlan,
          canvasMetadata: dataToSave.canvasMetadata,
          model: dataToSave.model,
          // Execution mode and agentic fields
          executionType: dataToSave.executionType,
          instructions: dataToSave.instructions,
          tools: dataToSave.tools,
          agentType: dataToSave.agentType,
        });

        if (result.success) {
          lastSavedRef.current = JSON.stringify(dataToSave);
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
          toast.error(result.error || 'Failed to auto-save skill');
        }
      } catch (error) {
        console.error('Auto-save error:', error);
        setSaveStatus('error');
        toast.error('Auto-save failed');
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, skill.id]);

  // Manual save (for immediate save if needed)
  const handleSave = useCallback(async () => {
    if (saveStatus === 'saving') return;

    const currentFormData = formDataRef.current;

    if (!currentFormData.name.trim()) {
      toast.error('Skill name is required');
      return;
    }

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    try {
      // Build steps with plan stored in first agentic step's config
      const stepsWithPlan = currentFormData.plan && currentFormData.steps?.[0]?.agenticConfig
        ? [
            {
              ...currentFormData.steps[0],
              agenticConfig: {
                ...currentFormData.steps[0].agenticConfig,
                plan: currentFormData.plan,
              },
            },
            ...currentFormData.steps.slice(1),
          ]
        : currentFormData.steps;

      const result = await updateSkill(skill.id, {
        name: currentFormData.name,
        description: currentFormData.description,
        inputs: currentFormData.inputs,
        outputs: currentFormData.outputs,
        steps: stepsWithPlan,
        canvasMetadata: currentFormData.canvasMetadata,
        model: currentFormData.model,
        // Execution mode and agentic fields
        executionType: currentFormData.executionType,
        instructions: currentFormData.instructions,
        tools: currentFormData.tools,
        agentType: currentFormData.agentType,
      });

      if (!result.success) {
        setSaveStatus('error');
        toast.error(result.error || 'Failed to save skill');
        return;
      }

      lastSavedRef.current = JSON.stringify(currentFormData);
      setSaveStatus('saved');
      toast.success('Skill saved');
    } catch (error) {
      console.error('Error saving skill:', error);
      setSaveStatus('error');
      toast.error('An unexpected error occurred');
    }
  }, [skill.id, saveStatus]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this skill? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteSkill(skill.id);

      if (result.success) {
        toast.success('Skill deleted successfully');
        router.push(onDeleteRedirect || '/skills');
      } else {
        toast.error(result.error || 'Failed to delete skill');
      }
    } catch (error) {
      console.error('Error deleting skill:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    formData,
    setFormData,
    saveStatus,
    isSaving: saveStatus === 'saving',
    isDeleting,
    shareDialogOpen,
    setShareDialogOpen,
    availableSkills,
    organizationTier,
    handleSave,
    handleDelete,
  };
}
