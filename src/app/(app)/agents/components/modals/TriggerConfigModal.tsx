'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Database,
  Globe,
  Zap,
  Clock,
  Save,
  X,
  Loader2,
  CheckCircle2,
  Info
} from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { TriggerConfigs, type TriggerConfig, type TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { updateAgentFromClient } from '@/app/actions/agents';
import { TableSelector } from '../TableSelector';
import ScheduleManager from '../ScheduleManager';
import {
  isCalendarTrigger,
  isDatabaseEventTrigger,
  isWebhookTrigger,
  getTriggerTypeLabel
} from '../trigger-utils';
import { InstructionsWithToolsInput } from '@/components/shared/InstructionsWithToolsInput';
import type { ScheduleConfigurationDTO } from '@/app/dtos/schedule.dto';

interface TriggerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
  mode?: 'create' | 'edit'; // Create new schedule or edit existing
  scheduleIndex?: number;    // Index of schedule to edit (only used in edit mode)
}

interface TriggerTypeOption {
  type: TriggerType;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

const triggerTypes: TriggerTypeOption[] = [
  {
    type: 'MANUAL',
    title: 'Manual Execution',
    description: 'Trigger manually from dashboard or via API calls',
    icon: Zap,
    badge: 'Default'
  },
  {
    type: 'CALENDAR',
    title: 'Scheduled',
    description: 'Run on a recurring schedule with timezone support',
    icon: Calendar,
    badge: 'Popular'
  },
  {
    type: 'DATABASE_EVENT',
    title: 'Database Changes',
    description: 'Trigger when specific database operations occur',
    icon: Database,
    badge: 'Advanced'
  },
  {
    type: 'WEBHOOK',
    title: 'Webhook',
    description: 'Trigger via external HTTP requests with security',
    icon: Globe,
    badge: 'Integration'
  }
];

export function TriggerConfigModal({
  isOpen,
  onClose,
  agent,
  onUpdate,
  mode = 'edit',
  scheduleIndex = 0
}: TriggerConfigModalProps) {
  const [selectedType, setSelectedType] = useState<TriggerType>('MANUAL');
  const [currentStep, setCurrentStep] = useState<'select' | 'configure' | 'instructions' | 'review'>('select');
  const [isSaving, setIsSaving] = useState(false);

  // Configuration states for each trigger type
  const [manualConfig, setManualConfig] = useState({ description: '' });
  const [calendarConfig, setCalendarConfig] = useState({
    rrule: '',
    timezone: 'UTC',
    startDate: undefined as Date | undefined
  });
  const [databaseConfig, setDatabaseConfig] = useState({
    operations: ['INSERT', 'UPDATE'] as ('INSERT' | 'UPDATE' | 'DELETE')[],
    tableId: undefined as string | undefined
  });
  const [webhookConfig, setWebhookConfig] = useState({
    webhookSecret: '',
    requiresSignature: false,
    allowedOrigins: [] as string[]
  });

  // Task instructions state (NEW - defines WHAT task to execute)
  const [scheduleName, setScheduleName] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [taskTools, setTaskTools] = useState<any[]>([]); // ToolConfigDTO[]

  // Initialize with current schedule or start fresh for create mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'create') {
      // Reset to defaults for creating new schedule
      setSelectedType('MANUAL');
      setManualConfig({ description: '' });
      setCalendarConfig({ rrule: '', timezone: 'UTC', startDate: undefined });
      setDatabaseConfig({ operations: ['INSERT', 'UPDATE'], tableId: undefined });
      setWebhookConfig({ webhookSecret: '', requiresSignature: false, allowedOrigins: [] });
      setScheduleName('');
      setTaskInstructions('');
      setTaskTools([]);
      setCurrentStep('select');
    } else if (mode === 'edit' && agent.schedules[scheduleIndex]) {
      // Load existing schedule for editing
      const schedule = agent.schedules[scheduleIndex];
      setSelectedType(schedule.type);

      if (schedule.type === 'MANUAL') {
        setManualConfig({ description: schedule.description || '' });
      } else if (isCalendarTrigger(schedule)) {
        setCalendarConfig({
          rrule: schedule.rrule || '',
          timezone: schedule.timezone || 'UTC',
          startDate: schedule.startDate ? new Date(schedule.startDate) : undefined
        });
      } else if (isDatabaseEventTrigger(schedule)) {
        setDatabaseConfig({
          operations: schedule.operations || ['INSERT', 'UPDATE'],
          tableId: schedule.tableId
        });
      } else if (isWebhookTrigger(schedule)) {
        setWebhookConfig({
          webhookSecret: schedule.webhookSecret || '',
          requiresSignature: schedule.requiresSignature || false,
          allowedOrigins: schedule.allowedOrigins || []
        });
      }

      // Load task instructions if available (new format)
      // @ts-ignore - TODO: Fix after ScheduleConfigurationDTO migration complete
      setScheduleName(schedule.name || '');
      // @ts-ignore - TODO: Fix after ScheduleConfigurationDTO migration complete
      setTaskInstructions(schedule.taskInstructions?.instructions || '');
      // @ts-ignore - TODO: Fix after ScheduleConfigurationDTO migration complete
      setTaskTools(schedule.taskInstructions?.tools || []);

      setCurrentStep('select');
    }
  }, [isOpen, agent, mode, scheduleIndex]);

  const handleTypeSelect = (type: TriggerType) => {
    setSelectedType(type);
    setCurrentStep('configure');
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Step 1: Create TriggerConfig instance
      let triggerConfig: TriggerConfig;

      switch (selectedType) {
        case 'MANUAL':
          triggerConfig = TriggerConfigs.manual(true, manualConfig.description);
          break;
        case 'CALENDAR':
          triggerConfig = TriggerConfigs.calendar(calendarConfig.rrule, {
            timezone: calendarConfig.timezone,
            startDate: calendarConfig.startDate,
            enabled: true
          });
          break;
        case 'DATABASE_EVENT':
          triggerConfig = TriggerConfigs.databaseEvent(databaseConfig.operations, {
            tableId: databaseConfig.tableId,
            enabled: true
          });
          break;
        case 'WEBHOOK':
          triggerConfig = TriggerConfigs.webhook({
            webhookSecret: webhookConfig.webhookSecret,
            requiresSignature: webhookConfig.requiresSignature,
            allowedOrigins: webhookConfig.allowedOrigins.length > 0 ? webhookConfig.allowedOrigins : undefined,
            enabled: true
          });
          break;
        default:
          throw new Error(`Unsupported trigger type: ${selectedType}`);
      }

      // Step 2: Create ScheduleConfigurationDTO with trigger + task instructions
      const newSchedule: ScheduleConfigurationDTO = {
        trigger: triggerConfig.toJSON() as any, // AIDEV-NOTE: toJSON() returns plain object compatible with TriggerConfigDTO
        taskInstructions: {
          instructions: taskInstructions,
          tools: taskTools,
          metadata: {}
        },
        enabled: true,
        name: scheduleName,
        description: manualConfig.description || undefined
      };

      // Step 3: Update schedules array based on mode
      let updatedSchedules: ScheduleConfigurationDTO[];
      if (mode === 'create') {
        // Append new schedule to existing schedules
        updatedSchedules = [...agent.schedules, newSchedule];
      } else {
        // Replace schedule at specific index
        updatedSchedules = agent.schedules.map((schedule, i) =>
          i === scheduleIndex ? newSchedule : schedule
        );
      }

      const result = await updateAgentFromClient(agent.id, {
        schedules: updatedSchedules
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update schedule configuration');
      }

      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error saving schedule configuration:', error);
      // TODO: Add proper error handling/toast notification
    } finally {
      setIsSaving(false);
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 'select') return true;

    if (currentStep === 'configure') {
      switch (selectedType) {
        case 'MANUAL':
          return true; // Always valid
        case 'CALENDAR':
          return !!calendarConfig.rrule;
        case 'DATABASE_EVENT':
          return databaseConfig.operations.length > 0;
        case 'WEBHOOK':
          return true; // Webhook secret is optional
        default:
          return false;
      }
    }

    if (currentStep === 'instructions') {
      // Require schedule name and task instructions
      return !!scheduleName.trim() && !!taskInstructions.trim();
    }

    return false;
  };

  const getStepTitle = () => {
    const modePrefix = mode === 'create' ? 'Add New Schedule' : `Edit Schedule ${scheduleIndex + 1}`;

    switch (currentStep) {
      case 'select':
        return `${modePrefix}: Choose Type`;
      case 'configure':
        return `${modePrefix}: Configure ${getTriggerTypeLabel(selectedType)}`;
      case 'instructions':
        return `${modePrefix}: Define Task`;
      case 'review':
        return `${modePrefix}: Review`;
      default:
        return modePrefix;
    }
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {currentStep !== 'select' && (
          <Button
            variant="outline"
            onClick={() => {
              // Navigate backwards through steps
              if (currentStep === 'review') setCurrentStep('instructions');
              else if (currentStep === 'instructions') setCurrentStep('configure');
              else if (currentStep === 'configure') setCurrentStep('select');
            }}
            disabled={isSaving}
          >
            Back
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>

        {currentStep === 'configure' && (
          <Button
            onClick={() => setCurrentStep('instructions')}
            disabled={!canProceedToNextStep() || isSaving}
          >
            Next: Define Task
          </Button>
        )}

        {currentStep === 'instructions' && (
          <Button
            onClick={() => setCurrentStep('review')}
            disabled={!canProceedToNextStep() || isSaving}
          >
            Review
          </Button>
        )}

        {currentStep === 'review' && (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Schedule
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={getStepTitle()}
      description="Configure when and how this agent should be triggered"
      size="lg"
      footer={footer}
      closeOnEscape={!isSaving}
      closeOnOutsideClick={!isSaving}
    >
      {currentStep === 'select' && (
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {triggerTypes.map((triggerType) => {
              const Icon = triggerType.icon;
              const isSelected = selectedType === triggerType.type;

              return (
                <Card
                  key={triggerType.type}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleTypeSelect(triggerType.type)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-muted rounded-md">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{triggerType.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {triggerType.description}
                          </p>
                        </div>
                      </div>
                      {triggerType.badge && (
                        <Badge variant="outline" className="text-xs">
                          {triggerType.badge}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  {isSelected && (
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        Selected
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {currentStep === 'configure' && (
        <div className="p-6">
          {selectedType === 'MANUAL' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Manual Execution</h4>
                    <p className="text-sm text-green-700 mt-1">
                      This agent can be triggered from the dashboard, via API calls, or when referenced in chat conversations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-description">Execution Context (Optional)</Label>
                <Textarea
                  id="manual-description"
                  value={manualConfig.description}
                  onChange={(e) => setManualConfig({ description: e.target.value })}
                  placeholder="Describe when this agent should be triggered manually..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Help users understand when to trigger this agent
                </p>
              </div>
            </div>
          )}

          {selectedType === 'CALENDAR' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={calendarConfig.timezone}
                    onChange={(e) => setCalendarConfig(prev => ({ ...prev, timezone: e.target.value }))}
                    placeholder="UTC"
                  />
                  <p className="text-xs text-muted-foreground">
                    e.g., America/New_York, Europe/London
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date (Optional)</Label>
                  <Input
                    id="start-date"
                    type="datetime-local"
                    value={calendarConfig.startDate ? calendarConfig.startDate.toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      setCalendarConfig(prev => ({ ...prev, startDate: date }));
                    }}
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">Schedule Configuration</Label>
                <div className="mt-2 border rounded-lg">
                  <ScheduleManager
                    initialRRule={calendarConfig.rrule}
                    onScheduleChange={(rrule) => setCalendarConfig(prev => ({ ...prev, rrule }))}
                    isCreationMode={false}
                  />
                </div>
              </div>
            </div>
          )}

          {selectedType === 'DATABASE_EVENT' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Table Selection</Label>
                  <div className="mt-2">
                    <TableSelector
                      value={databaseConfig.tableId}
                      onValueChange={(tableId) => setDatabaseConfig(prev => ({ ...prev, tableId }))}
                      placeholder="Select table to monitor..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Select a specific table to monitor, or leave unselected to monitor all tables
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">Operations to Monitor</Label>
                  <div className="flex gap-4 mt-2">
                    {(['INSERT', 'UPDATE', 'DELETE'] as const).map((operation) => (
                      <label key={operation} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={databaseConfig.operations.includes(operation)}
                          onChange={(e) => {
                            const newOps = e.target.checked
                              ? [...databaseConfig.operations, operation]
                              : databaseConfig.operations.filter(op => op !== operation);
                            setDatabaseConfig(prev => ({ ...prev, operations: newOps }));
                          }}
                        />
                        <span className="text-sm font-medium">{operation}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select which database operations should trigger the agent
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedType === 'WEBHOOK' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Webhook URL</h4>
                <div className="font-mono text-sm text-blue-800 bg-blue-100 p-3 rounded border break-all">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/agents/${agent.id}/trigger`}
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Use this URL to trigger the agent externally
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Webhook Secret (Optional)</Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    value={webhookConfig.webhookSecret}
                    onChange={(e) => setWebhookConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                    placeholder="Enter a secret for request validation"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include this secret in the X-Webhook-Secret header
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowed-origins">Allowed Origins (Optional)</Label>
                  <Input
                    id="allowed-origins"
                    value={webhookConfig.allowedOrigins.join(', ')}
                    onChange={(e) => {
                      const origins = e.target.value.split(',').map(o => o.trim()).filter(o => o);
                      setWebhookConfig(prev => ({ ...prev, allowedOrigins: origins }));
                    }}
                    placeholder="https://example.com, https://app.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of allowed origins. Leave empty to allow all.
                  </p>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={webhookConfig.requiresSignature}
                    onChange={(e) => setWebhookConfig(prev => ({ ...prev, requiresSignature: e.target.checked }))}
                  />
                  <span className="text-sm">Require HMAC signature verification</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 'instructions' && (
        <div className="p-6">
          <div className="space-y-6">
            {/* Schedule Name */}
            <div className="space-y-2">
              <Label htmlFor="schedule-name" className="text-base font-medium">
                Schedule Name *
              </Label>
              <Input
                id="schedule-name"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="e.g., Daily Sales Report, Weekly Data Sync"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Give this schedule a descriptive name to identify it easily
              </p>
            </div>

            {/* Task Instructions with @ Tool Mentions */}
            <div className="space-y-2">
              <InstructionsWithToolsInput
                value={taskInstructions}
                onChange={setTaskInstructions}
                tools={taskTools}
                onToolsChange={setTaskTools}
                label="Task Instructions *"
                helpText="Define what task should be created when this schedule triggers. Use @ to reference tools, documents, files, or agents."
                placeholder="Describe the task to execute... (Type @ to add tools)"
                id="schedule-task-instructions"
                minHeight="200px"
              />
            </div>

            {/* Info box explaining the concept */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">What happens when triggered?</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    When this schedule triggers, a new task will be created with these instructions.
                    The task will have access to the tools you've selected using @ mentions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'review' && (
        <div className="p-6">
          <div className="space-y-6">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                {React.createElement(triggerTypes.find(t => t.type === selectedType)?.icon || Zap, {
                  className: "h-5 w-5 text-primary"
                })}
                <div>
                  <h3 className="font-medium">
                    {triggerTypes.find(t => t.type === selectedType)?.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {triggerTypes.find(t => t.type === selectedType)?.description}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {selectedType === 'MANUAL' && (
                  <div>
                    <strong>Execution Context:</strong> {manualConfig.description || 'None specified'}
                  </div>
                )}

                {selectedType === 'CALENDAR' && (
                  <>
                    <div><strong>Timezone:</strong> {calendarConfig.timezone}</div>
                    {calendarConfig.startDate && (
                      <div><strong>Start Date:</strong> {calendarConfig.startDate.toLocaleString()}</div>
                    )}
                    <div><strong>Schedule:</strong> {calendarConfig.rrule || 'Not configured'}</div>
                  </>
                )}

                {selectedType === 'DATABASE_EVENT' && (
                  <>
                    <div><strong>Table:</strong> {databaseConfig.tableId || 'All tables'}</div>
                    <div><strong>Operations:</strong> {databaseConfig.operations.join(', ')}</div>
                  </>
                )}

                {selectedType === 'WEBHOOK' && (
                  <>
                    <div><strong>Security:</strong> {webhookConfig.requiresSignature ? 'Signature required' : 'No signature'}</div>
                    {webhookConfig.webhookSecret && (
                      <div><strong>Secret:</strong> Configured</div>
                    )}
                    {webhookConfig.allowedOrigins.length > 0 && (
                      <div><strong>Allowed Origins:</strong> {webhookConfig.allowedOrigins.join(', ')}</div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Task Instructions Summary */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3">Task Definition</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Schedule Name:</strong> {scheduleName || 'Not specified'}
                </div>
                <div>
                  <strong>Task Instructions:</strong>
                  <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                    {taskInstructions || 'No instructions provided'}
                  </div>
                </div>
                {taskTools.length > 0 && (
                  <div>
                    <strong>Tools ({taskTools.length}):</strong>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {taskTools.map((tool, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tool.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Ready to Save</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your schedule configuration is complete. When triggered, it will create a task with the instructions you've defined.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseModal>
  );
}