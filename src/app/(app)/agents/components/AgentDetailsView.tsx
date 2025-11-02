'use client';

import React, { useState, useEffect } from 'react';
import { Edit, ChevronDown, ChevronRight, Activity, Cog, Save, X, Loader2, Calendar, Plus, Trash2, Sparkles } from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { TriggerConfigs, type TriggerConfig, type TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { updateAgentFromClient } from '@/app/actions/agents';
import AgentActivityPanel from './AgentActivityPanel';
import ScheduleManager from './ScheduleManager';
import {
  isCalendarTrigger,
  isDatabaseEventTrigger,
  isWebhookTrigger,
  getCalendarRRule,
  getDatabaseEventOperations,
  getDatabaseEventTableId,
  getWebhookSecret,
  getWebhookRequiresSignature,
  getTriggerTypeLabel
} from './trigger-utils';
import { TableSelector } from './TableSelector';

// AIDEV-NOTE: Agent details view with inline editing functionality

interface AgentDetailsViewProps {
  agent: AgentDTO;
}

interface EditFormData {
  name: string;
  role: string;
  description: string;
  persona: string;
  status: string;
  schedules: any[]; // ScheduleConfigurationDTO[] - use any during migration
  defaultModel?: string | null; // Agent's default AI model
}

export default function AgentDetailsView({ agent }: AgentDetailsViewProps) {
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isTriggerConfigOpen, setIsTriggerConfigOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: agent.name || '',
    role: agent.role || '',
    description: agent.description || '',
    persona: agent.persona || '',
    status: agent.status || 'active',
    schedules: agent.schedules?.length > 0 ? agent.schedules : [TriggerConfigs.manual()],
    defaultModel: agent.defaultModel || null
  });

  const handleEdit = () => {
    setIsEditMode(true);
    setEditFormData({
      name: agent.name || '',
      role: agent.role || '',
      description: agent.description || '',
      persona: agent.persona || '',
      status: agent.status || 'active',
      schedules: agent.schedules?.length > 0 ? agent.schedules : [TriggerConfigs.manual()],
      defaultModel: agent.defaultModel || null
    });
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditFormData({
      name: agent.name || '',
      role: agent.role || '',
      description: agent.description || '',
      persona: agent.persona || '',
      status: agent.status || 'active',
      schedules: agent.schedules?.length > 0 ? agent.schedules : [TriggerConfigs.manual()],
      defaultModel: agent.defaultModel || null
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      console.log('[AgentDetailsView] handleSave - editFormData before save:', JSON.stringify(editFormData, null, 2));

      const updatedAgent = {
        ...agent,
        name: editFormData.name.trim(),
        role: editFormData.role.trim(),
        description: editFormData.description.trim(),
        persona: editFormData.persona.trim(),
        status: editFormData.status
      };

      console.log('[AgentDetailsView] handleSave - Calling updateAgentFromClient');

      const result = await updateAgentFromClient(agent.id, {
        name: editFormData.name.trim(),
        role: editFormData.role.trim(),
        description: editFormData.description.trim(),
        persona: editFormData.persona.trim(),
        status: editFormData.status as 'active' | 'inactive' | 'archived',
        schedules: editFormData.schedules,
        defaultModel: editFormData.defaultModel
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update agent');
      }

      setIsEditMode(false);
      // Data will be automatically revalidated by Next.js

    } catch (error) {
      console.error('Error updating agent:', error);
      // Simple alert for now - could be replaced with a toast system later
      alert(error instanceof Error ? error.message : 'An error occurred while updating the agent');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof EditFormData, value: string | null) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTriggerTypeChange = (triggerType: TriggerType) => {
    let newTrigger: TriggerConfig;

    switch (triggerType) {
      case 'MANUAL':
        newTrigger = TriggerConfigs.manual();
        break;
      case 'CALENDAR':
        newTrigger = TriggerConfigs.calendar('FREQ=DAILY;INTERVAL=1');
        break;
      case 'DATABASE_EVENT':
        newTrigger = TriggerConfigs.databaseEvent(['INSERT', 'UPDATE']);
        break;
      case 'WEBHOOK':
        newTrigger = TriggerConfigs.webhook();
        break;
      default:
        newTrigger = TriggerConfigs.manual();
    }

    setEditFormData(prev => ({ ...prev, schedules: [newTrigger] }));
  };

  const handleTriggerConfigChange = (config: Partial<TriggerConfig>) => {
    setEditFormData(prev => {
      const currentSchedule = prev.schedules[0] || TriggerConfigs.manual();
      const updatedSchedule = { ...currentSchedule, ...config } as TriggerConfig;
      return { ...prev, schedules: [updatedSchedule] };
    });
  };


  return (
    <div className="space-y-3 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-start sticky top-0 bg-background z-10 pb-2">
        <div className="flex-1 mr-4">
          {isEditMode ? (
            <>
              <Input
                value={editFormData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="text-2xl font-bold h-auto p-2 border-none shadow-none bg-transparent mb-2 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
                placeholder="Agent name"
              />
              <div className="flex gap-2">
                <Input
                  value={editFormData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="text-muted-foreground h-auto p-2 border-none shadow-none bg-transparent flex-1 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
                  placeholder="Role"
                />
                <Select value={editFormData.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger className="w-32 h-auto p-2 border-none shadow-none bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">{agent.name}</h2>
              <div className="flex gap-2 items-center">
                {agent.role && (
                  <p className="text-muted-foreground flex-1">{agent.role}</p>
                )}
                {agent.status && (
                  <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                    {agent.status}
                  </Badge>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                disabled={isSaving}
              >
                <X size={16} />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                disabled={isSaving || !editFormData.name.trim()}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save
              </Button>
            </>
          ) : (
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
            >
              <Edit size={16} />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Overview Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-foreground mb-1 text-sm">Description</h4>
              {isEditMode ? (
                <Textarea
                  value={editFormData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="text-sm"
                  placeholder="Agent description"
                  rows={2}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {agent.description || 'No description provided'}
                </p>
              )}
            </div>
            
            <div>
              <h4 className="font-medium text-foreground mb-1 text-sm">Persona</h4>
              {isEditMode ? (
                <Textarea
                  value={editFormData.persona}
                  onChange={(e) => handleInputChange('persona', e.target.value)}
                  className="text-sm"
                  placeholder="Agent persona and communication style"
                  rows={2}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {agent.persona || 'No persona defined'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Configuration Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">AI Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-3">
          <div className="space-y-2">
            <h4 className="font-medium text-foreground mb-1 text-sm">Default Model</h4>
            {isEditMode ? (
              <div className="space-y-2">
                <ModelSelector
                  value={editFormData.defaultModel}
                  onChange={(model) => handleInputChange('defaultModel', model)}
                  organizationTier="free"
                  showInherit={true}
                  inheritLabel="Inherit from organization"
                  inheritFromModel="IBM Granite 3.3 8B"
                />
                <p className="text-xs text-muted-foreground">
                  Set the default AI model for this agent. Skills can override this setting.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {agent.defaultModel || 'Inherits from organization (IBM Granite 3.3 8B)'}
                </p>
                {!agent.defaultModel && (
                  <p className="text-xs text-muted-foreground">
                    Using organization default model
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trigger Configuration Section - Collapsible */}
      <Collapsible open={isTriggerConfigOpen} onOpenChange={setIsTriggerConfigOpen}>
        <div className="border rounded-lg">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between h-auto p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span className="font-medium text-sm">Trigger Configuration</span>
              </div>
              {isTriggerConfigOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-3">
              {!isEditMode ? (
                // Display mode
                <div className="space-y-2">
                  <div>
                    <h4 className="font-medium text-foreground mb-1 text-sm">Trigger Type</h4>
                    <Badge variant="outline" className="text-xs">
                      {agent.schedules?.[0] ? getTriggerTypeLabel(agent.schedules[0].trigger.type) : 'Manual Execution'}
                    </Badge>
                  </div>

                  {agent.schedules?.[0] && agent.schedules[0].trigger.type === 'CALENDAR' && (
                    <div className="space-y-2">
                      {agent.schedules[0].trigger.rrule && (
                        <div>
                          <h5 className="font-medium text-sm mb-1">Schedule</h5>
                          <Badge variant="outline" className="text-xs font-mono">
                            {agent.schedules[0].trigger.rrule}
                          </Badge>
                        </div>
                      )}
                      {agent.schedules[0].trigger.timezone && (
                        <div>
                          <h5 className="font-medium text-sm mb-1">Timezone</h5>
                          <Badge variant="secondary" className="text-xs">
                            {agent.schedules[0].trigger.timezone}
                          </Badge>
                        </div>
                      )}
                      {agent.schedules[0].trigger.startDate && (
                        <div>
                          <h5 className="font-medium text-sm mb-1">Start Date</h5>
                          <p className="text-xs text-muted-foreground">
                            {new Date(agent.schedules[0].trigger.startDate).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {agent.schedules?.[0] && agent.schedules[0].trigger.type === 'DATABASE_EVENT' && (
                    <div className="space-y-2">
                      {agent.schedules[0].trigger.tableId && (
                        <div>
                          <h5 className="font-medium text-sm mb-1">Table</h5>
                          <Badge variant="outline" className="text-xs">
                            Table: {agent.schedules[0].trigger.tableId}
                          </Badge>
                        </div>
                      )}
                      <div>
                        <h5 className="font-medium text-sm mb-1">Operations</h5>
                        <div className="flex gap-1">
                          {agent.schedules[0].trigger.operations?.map((op: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {op}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}


                  {agent.schedules?.[0] && agent.schedules[0].trigger.type === 'WEBHOOK' && (
                    <div className="space-y-2">
                      <div>
                        <h5 className="font-medium text-sm mb-1">Webhook URL</h5>
                        <div className="bg-muted p-2 rounded text-xs font-mono break-all">
                          {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/agents/${agent.id}/trigger`}
                        </div>
                      </div>
                      {agent.schedules[0].trigger.allowedOrigins && agent.schedules[0].trigger.allowedOrigins.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm mb-1">Allowed Origins</h5>
                          <div className="flex flex-wrap gap-1">
                            {agent.schedules[0].trigger.allowedOrigins.map((origin: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {origin}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <h5 className="font-medium text-sm mb-1">Security</h5>
                        <div className="flex gap-2">
                          <Badge variant={agent.schedules[0].trigger.requiresSignature ? 'default' : 'secondary'} className="text-xs">
                            {agent.schedules[0].trigger.requiresSignature ? 'Signature Required' : 'No Signature'}
                          </Badge>
                          {agent.schedules[0].trigger.webhookSecret && (
                            <Badge variant="outline" className="text-xs">
                              Secret Configured
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Edit mode
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-foreground mb-2 text-sm">Trigger Type</h4>
                    <Select value={editFormData.schedules?.[0]?.type || 'MANUAL'} onValueChange={handleTriggerTypeChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANUAL">Manual Execution</SelectItem>
                        <SelectItem value="CALENDAR">Scheduled/Calendar</SelectItem>
                        <SelectItem value="DATABASE_EVENT">Database Changes</SelectItem>
                        <SelectItem value="WEBHOOK">Webhook Trigger</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trigger Type Specific Configuration */}
                  {editFormData.schedules?.[0]?.type === 'MANUAL' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Agent will execute only when manually triggered by users.
                      </p>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h5 className="font-medium text-sm mb-1 text-green-900">Manual Execution</h5>
                        <p className="text-xs text-green-700">
                          This agent can be triggered from the agent dashboard, via API calls, or when referenced in chat.
                        </p>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-1">Execution Context</h5>
                        <Input
                          value={editFormData.schedules?.[0]?.description || ''}
                          onChange={(e) => handleTriggerConfigChange({ description: e.target.value })}
                          placeholder="Optional: Describe when this agent should be triggered"
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Helps users understand when to trigger this agent manually
                        </p>
                      </div>
                    </div>
                  )}

                  {editFormData.schedules?.[0]?.type === 'CALENDAR' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Configure recurring schedules using the calendar interface.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <h5 className="font-medium text-sm mb-1">Timezone</h5>
                          <Input
                            value={isCalendarTrigger(editFormData.schedules?.[0]) ? editFormData.schedules?.[0]?.timezone || '' : ''}
                            onChange={(e) => handleTriggerConfigChange({ timezone: e.target.value })}
                            placeholder="UTC"
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            e.g., America/New_York, UTC, Europe/London
                          </p>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-1">Start Date</h5>
                          <Input
                            type="datetime-local"
                            value={isCalendarTrigger(editFormData.schedules?.[0]) && editFormData.schedules?.[0]?.startDate
                              ? new Date(editFormData.schedules[0].startDate).toISOString().slice(0, 16)
                              : ''
                            }
                            onChange={(e) => {
                              const startDate = e.target.value ? new Date(e.target.value) : undefined;
                              handleTriggerConfigChange({ startDate });
                            }}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-2">Schedule Configuration</h5>
                        <ScheduleManager
                          initialRRule={getCalendarRRule(editFormData.schedules?.[0])}
                          onScheduleChange={(rrule) => {
                            handleTriggerConfigChange({ rrule });
                          }}
                          isCreationMode={false}
                        />
                      </div>
                    </div>
                  )}

                  {editFormData.schedules?.[0]?.type === 'DATABASE_EVENT' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Trigger agent execution when database changes occur.
                      </p>

                      <div>
                        <h5 className="font-medium text-sm mb-2">Table Selection</h5>
                        <TableSelector
                          value={getDatabaseEventTableId(editFormData.schedules?.[0])}
                          onValueChange={(tableId) => {
                            handleTriggerConfigChange({ tableId });
                          }}
                          placeholder="Select table to monitor..."
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Select a specific table to monitor, or leave unselected to monitor all tables
                        </p>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-1">Operations</h5>
                        <div className="flex gap-2 text-xs">
                          {['INSERT', 'UPDATE', 'DELETE'].map((op) => (
                            <label key={op} className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={getDatabaseEventOperations(editFormData.schedules?.[0]).includes(op as 'INSERT' | 'UPDATE' | 'DELETE')}
                                onChange={(e) => {
                                  const current = getDatabaseEventOperations(editFormData.schedules?.[0]);
                                  const newOps = e.target.checked
                                    ? [...current, op as 'INSERT' | 'UPDATE' | 'DELETE']
                                    : current.filter((o) => o !== op);
                                  handleTriggerConfigChange({ operations: newOps });
                                }}
                              />
                              <span>{op}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}


                  {editFormData.schedules?.[0]?.type === 'WEBHOOK' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Trigger agent execution via webhook HTTP calls.
                      </p>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h5 className="font-medium text-sm mb-1 text-blue-900">Webhook URL</h5>
                        <div className="font-mono text-xs text-blue-800 bg-blue-100 p-2 rounded border break-all">
                          {`${window.location.origin}/api/webhooks/agents/${agent.id}/trigger`}
                        </div>
                        <p className="text-xs text-blue-700 mt-1">
                          Use this URL to trigger the agent externally
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div>
                          <h5 className="font-medium text-sm mb-1">Webhook Secret</h5>
                          <Input
                            type="password"
                            value={getWebhookSecret(editFormData.schedules?.[0]) || ''}
                            onChange={(e) => handleTriggerConfigChange({ webhookSecret: e.target.value })}
                            placeholder="Optional security secret"
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Used for request validation. Include in X-Webhook-Secret header.
                          </p>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-1">Allowed Origins</h5>
                          <Input
                            value={isWebhookTrigger(editFormData.schedules?.[0]) ? editFormData.schedules?.[0]?.allowedOrigins?.join(', ') || '' : ''}
                            onChange={(e) => {
                              const origins = e.target.value.split(',').map(o => o.trim()).filter(o => o);
                              handleTriggerConfigChange({ allowedOrigins: origins.length > 0 ? origins : undefined });
                            }}
                            placeholder="https://example.com, https://app.com"
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Comma-separated list of allowed origins. Leave empty to allow all.
                          </p>
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={getWebhookRequiresSignature(editFormData.schedules?.[0])}
                            onChange={(e) => handleTriggerConfigChange({ requiresSignature: e.target.checked })}
                          />
                          <span>Require HMAC signature verification</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Recent Activity Section - Collapsible */}
      <Collapsible open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <div className="border rounded-lg">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between h-auto p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Activity size={16} />
                <span className="font-medium text-sm">Recent Activity</span>
              </div>
              {isActivityOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3">
              <AgentActivityPanel agent={agent} />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
