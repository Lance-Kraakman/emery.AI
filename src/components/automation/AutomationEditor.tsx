'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TriggerTypeSelector } from './TriggerTypeSelector';
import { ScheduleConfigDialog } from './ScheduleConfigDialog';
import { TriggerConfigs, type TriggerConfig, type TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { TableSelector } from '@/app/(app)/agents/components/TableSelector';
import { SkillSelectorForAutomation } from '@/app/(app)/agents/components/SkillSelectorForAutomation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateAgentFromClient, deployPipedreamSource } from '@/app/actions/agents';
import { getSampleRow } from '@/app/actions/rows';
import { getUserOAuthConnections } from '@/app/actions/connections';
import { getTriggersByApp, type TriggerToolDTO } from '@/app/actions/tools';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { AutomationConfigurationDTO, AutomationInputMappingDTO } from '@/app/dtos/automation.dto';
import type { ConnectionDTO } from '@/app/mappers/connection-mapper';

interface AutomationEditorProps {
  agent: AgentDTO;
  automation?: AutomationConfigurationDTO;
  automationIndex?: number;
  onSave?: () => void;
  onCancel?: () => void;
}

export function AutomationEditor({
  agent,
  automation,
  automationIndex,
  onSave,
  onCancel,
}: AutomationEditorProps) {
  const isEditMode = automation !== undefined;

  // Core state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automation name
  const [name, setName] = useState(automation?.name || '');

  // Trigger config
  const [triggerType, setTriggerType] = useState<TriggerType>(automation?.trigger?.type || 'CALENDAR');

  // Calendar config
  const [calendarConfig, setCalendarConfig] = useState({
    rrule: '',
    timezone: 'UTC',
    startDate: undefined as Date | undefined,
  });

  // Database event config
  const [databaseConfig, setDatabaseConfig] = useState({
    operations: ['INSERT', 'UPDATE'] as ('INSERT' | 'UPDATE' | 'DELETE')[],
    tableId: undefined as string | undefined,
  });

  // Webhook config
  const [webhookConfig, setWebhookConfig] = useState({
    webhookSecret: '',
    requiresSignature: false,
    allowedOrigins: [] as string[],
  });

  // Pipedream config
  const [pipedreamConfig, setPipedreamConfig] = useState({
    connectionId: '',
    triggerId: '',
    triggerType: '',
    props: {} as Record<string, any>,
  });

  // Skill selection
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(
    automation?.skillId && automation.skillId > 0 ? automation.skillId : null
  );
  const [inputMappings, setInputMappings] = useState<AutomationInputMappingDTO[]>(
    automation?.inputMappings || []
  );

  // External data
  const [connections, setConnections] = useState<ConnectionDTO[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [availableTriggers, setAvailableTriggers] = useState<TriggerToolDTO[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(false);
  const [sampleRowData, setSampleRowData] = useState<Record<string, any> | null>(null);

  // Webhook URL
  const [webhookOrigin, setWebhookOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  // Initialize from existing automation
  useEffect(() => {
    if (!automation) return;

    const trigger = automation.trigger;
    setTriggerType(trigger.type);

    if (trigger.type === 'CALENDAR') {
      setCalendarConfig({
        rrule: trigger.rrule || '',
        timezone: trigger.timezone || 'UTC',
        startDate: trigger.startDate ? new Date(trigger.startDate) : undefined,
      });
    } else if (trigger.type === 'DATABASE_EVENT') {
      setDatabaseConfig({
        operations: trigger.operations || ['INSERT', 'UPDATE'],
        tableId: trigger.tableId,
      });
    } else if (trigger.type === 'WEBHOOK') {
      setWebhookConfig({
        webhookSecret: trigger.webhookSecret || '',
        requiresSignature: trigger.requiresSignature || false,
        allowedOrigins: trigger.allowedOrigins || [],
      });
    } else if (trigger.type === 'PIPEDREAM_EVENT') {
      setPipedreamConfig({
        connectionId: trigger.connectionId || '',
        triggerId: trigger.triggerType || '',
        triggerType: trigger.triggerType || '',
        props: trigger.props || {},
      });
    }
  }, [automation]);

  // Set webhook origin after hydration
  useEffect(() => {
    setWebhookOrigin(window.location.origin);
  }, []);

  // Fetch sample row when table selected for database trigger
  useEffect(() => {
    const fetchSampleData = async () => {
      if (triggerType !== 'DATABASE_EVENT' || !databaseConfig.tableId) {
        setSampleRowData(null);
        return;
      }

      try {
        const result = await getSampleRow(parseInt(databaseConfig.tableId));
        if (result.success && result.data) {
          setSampleRowData(result.data.sampleData);
        }
      } catch (err) {
        console.error('Error fetching sample row:', err);
      }
    };

    fetchSampleData();
  }, [triggerType, databaseConfig.tableId]);

  // Fetch connections when Pipedream selected
  useEffect(() => {
    const fetchConnections = async () => {
      if (triggerType !== 'PIPEDREAM_EVENT') return;

      setLoadingConnections(true);
      try {
        const result = await getUserOAuthConnections();
        if (result.success && result.data) {
          setConnections(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch connections:', err);
      } finally {
        setLoadingConnections(false);
      }
    };

    fetchConnections();
  }, [triggerType]);

  // Fetch triggers when connection selected
  useEffect(() => {
    const fetchTriggers = async () => {
      if (!pipedreamConfig.connectionId) {
        setAvailableTriggers([]);
        return;
      }

      const selectedConnection = connections.find(c => c.id === pipedreamConfig.connectionId);
      if (!selectedConnection) return;

      setLoadingTriggers(true);
      try {
        const result = await getTriggersByApp(selectedConnection.app);
        if (result.success && result.data) {
          setAvailableTriggers(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch triggers:', err);
      } finally {
        setLoadingTriggers(false);
      }
    };

    fetchTriggers();
  }, [pipedreamConfig.connectionId, connections]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!name.trim()) {
      errors.push('Name is required');
    }

    if (!selectedSkillId) {
      errors.push('Skill is required');
    }

    if (triggerType === 'CALENDAR' && !calendarConfig.rrule) {
      errors.push('Schedule is required');
    }

    if (triggerType === 'DATABASE_EVENT' && databaseConfig.operations.length === 0) {
      errors.push('At least one operation is required');
    }

    if (triggerType === 'PIPEDREAM_EVENT' && !pipedreamConfig.connectionId) {
      errors.push('Connected app is required');
    }

    return errors;
  }, [name, selectedSkillId, triggerType, calendarConfig, databaseConfig, pipedreamConfig]);

  const isValid = validationErrors.length === 0;

  // Copy webhook URL
  const handleCopyWebhookUrl = () => {
    const url = `${webhookOrigin}/api/webhooks/agents/${agent.id}/trigger`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save automation
  const handleSave = async () => {
    if (!isValid) {
      setError(validationErrors.join(', '));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build trigger config
      let triggerConfig: TriggerConfig;

      switch (triggerType) {
        case 'CALENDAR':
          triggerConfig = TriggerConfigs.calendar(calendarConfig.rrule, {
            timezone: calendarConfig.timezone,
            startDate: calendarConfig.startDate,
            enabled: true,
          });
          break;
        case 'DATABASE_EVENT':
          triggerConfig = TriggerConfigs.databaseEvent(databaseConfig.operations, {
            tableId: databaseConfig.tableId,
            enabled: true,
          });
          break;
        case 'WEBHOOK':
          triggerConfig = TriggerConfigs.webhook({
            webhookSecret: webhookConfig.webhookSecret,
            requiresSignature: webhookConfig.requiresSignature,
            allowedOrigins: webhookConfig.allowedOrigins.length > 0 ? webhookConfig.allowedOrigins : undefined,
            enabled: true,
          });
          break;
        case 'PIPEDREAM_EVENT':
          let pipedreamTrigger = TriggerConfigs.pipedreamEvent(
            pipedreamConfig.connectionId,
            pipedreamConfig.triggerId || pipedreamConfig.triggerType || 'default',
            {
              props: Object.keys(pipedreamConfig.props).length > 0 ? pipedreamConfig.props : undefined,
              enabled: true,
            }
          );

          // Deploy to Pipedream if trigger selected
          if (pipedreamConfig.triggerId) {
            const selectedConnection = connections.find(c => c.id === pipedreamConfig.connectionId);
            const appSlug = selectedConnection?.app || pipedreamConfig.triggerId.split('-')[0];

            const deployResult = await deployPipedreamSource({
              agentId: agent.id,
              triggerId: pipedreamConfig.triggerId,
              connectionId: pipedreamConfig.connectionId,
              appSlug,
              configuredProps: pipedreamConfig.props,
            });

            if (deployResult.success && deployResult.data) {
              pipedreamTrigger = pipedreamTrigger.withDeploymentIds({
                sourceId: deployResult.data.sourceId,
                webhookId: deployResult.data.webhookId,
                subscriptionId: deployResult.data.subscriptionId,
              });
            }
          }

          triggerConfig = pipedreamTrigger;
          break;
        default:
          throw new Error(`Unsupported trigger type: ${triggerType}`);
      }

      // Build automation DTO
      const automationDTO: AutomationConfigurationDTO = {
        trigger: triggerConfig.toJSON() as any,
        skillId: selectedSkillId!,
        inputMappings,
        enabled: true,
        name,
      };

      // Update agent automations
      let updatedAutomations: AutomationConfigurationDTO[];
      const scheduleExists = automationIndex !== undefined && agent.automations?.[automationIndex];

      if (isEditMode && scheduleExists) {
        updatedAutomations = agent.automations.map((a, i) => (i === automationIndex ? automationDTO : a));
      } else {
        updatedAutomations = [...(agent.automations || []), automationDTO];
      }

      const result = await updateAgentFromClient(agent.id, {
        automations: updatedAutomations,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save automation');
      }

      onSave?.();
    } catch (err) {
      console.error('Error saving automation:', err);
      setError(err instanceof Error ? err.message : 'Failed to save automation');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="automation-name" className="text-xs font-medium">
          Name
        </Label>
        <Input
          id="automation-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Daily Sales Report"
          className="h-8 text-xs"
        />
      </div>

      {/* Trigger Section */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Trigger</Label>
        <TriggerTypeSelector value={triggerType} onChange={setTriggerType} disabled={isSaving} />

        {/* Calendar config - collapsed with dialog */}
        {triggerType === 'CALENDAR' && (
          <ScheduleConfigDialog
            rrule={calendarConfig.rrule}
            timezone={calendarConfig.timezone}
            onRRuleChange={(rrule) => setCalendarConfig((prev) => ({ ...prev, rrule }))}
            onTimezoneChange={(timezone) => setCalendarConfig((prev) => ({ ...prev, timezone }))}
            disabled={isSaving}
          />
        )}

        {/* Database event config */}
        {triggerType === 'DATABASE_EVENT' && (
          <div className="space-y-2 p-2 border rounded-lg">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground shrink-0">Table:</Label>
              <TableSelector
                value={databaseConfig.tableId}
                onValueChange={(tableId) => setDatabaseConfig((prev) => ({ ...prev, tableId }))}
                placeholder="All tables"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground shrink-0">Operations:</Label>
              <div className="flex gap-2">
                {(['INSERT', 'UPDATE', 'DELETE'] as const).map((op) => (
                  <label key={op} className="flex items-center gap-1 text-[10px]">
                    <input
                      type="checkbox"
                      checked={databaseConfig.operations.includes(op)}
                      onChange={(e) => {
                        const newOps = e.target.checked
                          ? [...databaseConfig.operations, op]
                          : databaseConfig.operations.filter((o) => o !== op);
                        setDatabaseConfig((prev) => ({ ...prev, operations: newOps }));
                      }}
                      className="h-3 w-3"
                    />
                    {op}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Webhook config */}
        {triggerType === 'WEBHOOK' && (
          <div className="space-y-2 p-2 border rounded-lg">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] bg-muted px-2 py-1 rounded truncate">
                {`${webhookOrigin}/api/webhooks/agents/${agent.id}/trigger`}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyWebhookUrl}
                className="h-6 px-2"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground shrink-0">Secret:</Label>
              <Input
                type="password"
                value={webhookConfig.webhookSecret}
                onChange={(e) => setWebhookConfig((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                placeholder="Optional"
                className="h-6 text-[10px] flex-1"
              />
              <label className="flex items-center gap-1 text-[10px] shrink-0">
                <input
                  type="checkbox"
                  checked={webhookConfig.requiresSignature}
                  onChange={(e) => setWebhookConfig((prev) => ({ ...prev, requiresSignature: e.target.checked }))}
                  className="h-3 w-3"
                />
                HMAC
              </label>
            </div>
          </div>
        )}

        {/* Pipedream config */}
        {triggerType === 'PIPEDREAM_EVENT' && (
          <div className="space-y-2 p-2 border rounded-lg">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground shrink-0">App:</Label>
              {loadingConnections ? (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : connections.length === 0 ? (
                <span className="text-[10px] text-muted-foreground">
                  No apps. <a href="/connections" className="text-primary underline">Connect one</a>
                </span>
              ) : (
                <Select
                  value={pipedreamConfig.connectionId}
                  onValueChange={(v) => setPipedreamConfig((prev) => ({ ...prev, connectionId: v, triggerId: '' }))}
                >
                  <SelectTrigger className="h-6 text-[10px] flex-1">
                    <SelectValue placeholder="Select app..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <span className="capitalize">{conn.app}</span>
                        <span className="text-muted-foreground ml-1">({conn.account_name})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {pipedreamConfig.connectionId && (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground shrink-0">Event:</Label>
                {loadingTriggers ? (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </div>
                ) : availableTriggers.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground">No event types available</span>
                ) : (
                  <Select
                    value={pipedreamConfig.triggerId}
                    onValueChange={(v) => {
                      const trigger = availableTriggers.find((t) => t.id === v);
                      setPipedreamConfig((prev) => ({
                        ...prev,
                        triggerId: v,
                        triggerType: trigger?.id || '',
                      }));
                    }}
                  >
                    <SelectTrigger className="h-6 text-[10px] flex-1">
                      <SelectValue placeholder="Select event..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTriggers.map((trigger) => (
                        <SelectItem key={trigger.id} value={trigger.id}>
                          {trigger.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skill Section */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Skill</Label>
        <SkillSelectorForAutomation
          agentId={agent.id}
          selectedSkillId={selectedSkillId}
          onSkillSelect={setSelectedSkillId}
          inputMappings={inputMappings}
          onInputMappingsChange={setInputMappings}
          triggerType={triggerType}
          tableId={triggerType === 'DATABASE_EVENT' ? databaseConfig.tableId : undefined}
          sampleRowData={sampleRowData}
          disabled={isSaving}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={isSaving || !isValid}>
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
