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
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';
import { uploadTaskAttachment } from '@/app/actions/tasks';
import type { ImageAttachment, FileAttachment } from '@/ddd/domain/tasks/entities/task';
import { InstructionTemplateService } from '@/ddd/domain/tasks/services/instruction-template-service';
import { getSampleRow } from '@/app/actions/rows';
import { VariablesPanel, type Variable } from '@/components/shared/VariablesPanel';
import { SkillSelectorForAutomation } from '../SkillSelectorForAutomation';
import type { AutomationInputMappingDTO } from '@/app/dtos/automation.dto';

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
    type: 'CALENDAR',
    title: 'Recurring',
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
  },
  {
    type: 'PIPEDREAM_EVENT',
    title: 'External Event',
    description: 'Trigger from connected apps like Gmail, Slack, etc.',
    icon: Zap,
    badge: 'Integration'
  }
];

/**
 * Generate sample values for all variables based on trigger type
 * Combines trigger metadata samples with actual table data for DATABASE_EVENT
 * Returns Variable[] compatible with VariablesPanel component
 */
function generateVariableSamples(
  triggerType: TriggerType,
  scheduleName: string,
  sampleRowData: Record<string, any> | null
): Variable[] {
  const samples: Variable[] = [];

  // Common trigger variables
  samples.push({ name: '$trigger.type', sampleValue: triggerType });
  samples.push({ name: '$trigger.scheduleName', sampleValue: scheduleName || 'Daily sync' });

  if (triggerType === 'CALENDAR') {
    // Calendar-specific variables
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 3600000); // 1 hour from now
    samples.push({ name: '$trigger.scheduledTime', sampleValue: scheduledTime.toISOString() });
    samples.push({ name: '$trigger.timezone', sampleValue: 'America/New_York' });
  } else if (triggerType === 'DATABASE_EVENT') {
    // Database event variables
    samples.push({ name: '$table.id', sampleValue: '1' });
    samples.push({ name: '$table.name', sampleValue: 'customers' });
    samples.push({ name: '$event.operation', sampleValue: 'INSERT' });
    samples.push({ name: '$event.rowId', sampleValue: '6a0c5b17-d4dc-4c47-924b-8dc47b8f9c76' });
    samples.push({ name: '$event.timestamp', sampleValue: new Date().toISOString() });

    // Add actual row data if available
    if (sampleRowData) {
      Object.entries(sampleRowData).forEach(([fieldName, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        samples.push({ name: `$row.${fieldName}`, sampleValue: displayValue });
      });

      // Show previousRow example for one field
      const firstField = Object.keys(sampleRowData)[0];
      if (firstField) {
        samples.push({ name: `$previousRow.${firstField}`, sampleValue: '(previous value)' });
      }
    }
  } else if (triggerType === 'WEBHOOK') {
    // Webhook-specific variables
    samples.push({ name: '$webhook.payload', sampleValue: '{"event": "user.created"}' });
    samples.push({ name: '$webhook.headers', sampleValue: '{"content-type": "application/json"}' });
    samples.push({ name: '$webhook.origin', sampleValue: 'https://example.com' });
  }

  return samples;
}

export function TriggerConfigModal({
  isOpen,
  onClose,
  agent,
  onUpdate,
  mode = 'edit',
  scheduleIndex = 0
}: TriggerConfigModalProps) {
  const [selectedType, setSelectedType] = useState<TriggerType>('CALENDAR');
  const [currentStep, setCurrentStep] = useState<'select' | 'configure' | 'instructions' | 'review'>('select');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

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
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  // Skill selection state (replaces inline instructions)
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [inputMappings, setInputMappings] = useState<AutomationInputMappingDTO[]>([]);
  const [useSkillMode, setUseSkillMode] = useState(false); // Toggle between skill vs inline instructions

  // Sample data for database triggers
  const [sampleRowData, setSampleRowData] = useState<Record<string, any> | null>(null);
  const [isLoadingSampleData, setIsLoadingSampleData] = useState(false);

  // Initialize with current schedule or start fresh for create mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'create') {
      // Reset to defaults for creating new schedule
      setSelectedType('CALENDAR');
      setManualConfig({ description: '' });
      setCalendarConfig({ rrule: '', timezone: 'UTC', startDate: undefined });
      setDatabaseConfig({ operations: ['INSERT', 'UPDATE'], tableId: undefined });
      setWebhookConfig({ webhookSecret: '', requiresSignature: false, allowedOrigins: [] });
      setScheduleName('');
      setTaskInstructions('');
      setTaskTools([]);
      setPendingAttachments([]);
      setSelectedSkillId(null);
      setInputMappings([]);
      setUseSkillMode(true); // Default to skill mode for new automations
      setCurrentStep('select');
    } else if (mode === 'edit' && agent.automations[scheduleIndex]) {
      // Load existing schedule for editing
      const schedule = agent.automations[scheduleIndex];
      const trigger = schedule.trigger;
      setSelectedType(trigger.type);

      if (trigger.type === 'CALENDAR') {
        setCalendarConfig({
          rrule: trigger.rrule || '',
          timezone: trigger.timezone || 'UTC',
          startDate: trigger.startDate ? new Date(trigger.startDate) : undefined
        });
      } else if (trigger.type === 'DATABASE_EVENT') {
        setDatabaseConfig({
          operations: trigger.operations || ['INSERT', 'UPDATE'],
          tableId: trigger.tableId
        });
      } else if (trigger.type === 'WEBHOOK') {
        setWebhookConfig({
          webhookSecret: trigger.webhookSecret || '',
          requiresSignature: trigger.requiresSignature || false,
          allowedOrigins: trigger.allowedOrigins || []
        });
      }

      // Load task instructions if available (new format)
      setScheduleName(schedule.name || '');

      // Load skill selection if present
      if (schedule.skillId && schedule.skillId > 0) {
        setSelectedSkillId(schedule.skillId);
        setInputMappings(schedule.inputMappings || []);
        setUseSkillMode(true);
        setTaskInstructions('');
        setTaskTools([]);
      } else {
        // Legacy mode: no skill selected
        setSelectedSkillId(null);
        setInputMappings([]);
        setUseSkillMode(false);
        setTaskInstructions('');
        setTaskTools([]);
      }

      setCurrentStep('select');
    }
  }, [isOpen, agent, mode, scheduleIndex]);

  // Fetch sample row data when table is selected for database triggers
  useEffect(() => {
    const fetchSampleData = async () => {
      if (selectedType !== 'DATABASE_EVENT' || !databaseConfig.tableId) {
        setSampleRowData(null);
        return;
      }

      setIsLoadingSampleData(true);
      try {
        const result = await getSampleRow(parseInt(databaseConfig.tableId));
        if (result.success && result.data) {
          setSampleRowData(result.data.sampleData);
        } else {
          console.error('Failed to fetch sample row:', result.error);
          setSampleRowData(null);
        }
      } catch (error) {
        console.error('Error fetching sample row:', error);
        setSampleRowData(null);
      } finally {
        setIsLoadingSampleData(false);
      }
    };

    fetchSampleData();
  }, [selectedType, databaseConfig.tableId]);

  const handleTypeSelect = (type: TriggerType) => {
    setSelectedType(type);
    setCurrentStep('configure');
  };

  // Attachment handlers
  const handleAttachmentAdd = (file: File) => {
    setPendingAttachments(prev => [...prev, file]);
  };

  const handleAttachmentRemove = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('saving');
      setErrorMessage('');

      // LOGGING: Start of save operation
      console.log('[TriggerConfigModal] Starting schedule save', {
        agentId: agent.id,
        mode,
        scheduleIndex,
        selectedType,
        scheduleName,
        hasInstructions: !!taskInstructions,
        toolCount: taskTools.length
      });

      // VALIDATION: Ensure required fields are present
      const validationErrors: string[] = [];

      if (!scheduleName?.trim()) {
        validationErrors.push('Automation name is required');
      }

      // Validate based on mode: skill or inline instructions
      if (useSkillMode) {
        if (!selectedSkillId || selectedSkillId === 0) {
          validationErrors.push('Please select a skill');
        }
      } else {
        if (!taskInstructions?.trim()) {
          validationErrors.push('Task instructions are required');
        }
      }

      // Validate trigger-specific requirements
      if (selectedType === 'CALENDAR' && !calendarConfig.rrule) {
        validationErrors.push('Calendar automation requires an RRule configuration');
      }

      if (selectedType === 'DATABASE_EVENT' && databaseConfig.operations.length === 0) {
        validationErrors.push('Database event trigger requires at least one operation');
      }

      if (validationErrors.length > 0) {
        const errorMsg = validationErrors.join(', ');
        console.error('[TriggerConfigModal] Validation failed:', validationErrors);
        throw new Error(`Validation failed: ${errorMsg}`);
      }

      console.log('[TriggerConfigModal] Validation passed');

      // Step 1: Create TriggerConfig instance
      let triggerConfig: TriggerConfig;

      switch (selectedType) {
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

      // LOGGING: TriggerConfig created
      console.log('[TriggerConfigModal] TriggerConfig created', {
        type: selectedType,
        serialized: triggerConfig.toJSON()
      });

      // Upload attachments to S3 if present
      const imageAttachments: ImageAttachment[] = [];
      const fileAttachments: FileAttachment[] = [];

      if (pendingAttachments.length > 0) {
        console.log('[TriggerConfigModal] Uploading attachments', { count: pendingAttachments.length });

        for (const file of pendingAttachments) {
          const formData = new FormData();
          formData.append('file', file);

          const uploadResult = await uploadTaskAttachment(agent.id, formData);

          if (!uploadResult.success) {
            throw new Error(`Failed to upload ${file.name}: ${uploadResult.error}`);
          }

          const { url, s3Key, type } = uploadResult.data!;

          if (type === 'image') {
            imageAttachments.push({ url, s3Key });
          } else {
            fileAttachments.push({
              type: 'document',
              url,
              filename: file.name,
              mimeType: file.type,
              preprocessed: true
            });
          }
        }

        console.log('[TriggerConfigModal] Attachments uploaded', {
          imageCount: imageAttachments.length,
          fileCount: fileAttachments.length
        });
      }

      // Step 2: Create AutomationConfigurationDTO with trigger + skill reference
      const newSchedule: AutomationConfigurationDTO = {
        trigger: triggerConfig.toJSON() as any, // AIDEV-NOTE: toJSON() returns plain object compatible with TriggerConfigDTO
        skillId: useSkillMode ? (selectedSkillId || 0) : 0,
        inputMappings: useSkillMode ? inputMappings : [],
        enabled: true,
        name: scheduleName,
        description: manualConfig.description || undefined
      };

      // LOGGING: Schedule object created
      console.log('[TriggerConfigModal] Schedule object created', {
        newSchedule,
        hasValidTrigger: !!newSchedule.trigger,
        skillId: newSchedule.skillId
      });

      // Step 3: Update automations array based on mode
      let updatedAutomations: AutomationConfigurationDTO[];

      // BUGFIX: If in edit mode but the schedule doesn't exist at the index, treat as create
      const scheduleExists = agent.automations && agent.automations[scheduleIndex] !== undefined;

      if (mode === 'create' || !scheduleExists) {
        // Append new schedule to existing automations
        if (!scheduleExists && mode === 'edit') {
          console.warn(`[TriggerConfigModal] Edit mode but schedule ${scheduleIndex} doesn't exist. Treating as create.`);
        }
        updatedAutomations = [...(agent.automations || []), newSchedule];
      } else {
        // Replace schedule at specific index
        updatedAutomations = agent.automations.map((schedule: AutomationConfigurationDTO, i: number) =>
          i === scheduleIndex ? newSchedule : schedule
        );
      }

      // LOGGING: Automations array prepared for update
      console.log('[TriggerConfigModal] Automations array prepared', {
        totalAutomations: updatedAutomations.length,
        isCreate: mode === 'create',
        scheduleIndex: mode === 'edit' ? scheduleIndex : 'N/A',
        updatedAutomations
      });

      const result = await updateAgentFromClient(agent.id, {
        automations: updatedAutomations
      });

      // LOGGING: Server action result
      console.log('[TriggerConfigModal] Server action result', {
        success: result.success,
        error: result.error,
        result
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update automation configuration');
      }

      console.log('[TriggerConfigModal] Schedule saved successfully, calling onUpdate and closing modal');

      // Show success state briefly before closing
      setSaveStatus('success');

      // Wait a moment to show success feedback, then close
      setTimeout(() => {
        onUpdate?.();
        onClose();
        // Reset states when closing
        setSaveStatus('idle');
        setErrorMessage('');
      }, 800);
    } catch (error) {
      console.error('Error saving schedule configuration:', error);
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save automation configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 'select') return true;

    if (currentStep === 'configure') {
      switch (selectedType) {
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
      // Require schedule name and either skill or task instructions
      if (!scheduleName.trim()) return false;
      if (useSkillMode) {
        return !!selectedSkillId && selectedSkillId > 0;
      }
      return !!taskInstructions.trim();
    }

    return false;
  };

  const getStepTitle = () => {
    const modePrefix = mode === 'create' ? 'Add Automation' : `Edit Automation`;

    switch (currentStep) {
      case 'select':
        return `${modePrefix}: Choose Type`;
      case 'configure':
        return `${modePrefix}: Configure`;
      case 'instructions':
        return `${modePrefix}: Task`;
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
            Save Automation
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
      description={currentStep === 'instructions' ? undefined : "Configure when and how this agent should be triggered"}
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
                <Label className="text-base font-medium">Recurrence Configuration</Label>
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
            {/* Automation Name - Inline */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Label htmlFor="automation-name" className="text-sm font-medium whitespace-nowrap">
                  Automation Name *
                </Label>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 top-6 hidden group-hover:block z-10 w-64 p-2 bg-popover border rounded-md shadow-md text-xs">
                    <p className="text-foreground">
                      Give this automation a descriptive name to identify it easily
                    </p>
                  </div>
                </div>
              </div>
              <Input
                id="automation-name"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="e.g., Daily Sales Report, Weekly Data Sync"
                className="flex-1"
              />
            </div>

            {/* Mode Toggle: Skill vs Inline Instructions */}
            <Tabs value={useSkillMode ? 'skill' : 'inline'} onValueChange={(v) => setUseSkillMode(v === 'skill')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="skill">Select Skill</TabsTrigger>
                <TabsTrigger value="inline">Custom Instructions</TabsTrigger>
              </TabsList>

              {/* Skill Selection Mode */}
              <TabsContent value="skill" className="mt-4">
                <SkillSelectorForAutomation
                  agentId={agent.id}
                  selectedSkillId={selectedSkillId}
                  onSkillSelect={setSelectedSkillId}
                  inputMappings={inputMappings}
                  onInputMappingsChange={setInputMappings}
                  triggerType={selectedType}
                  tableId={selectedType === 'DATABASE_EVENT' ? databaseConfig.tableId : undefined}
                  sampleRowData={sampleRowData}
                />
              </TabsContent>

              {/* Inline Instructions Mode */}
              <TabsContent value="inline" className="mt-4 space-y-6">
                {/* Variables */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Variables</Label>
                    <div className="group relative">
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block z-10 w-64 p-2 bg-popover border rounded-md shadow-md text-xs">
                        <p className="text-foreground">
                          Click any variable to insert it into your task instructions. Values shown are examples.
                        </p>
                      </div>
                    </div>
                  </div>
                  <VariablesPanel
                    variables={generateVariableSamples(selectedType, scheduleName, sampleRowData)}
                    onInsert={(formattedVar) => {
                      // Insert variable at cursor position in task instructions
                      const input = document.getElementById('automation-task-instructions') as HTMLTextAreaElement;
                      if (input) {
                        const start = input.selectionStart;
                        const end = input.selectionEnd;
                        const before = taskInstructions.substring(0, start);
                        const after = taskInstructions.substring(end);
                        // Convert {$var} format to ${var} format for trigger variables
                        const variableText = formattedVar.replace('{$', '${');
                        setTaskInstructions(before + variableText + after);
                        setTimeout(() => {
                          input.focus();
                          input.setSelectionRange(start + variableText.length, start + variableText.length);
                        }, 0);
                      }
                    }}
                    loading={isLoadingSampleData && selectedType === 'DATABASE_EVENT'}
                    emptyMessage="No variables available"
                  />
                </div>

                {/* Task Instructions with @ Tool Mentions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Task Instructions *</Label>
                    <div className="group relative">
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 top-6 hidden group-hover:block z-10 w-64 p-2 bg-popover border rounded-md shadow-md text-xs">
                        <p className="text-foreground">
                          Define what task should be created when this automation triggers. Use @ to reference tools, documents, files, or agents. When triggered, a new task will be created with these instructions.
                        </p>
                      </div>
                    </div>
                  </div>
                  <UnifiedChatInput
                    value={taskInstructions}
                    onChange={setTaskInstructions}
                    tools={taskTools}
                    onToolsChange={setTaskTools}
                    variables={InstructionTemplateService.getAvailableVariables(selectedType)}
                    placeholder="Describe the task to execute... (Type @ to add tools or $ for variables)"
                    id="automation-task-instructions"
                    mode="form"
                    minHeight="70px"
                    enableSendButton={false}
                    enableAttachments={true}
                    pendingAttachments={pendingAttachments}
                    onAttachmentAdd={handleAttachmentAdd}
                    onAttachmentRemove={handleAttachmentRemove}
                  />
                </div>
              </TabsContent>
            </Tabs>
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

            {/* Task Definition Summary */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-3">Task Definition</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Automation Name:</strong> {scheduleName || 'Not specified'}
                </div>
                {useSkillMode ? (
                  <>
                    <div>
                      <strong>Skill:</strong>{' '}
                      {selectedSkillId ? `Skill ID ${selectedSkillId}` : 'No skill selected'}
                    </div>
                    {inputMappings.length > 0 && (
                      <div>
                        <strong>Input Mappings ({inputMappings.length}):</strong>
                        <div className="mt-2 space-y-1">
                          {inputMappings.map((mapping, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <Badge variant="outline">{mapping.triggerField}</Badge>
                              <span>→</span>
                              <Badge variant="secondary">{mapping.skillInputName}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Status feedback - only show in review step */}
            {saveStatus === 'idle' && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Ready to Save</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your automation configuration is complete. When triggered, it will create a task with the instructions you've defined.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {saveStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Automation Saved Successfully!</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Your automation has been saved and will be active according to your configuration.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {saveStatus === 'error' && errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Error Saving Automation</h4>
                    <p className="text-sm text-red-700 mt-1">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseModal>
  );
}