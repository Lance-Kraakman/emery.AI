'use client';

import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Save, X, Loader2, Plus, Trash2, ChevronDown, ChevronRight, Cog, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { createAgentFromClient } from '@/app/actions/agents';
import type { CreateAgentClientData } from '@/app/actions/types';
import { TriggerConfigs, type TriggerConfig, type TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { type ToolConfig, type ServerConfig } from '@/ddd/domain/agents/entities/agent';
import CapabilityManager from './CapabilityManager';
import ScheduleManager from './ScheduleManager';
import { getCalendarRRule, getDatabaseEventOperations, getWebhookSecret, getWebhookRequiresSignature } from './trigger-utils';

// AIDEV-NOTE: Agent create view using the same inline edit pattern as AgentDetailsView
// Uses proper DTOs for consistency with the rest of the application

interface AgentCreateViewProps {
  onCancel: () => void;
  onCreated?: () => void;
}

// Use the existing DTO type for consistency
type CreateFormData = CreateAgentClientData;

export default function AgentCreateView({ onCancel, onCreated }: AgentCreateViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Collapsible section states
  const [isCapabilitiesOpen, setIsCapabilitiesOpen] = useState(false);
  const [isTriggerConfigOpen, setIsTriggerConfigOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: '',
      role: '',
      description: '',
      persona: '',
      status: 'active',
      tools: [],
      servers: [],
      capabilities: [],
      trigger: TriggerConfigs.manual(),
      organizationId: undefined,
      roleId: undefined
    } as CreateFormData,
    onSubmit: async ({ value }: { value: CreateFormData }) => {
      try {
        setIsSaving(true);
        setError(null);
        
        const result = await createAgentFromClient({
          name: value.name.trim(),
          role: value.role?.trim(),
          description: value.description?.trim(),
          persona: value.persona?.trim(),
          status: value.status,
          tools: value.tools || [],
          servers: value.servers || [],
          capabilities: value.capabilities || [],
          trigger: value.trigger,
          organizationId: value.organizationId,
          roleId: value.roleId
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to create agent');
        }
        
        onCreated?.();
        onCancel(); // Close create view after successful creation
        
      } catch (error) {
        console.error('Error creating agent:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while creating the agent');
      } finally {
        setIsSaving(false);
      }
    },
  });

  const handleSave = form.handleSubmit;

  // Helper functions for managing tools and servers
  const addTool = () => {
    const newTool: ToolConfig = { name: '', version: undefined, config: undefined };
    form.setFieldValue('tools', [...(form.getFieldValue('tools') || []), newTool]);
  };

  const removeTool = (index: number) => {
    const tools = form.getFieldValue('tools') || [];
    form.setFieldValue('tools', tools.filter((_, i) => i !== index));
  };

  const updateTool = (index: number, field: keyof ToolConfig, value: string) => {
    const tools = form.getFieldValue('tools') || [];
    const updatedTools = tools.map((tool, i) => 
      i === index 
        ? { ...tool, [field]: value || undefined }
        : tool
    );
    form.setFieldValue('tools', updatedTools);
  };

  const addServer = () => {
    const newServer: ServerConfig = { name: '', endpoint: undefined, config: undefined };
    form.setFieldValue('servers', [...(form.getFieldValue('servers') || []), newServer]);
  };

  const removeServer = (index: number) => {
    const servers = form.getFieldValue('servers') || [];
    form.setFieldValue('servers', servers.filter((_, i) => i !== index));
  };

  const updateServer = (index: number, field: keyof ServerConfig, value: string) => {
    const servers = form.getFieldValue('servers') || [];
    const updatedServers = servers.map((server, i) => 
      i === index 
        ? { ...server, [field]: value || undefined }
        : server
    );
    form.setFieldValue('servers', updatedServers);
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
    
    form.setFieldValue('trigger', newTrigger);
  };

  const handleTriggerConfigChange = (config: Partial<TriggerConfig>) => {
    const currentTrigger = form.getFieldValue('trigger');
    form.setFieldValue('trigger', { ...currentTrigger, ...config } as TriggerConfig);
  };

  return (
    <div className="space-y-3 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-start sticky top-0 bg-background z-10 pb-2">
        <div className="flex-1 mr-4">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => !value ? 'Agent name is required' : undefined
            }}
          >
            {(field) => (
              <Input
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="text-2xl font-bold h-auto p-2 border-none shadow-none bg-transparent mb-2 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
                placeholder="Agent name"
                autoFocus
              />
            )}
          </form.Field>
          <div className="flex gap-2">
            <form.Field name="role">
              {(field) => (
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="text-muted-foreground h-auto p-2 border-none shadow-none bg-transparent flex-1 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
                  placeholder="Role"
                />
              )}
            </form.Field>
            <form.Field name="status">
              {(field) => (
                <Select value={field.state.value} onValueChange={field.handleChange}>
                  <SelectTrigger className="w-32 h-auto p-2 border-none shadow-none bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </form.Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onCancel}
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
            disabled={isSaving || !form.state.canSubmit}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Create Agent
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Overview Section */}
      <Card className={form.state.canSubmit ? 'ring-2 ring-primary/20' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-foreground mb-1 text-sm">Description</h4>
              <Textarea
                value={form.getFieldValue('description')}
                onChange={(e) => form.setFieldValue('description', e.target.value)}
                className="text-sm"
                placeholder="Agent description"
                rows={2}
              />
            </div>
            
            <div>
              <h4 className="font-medium text-foreground mb-1 text-sm">Persona</h4>
              <Textarea
                value={form.getFieldValue('persona')}
                onChange={(e) => form.setFieldValue('persona', e.target.value)}
                className="text-sm"
                placeholder="Agent persona and communication style"
                rows={2}
              />
            </div>
          </div>
          
          {/* Tools & Servers in a grid */}
          <div className="grid gap-3 md:grid-cols-2 mt-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-foreground text-sm">Tools</h4>
                <Button
                  type="button"
                  onClick={addTool}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  <Plus size={12} className="mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.getFieldValue('tools')?.map((tool, index) => (
                  <div key={index} className="space-y-1 p-2 border rounded-md bg-muted/20">
                    <div className="flex gap-2">
                      <Input
                        value={tool.name}
                        onChange={(e) => updateTool(index, 'name', e.target.value)}
                        placeholder="Tool name"
                        className="text-sm flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => removeTool(index)}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={tool.version || ''}
                        onChange={(e) => updateTool(index, 'version', e.target.value)}
                        placeholder="Version (optional)"
                        className="text-xs flex-1"
                      />
                    </div>
                  </div>
                )) || []}
                {(!form.getFieldValue('tools') || form.getFieldValue('tools')?.length === 0) && (
                  <p className="text-sm text-muted-foreground">No tools configured</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-foreground text-sm">Servers</h4>
                <Button
                  type="button"
                  onClick={addServer}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  <Plus size={12} className="mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.getFieldValue('servers')?.map((server, index) => (
                  <div key={index} className="space-y-1 p-2 border rounded-md bg-muted/20">
                    <div className="flex gap-2">
                      <Input
                        value={server.name}
                        onChange={(e) => updateServer(index, 'name', e.target.value)}
                        placeholder="Server name"
                        className="text-sm flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => removeServer(index)}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={server.endpoint || ''}
                        onChange={(e) => updateServer(index, 'endpoint', e.target.value)}
                        placeholder="Endpoint (optional)"
                        className="text-xs flex-1"
                      />
                    </div>
                  </div>
                )) || []}
                {(!form.getFieldValue('servers') || form.getFieldValue('servers')?.length === 0) && (
                  <p className="text-sm text-muted-foreground">No servers configured</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities Section - Collapsible */}
      <Collapsible open={isCapabilitiesOpen} onOpenChange={setIsCapabilitiesOpen}>
        <div className="border rounded-lg">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between h-auto p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Cog size={16} />
                <span className="font-medium text-sm">Capabilities</span>
              </div>
              {isCapabilitiesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3">
              <CapabilityManager 
                capabilities={form.getFieldValue('capabilities') || []}
                isEditable={true}
                onCapabilitiesChange={(capabilities) => {
                  form.setFieldValue('capabilities', capabilities);
                }}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

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
              <div>
                <h4 className="font-medium text-foreground mb-2 text-sm">Trigger Type</h4>
                <Select value={form.getFieldValue('trigger')?.type || 'MANUAL'} onValueChange={handleTriggerTypeChange}>
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
              {form.getFieldValue('trigger')?.type === 'MANUAL' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Agent will execute only when manually triggered by users.
                  </p>
                </div>
              )}

              {form.getFieldValue('trigger')?.type === 'CALENDAR' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Configure recurring schedules using the calendar interface.
                  </p>
                  <ScheduleManager 
                    initialRRule={getCalendarRRule(form.getFieldValue('trigger') || TriggerConfigs.manual())}
                    onScheduleChange={(rrule) => {
                      handleTriggerConfigChange({ rrule });
                    }}
                    isCreationMode={true}
                  />
                </div>
              )}

              {form.getFieldValue('trigger')?.type === 'DATABASE_EVENT' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Trigger agent execution when database changes occur.
                  </p>
                  <div>
                    <h5 className="font-medium text-sm mb-1">Operations</h5>
                    <div className="flex gap-2 text-xs">
                      {['INSERT', 'UPDATE', 'DELETE'].map((op) => (
                        <label key={op} className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={(form.getFieldValue('trigger') as any)?.operations?.includes(op) || false}
                            onChange={(e) => {
                              const current = (form.getFieldValue('trigger') as any)?.operations || [];
                              const newOps = e.target.checked 
                                ? [...current, op]
                                : current.filter((o: string) => o !== op);
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


              {form.getFieldValue('trigger')?.type === 'WEBHOOK' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Trigger agent execution via webhook HTTP calls.
                  </p>
                  <div className="grid gap-2">
                    <div>
                      <h5 className="font-medium text-sm mb-1">Webhook Secret</h5>
                      <Input
                        type="password"
                        value={(form.getFieldValue('trigger') as any)?.webhookSecret || ''}
                        onChange={(e) => handleTriggerConfigChange({ webhookSecret: e.target.value })}
                        placeholder="Optional security secret"
                        className="text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input 
                        type="checkbox" 
                        checked={(form.getFieldValue('trigger') as any)?.requiresSignature || false}
                        onChange={(e) => handleTriggerConfigChange({ requiresSignature: e.target.checked })}
                      />
                      <span>Require HMAC signature verification</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}