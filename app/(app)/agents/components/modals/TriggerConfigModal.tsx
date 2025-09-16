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

interface TriggerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
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

export function TriggerConfigModal({ isOpen, onClose, agent, onUpdate }: TriggerConfigModalProps) {
  const [selectedType, setSelectedType] = useState<TriggerType>('MANUAL');
  const [currentStep, setCurrentStep] = useState<'select' | 'configure' | 'review'>('select');
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

  // Initialize with current agent trigger
  useEffect(() => {
    if (isOpen && agent.trigger) {
      setSelectedType(agent.trigger.type);

      if (agent.trigger.type === 'MANUAL') {
        setManualConfig({ description: agent.trigger.description || '' });
      } else if (isCalendarTrigger(agent.trigger)) {
        setCalendarConfig({
          rrule: agent.trigger.rrule || '',
          timezone: agent.trigger.timezone || 'UTC',
          startDate: agent.trigger.startDate ? new Date(agent.trigger.startDate) : undefined
        });
      } else if (isDatabaseEventTrigger(agent.trigger)) {
        setDatabaseConfig({
          operations: agent.trigger.operations || ['INSERT', 'UPDATE'],
          tableId: agent.trigger.tableId
        });
      } else if (isWebhookTrigger(agent.trigger)) {
        setWebhookConfig({
          webhookSecret: agent.trigger.webhookSecret || '',
          requiresSignature: agent.trigger.requiresSignature || false,
          allowedOrigins: agent.trigger.allowedOrigins || []
        });
      }

      setCurrentStep('select');
    }
  }, [isOpen, agent]);

  const handleTypeSelect = (type: TriggerType) => {
    setSelectedType(type);
    setCurrentStep('configure');
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      let newTrigger: TriggerConfig;

      switch (selectedType) {
        case 'MANUAL':
          newTrigger = TriggerConfigs.manual(true, manualConfig.description);
          break;
        case 'CALENDAR':
          newTrigger = TriggerConfigs.calendar(calendarConfig.rrule, {
            timezone: calendarConfig.timezone,
            startDate: calendarConfig.startDate,
            enabled: true
          });
          break;
        case 'DATABASE_EVENT':
          newTrigger = TriggerConfigs.databaseEvent(databaseConfig.operations, {
            tableId: databaseConfig.tableId,
            enabled: true
          });
          break;
        case 'WEBHOOK':
          newTrigger = TriggerConfigs.webhook({
            webhookSecret: webhookConfig.webhookSecret,
            requiresSignature: webhookConfig.requiresSignature,
            allowedOrigins: webhookConfig.allowedOrigins.length > 0 ? webhookConfig.allowedOrigins : undefined,
            enabled: true
          });
          break;
        default:
          throw new Error(`Unsupported trigger type: ${selectedType}`);
      }

      const result = await updateAgentFromClient(agent.id, {
        trigger: newTrigger
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update trigger configuration');
      }

      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error saving trigger configuration:', error);
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
    return false;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select':
        return 'Choose Trigger Type';
      case 'configure':
        return `Configure ${getTriggerTypeLabel(selectedType)}`;
      case 'review':
        return 'Review Configuration';
      default:
        return 'Trigger Configuration';
    }
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {currentStep !== 'select' && (
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep === 'review' ? 'configure' : 'select')}
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
            Save Configuration
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

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Ready to Save</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your trigger configuration is complete and ready to be applied to the agent.
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