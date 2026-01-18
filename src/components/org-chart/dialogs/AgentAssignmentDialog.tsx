'use client';

/**
 * AgentAssignmentDialog Component
 *
 * Dialog for configuring entities when dropped onto an agent:
 * - Database mode: Configure access/sync modes for agent-level data source
 * - Org skill mode: Convert org-level skill to agent-scoped with warning
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AccessModeToggle } from '@/components/data-sources/AccessModeToggle';
import { SyncModeSelector } from '@/components/data-sources/SyncModeSelector';
import { AlertTriangle, Database, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ContextMappingAccessMode,
  ContextMappingSyncMode,
} from '@/ddd/domain/context/entities/context-mapping';

export interface AssignmentConfig {
  accessMode?: ContextMappingAccessMode;
  syncMode?: ContextMappingSyncMode;
  action?: 'convert' | 'clone';
}

interface AgentAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: AssignmentConfig) => Promise<void>;
  mode: 'database' | 'org_skill';
  entityName: string;
  agentName: string;
}

export function AgentAssignmentDialog({
  isOpen,
  onClose,
  onConfirm,
  mode,
  entityName,
  agentName,
}: AgentAssignmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Database mode state
  const [accessMode, setAccessMode] = useState<ContextMappingAccessMode>('readwrite');
  const [syncMode, setSyncMode] = useState<ContextMappingSyncMode>('on_access');

  // Org skill mode state
  const [skillAction, setSkillAction] = useState<'convert' | 'clone'>('convert');

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      if (mode === 'database') {
        await onConfirm({ accessMode, syncMode });
      } else {
        await onConfirm({ action: skillAction });
      }
      onClose();
    } catch (error) {
      console.error('Assignment failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'database' ? (
              <>
                <Database className="h-5 w-5 text-slate-500" />
                Configure Data Source
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 text-violet-500" />
                Assign Skill to Agent
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'database' ? (
              <>
                Configure how <span className="font-medium">{entityName}</span> will be accessible to{' '}
                <span className="font-medium">{agentName}</span>.
              </>
            ) : (
              <>
                Assign <span className="font-medium">{entityName}</span> to{' '}
                <span className="font-medium">{agentName}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {mode === 'database' ? (
            <>
              {/* Access Mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Access Mode</Label>
                <AccessModeToggle
                  value={accessMode}
                  onChange={setAccessMode}
                  disabled={isLoading}
                  size="md"
                />
                <p className="text-xs text-muted-foreground">
                  Determines what operations the agent can perform on this data source.
                </p>
              </div>

              {/* Sync Mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sync Mode</Label>
                <SyncModeSelector
                  value={syncMode}
                  onChange={setSyncMode}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Controls when data is synchronized between the agent and the database.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Warning Banner */}
              <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Scope Change Warning
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    This skill is currently available organization-wide. Assigning it to an agent
                    will limit its availability to only this agent.
                  </p>
                </div>
              </div>

              {/* Action Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Choose an action</Label>
                <RadioGroup
                  value={skillAction}
                  onValueChange={(value) => setSkillAction(value as 'convert' | 'clone')}
                  disabled={isLoading}
                  className="space-y-2"
                >
                  <div
                    className={cn(
                      'flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      skillAction === 'convert'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                    onClick={() => setSkillAction('convert')}
                  >
                    <RadioGroupItem value="convert" id="convert" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="convert" className="font-medium cursor-pointer">
                        Convert to agent skill
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Move this skill from organization-level to agent-level. It will only be
                        available to this agent.
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      skillAction === 'clone'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                    onClick={() => setSkillAction('clone')}
                  >
                    <RadioGroupItem value="clone" id="clone" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="clone" className="font-medium cursor-pointer">
                        Create a copy for this agent
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Keep the original org-level skill and create a duplicate that belongs to
                        this agent.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {mode === 'database' ? 'Configuring...' : 'Assigning...'}
              </>
            ) : mode === 'database' ? (
              'Add Data Source'
            ) : skillAction === 'convert' ? (
              'Convert Skill'
            ) : (
              'Create Copy'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AgentAssignmentDialog;
