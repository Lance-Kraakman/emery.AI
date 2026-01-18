/**
 * SaveToSkillDialog - Dialog for saving a generated plan to a skill for autonomous execution
 *
 * Used when user approves a plan and wants to save it for future autonomous execution.
 * Allows selecting an existing skill or creating a new one.
 *
 * AIDEV-NOTE: Dialog component for saving plans from chat to skills.
 * Plans are stored in skill.steps[0].agenticConfig.plan as StoredPlan.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Zap, Plus, Bot } from 'lucide-react'
import { getSkillsByAgent } from '@/app/actions/skills'
import { getAgents } from '@/app/actions/agents'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import type { SkillDTO } from '@/app/mappers/skill-mapper'
import type { AgentDTO } from '@/app/mappers/agent-mapper'

const logger = createDebugLogger('SaveToSkillDialog')

interface SaveToSkillDialogProps {
  open: boolean
  onClose: () => void
  onSave: (skillId: number | null, skillName?: string, agentId?: number) => Promise<void>
  planGoal: string
  agentId?: number
}

export function SaveToSkillDialog({
  open,
  onClose,
  onSave,
  planGoal,
  agentId,
}: SaveToSkillDialogProps) {
  const [skills, setSkills] = useState<SkillDTO[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<string>('')
  const [saveMode, setSaveMode] = useState<'existing' | 'new'>('new')
  const [newSkillName, setNewSkillName] = useState('')

  // Agent selection state (when no agentId prop)
  const [availableAgents, setAvailableAgents] = useState<AgentDTO[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(agentId ?? null)
  const [loadingAgents, setLoadingAgents] = useState(false)

  const [loadingSkills, setLoadingSkills] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Effective agent ID (prop or selected)
  const effectiveAgentId = agentId ?? selectedAgentId

  // Load agents when dialog opens and no agentId prop
  useEffect(() => {
    if (open && !agentId) {
      setLoadingAgents(true)
      getAgents({ status: 'active' })
        .then(agents => {
          setAvailableAgents(agents)
          setLoadingAgents(false)
        })
        .catch(err => {
          logger.error('Failed to load agents', err)
          setError('Failed to load agents')
          setLoadingAgents(false)
        })
    }
  }, [open, agentId])

  // Load skills when effectiveAgentId changes
  useEffect(() => {
    if (open && effectiveAgentId) {
      setLoadingSkills(true)
      getSkillsByAgent(effectiveAgentId)
        .then(result => {
          if (result.success && result.data) {
            // Filter to only agentic execution type skills
            const agenticSkills = result.data.filter(
              s => s.executionType === 'agentic' || !s.executionType
            )
            setSkills(agenticSkills)
          }
          setLoadingSkills(false)
        })
        .catch(err => {
          logger.error('Failed to load skills', err)
          setError('Failed to load skills')
          setLoadingSkills(false)
        })
    }
  }, [open, effectiveAgentId])

  // Set default skill name from plan goal
  useEffect(() => {
    if (open && !newSkillName) {
      // Extract a reasonable name from the plan goal (first 50 chars)
      const defaultName = planGoal.length > 50
        ? planGoal.substring(0, 47) + '...'
        : planGoal
      setNewSkillName(defaultName || 'Autonomous Skill')
    }
  }, [open, planGoal, newSkillName])

  // Handle save
  const handleSave = useCallback(async () => {
    // Require agent selection when no agentId prop
    if (!effectiveAgentId) {
      setError('Please select an agent')
      return
    }

    if (saveMode === 'existing' && !selectedSkillId) {
      setError('Please select a skill')
      return
    }

    if (saveMode === 'new' && !newSkillName.trim()) {
      setError('Please enter a skill name')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave(
        saveMode === 'existing' ? parseInt(selectedSkillId) : null,
        saveMode === 'new' ? newSkillName.trim() : undefined,
        effectiveAgentId ?? undefined
      )
      onClose()
    } catch (err) {
      logger.error('Failed to save plan to skill', err)
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }, [saveMode, selectedSkillId, newSkillName, onSave, onClose, effectiveAgentId])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedSkillId('')
      setSaveMode('new')
      setNewSkillName('')
      setError(null)
      setSkills([])
      setAvailableAgents([])
      setSelectedAgentId(agentId ?? null)
    }
  }, [open, agentId])

  const canSave = effectiveAgentId && (
    (saveMode === 'existing' && selectedSkillId) ||
    (saveMode === 'new' && newSkillName.trim())
  )

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Save Plan to Skill
          </DialogTitle>
          <DialogDescription>
            Save this plan to a skill for autonomous execution. The plan will run
            automatically when the skill is triggered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Agent Selection (when no agentId prop) */}
          {!agentId && (
            <div className="space-y-2">
              <Label>Select Agent</Label>
              <Select
                value={selectedAgentId?.toString() ?? ''}
                onValueChange={(v) => {
                  setSelectedAgentId(parseInt(v))
                  // Reset skill selection when agent changes
                  setSelectedSkillId('')
                  setSkills([])
                }}
                disabled={loadingAgents}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingAgents
                        ? 'Loading agents...'
                        : 'Choose an agent...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-muted-foreground" />
                        <span>{agent.name}</span>
                        {agent.role && (
                          <span className="text-xs text-muted-foreground">
                            ({agent.role})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableAgents.length === 0 && !loadingAgents && (
                <p className="text-xs text-muted-foreground">
                  No active agents found. Create an agent first.
                </p>
              )}
            </div>
          )}

          {/* Plan Goal Preview */}
          <div className="space-y-2">
            <Label>Plan Goal</Label>
            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              {planGoal}
            </div>
          </div>

          {/* Save Mode Selection */}
          <div className="space-y-2">
            <Label>Save as</Label>
            <RadioGroup
              value={saveMode}
              onValueChange={(v: string) => setSaveMode(v as 'existing' | 'new')}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="font-normal flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Create new skill
                </Label>
              </div>
              {effectiveAgentId && skills.length > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="font-normal">
                    Update existing skill
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* New Skill Name */}
          {saveMode === 'new' && (
            <div className="space-y-2">
              <Label htmlFor="skillName">Skill Name</Label>
              <Input
                id="skillName"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="Enter skill name..."
              />
            </div>
          )}

          {/* Existing Skill Selection */}
          {saveMode === 'existing' && effectiveAgentId && (
            <div className="space-y-2">
              <Label htmlFor="skill">Select Skill</Label>
              <Select
                value={selectedSkillId}
                onValueChange={setSelectedSkillId}
                disabled={loadingSkills}
              >
                <SelectTrigger id="skill">
                  <SelectValue
                    placeholder={
                      loadingSkills
                        ? 'Loading skills...'
                        : skills.length === 0
                          ? 'No agentic skills available'
                          : 'Select a skill'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {skills.map(skill => (
                    <SelectItem key={skill.id} value={skill.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        {skill.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {skills.length === 0 && !loadingSkills && (
                <p className="text-xs text-muted-foreground">
                  No existing agentic skills found. Create a new one instead.
                </p>
              )}
            </div>
          )}

          {/* Info about autonomous execution */}
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
            <strong>Autonomous execution:</strong> When this skill is triggered,
            the saved plan will execute automatically without requiring approval.
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save to Skill'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
