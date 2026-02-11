'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Zap, AlertCircle, ChevronDown, ChevronRight, Plus, ArrowRight, Loader2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSkillsByAgent, createSkill } from '@/app/actions/skills';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { AutomationInputMappingDTO } from '@/app/dtos/automation.dto';
import { InstructionTemplateService } from '@/ddd/domain/tasks/services/instruction-template-service';

interface SkillSelectorForAutomationProps {
  agentId: number;
  selectedSkillId: number | null;
  onSkillSelect: (skillId: number | null) => void;
  inputMappings: AutomationInputMappingDTO[];
  onInputMappingsChange: (mappings: AutomationInputMappingDTO[]) => void;
  triggerType: TriggerType;
  tableId?: string; // For DATABASE_EVENT triggers, to show row fields
  sampleRowData?: Record<string, any> | null;
  disabled?: boolean;
  onCreateSkill?: () => void; // Navigate to skill creation
}

/**
 * Skill selector for automation configuration.
 * Allows selecting a skill and mapping trigger variables to skill inputs.
 */
export function SkillSelectorForAutomation({
  agentId,
  selectedSkillId,
  onSkillSelect,
  inputMappings,
  onInputMappingsChange,
  triggerType,
  tableId,
  sampleRowData,
  disabled,
  onCreateSkill
}: SkillSelectorForAutomationProps) {
  const [skills, setSkills] = useState<SkillDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMappings, setShowMappings] = useState(false);

  // Inline skill creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillInstructions, setNewSkillInstructions] = useState('');
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load agent skills on mount
  useEffect(() => {
    async function loadSkills() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getSkillsByAgent(agentId);
        if (result.success && result.data) {
          setSkills(result.data);
        } else {
          setError(result.error || 'Failed to load skills');
        }
      } catch (err) {
        console.error('Error loading skills:', err);
        setError('Failed to load skills');
      }
      setIsLoading(false);
    }
    loadSkills();
  }, [agentId]);

  // Get the selected skill
  const selectedSkill = useMemo(() => {
    return skills.find(s => s.id === selectedSkillId) || null;
  }, [skills, selectedSkillId]);

  // Get available trigger variables based on trigger type
  const triggerVariables = useMemo(() => {
    const variables = InstructionTemplateService.getAvailableVariables(triggerType);

    // Add row fields from sample data for DATABASE_EVENT
    if (triggerType === 'DATABASE_EVENT' && sampleRowData) {
      Object.keys(sampleRowData).forEach(fieldName => {
        variables.push({
          name: `$row.${fieldName}`,
          description: `Value of ${fieldName} field`
        });
      });
    }

    return variables;
  }, [triggerType, sampleRowData]);

  // Handle skill selection
  const handleSkillSelect = (skillIdStr: string) => {
    if (skillIdStr === '__none__') {
      onSkillSelect(null);
      onInputMappingsChange([]);
      return;
    }

    const skillId = parseInt(skillIdStr);
    if (isNaN(skillId)) return;

    onSkillSelect(skillId);

    // Find the skill and initialize mappings for required inputs
    const skill = skills.find(s => s.id === skillId);
    if (skill && skill.inputs.length > 0) {
      // Create empty mappings for all inputs - note: AutomationInputMappingDTO only has triggerField and skillInputName
      // We'll only add a mapping when a trigger field is selected
      onInputMappingsChange([]);
      setShowMappings(true);
    } else {
      onInputMappingsChange([]);
    }
  };

  // Handle input mapping change
  const handleMappingChange = (skillInputName: string, triggerField: string | undefined) => {
    const newMappings = inputMappings.filter(m => m.skillInputName !== skillInputName);

    // Only add mapping if a trigger field is selected
    if (triggerField && triggerField !== '__none__') {
      newMappings.push({
        skillInputName,
        triggerField
      });
    }

    onInputMappingsChange(newMappings);
  };

  // Get mapping for an input
  const getMappingForInput = (inputName: string): AutomationInputMappingDTO | undefined => {
    return inputMappings.find(m => m.skillInputName === inputName);
  };

  // Handle inline skill creation
  const handleCreateSkill = async () => {
    if (!newSkillName.trim()) {
      setCreateError('Skill name is required');
      return;
    }
    if (!newSkillInstructions.trim()) {
      setCreateError('Instructions are required');
      return;
    }

    setIsCreatingSkill(true);
    setCreateError(null);

    try {
      const result = await createSkill({
        agentId,
        name: newSkillName.trim(),
        instructions: newSkillInstructions.trim(),
        executionType: 'agentic'
      });

      if (result.success && result.data) {
        // Add new skill to list and select it
        setSkills(prev => [...prev, result.data!]);
        onSkillSelect(result.data.id);
        onInputMappingsChange([]);

        // Reset form
        setShowCreateForm(false);
        setNewSkillName('');
        setNewSkillInstructions('');
      } else {
        setCreateError(result.error || 'Failed to create skill');
      }
    } catch (err) {
      console.error('Error creating skill:', err);
      setCreateError('Failed to create skill');
    } finally {
      setIsCreatingSkill(false);
    }
  };

  // Cancel inline skill creation
  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setNewSkillName('');
    setNewSkillInstructions('');
    setCreateError(null);
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading skills...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Skill Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select Skill</Label>
        <div className="flex gap-2">
          <Select
            value={selectedSkillId?.toString() || '__none__'}
            onValueChange={handleSkillSelect}
            disabled={disabled}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a skill..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">No skill selected</span>
              </SelectItem>
              {skills.length === 0 ? (
                <SelectItem value="__no_skills__" disabled>
                  No skills available
                </SelectItem>
              ) : (
                skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>{skill.name}</span>
                      {skill.executionType && skill.executionType !== 'agent' && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          {skill.executionType}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {onCreateSkill && (
            <Button
              variant="outline"
              size="icon"
              onClick={onCreateSkill}
              disabled={disabled}
              title="Create new skill"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Select which skill to execute when this automation triggers.
        </p>

        {/* Create new skill toggle */}
        {!showCreateForm && !selectedSkill && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateForm(true)}
            disabled={disabled}
            className="text-primary hover:text-primary/80 p-0 h-auto"
          >
            <Plus className="h-3 w-3 mr-1" />
            Create new skill
          </Button>
        )}
      </div>

      {/* Inline Skill Creation Form */}
      {showCreateForm && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Create New Skill</Label>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelCreate}
              disabled={isCreatingSkill}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="new-skill-name" className="text-xs">Name *</Label>
              <Input
                id="new-skill-name"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="e.g., Process New Lead"
                disabled={isCreatingSkill}
                className="h-8 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="new-skill-instructions" className="text-xs">Instructions *</Label>
              <Textarea
                id="new-skill-instructions"
                value={newSkillInstructions}
                onChange={(e) => setNewSkillInstructions(e.target.value)}
                placeholder="Describe what this skill should do..."
                disabled={isCreatingSkill}
                className="mt-1 min-h-[80px]"
              />
            </div>

            {createError && (
              <p className="text-xs text-destructive">{createError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelCreate}
                disabled={isCreatingSkill}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateSkill}
                disabled={isCreatingSkill || !newSkillName.trim() || !newSkillInstructions.trim()}
              >
                {isCreatingSkill ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Select'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Skill Info */}
      {selectedSkill && (
        <div className="border rounded-lg p-4 bg-primary/5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="font-medium">{selectedSkill.name}</span>
                {selectedSkill.executionType && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedSkill.executionType}
                  </Badge>
                )}
              </div>
              {selectedSkill.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSkill.description}
                </p>
              )}
            </div>
          </div>

          {/* Input Mappings */}
          {selectedSkill.inputs.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowMappings(!showMappings)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
                disabled={disabled}
              >
                {showMappings ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Input Mappings ({selectedSkill.inputs.length})
              </button>

              {showMappings && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Map trigger data to skill inputs. Use trigger variables or enter static values.
                  </p>

                  {selectedSkill.inputs.map((input) => {
                    const mapping = getMappingForInput(input.name);

                    return (
                      <div key={input.name} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={mapping?.triggerField || '__none__'}
                            onValueChange={(val) => {
                              handleMappingChange(input.name, val === '__none__' ? undefined : val);
                            }}
                            disabled={disabled}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select source..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="text-muted-foreground">Not mapped</span>
                              </SelectItem>
                              {triggerVariables.map(v => (
                                <SelectItem key={v.name} value={v.name}>
                                  {v.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{input.name}</span>
                            {input.type && (
                              <Badge variant="outline" className="text-xs">
                                {input.type}
                              </Badge>
                            )}
                            {input.required && (
                              <Badge variant="secondary" className="text-xs">required</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No skill message */}
      {!selectedSkill && skills.length === 0 && (
        <div className="border rounded-lg p-4 text-center text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No skills configured for this agent.</p>
          {onCreateSkill && (
            <Button
              variant="link"
              onClick={onCreateSkill}
              className="mt-2"
              disabled={disabled}
            >
              Create a skill
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
