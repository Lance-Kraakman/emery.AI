'use client';

import React, { useState, useEffect } from 'react';
import { Edit, ChevronDown, ChevronRight, Activity, Cog, Save, X, Loader2, Calendar, Plus, Trash2 } from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { TriggerConfigs, type TriggerConfig, type TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type { ServerConfig } from '@/ddd/domain/agents/entities/agent';
import { discoverTools, createToolConfigFromMetadata, type ToolMetadataDTO } from '@/app/actions/tool-registry';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateAgentFromClient } from '@/app/actions/agents';
import CapabilityManager from './CapabilityManager';
import AgentActivityPanel from './AgentActivityPanel';
import ScheduleManager from './ScheduleManager';
import { 
  isCalendarTrigger, 
  isDatabaseEventTrigger, 
  isWebhookTrigger,
  getCalendarRRule,
  getDatabaseEventOperations,
  getWebhookSecret,
  getWebhookRequiresSignature,
  getTriggerTypeLabel
} from './trigger-utils';

// AIDEV-NOTE: Agent details view with inline editing functionality

interface AgentDetailsViewProps {
  agent: AgentDTO;
  onEdit: () => void;
  onUpdate?: () => void;
}

interface EditFormData {
  name: string;
  role: string;
  description: string;
  persona: string;
  status: string;
  trigger: TriggerConfig;
  tools: ToolConfig[];
  servers: ServerConfig[];
}

export default function AgentDetailsView({ agent, onEdit, onUpdate }: AgentDetailsViewProps) {
  const [isCapabilitiesOpen, setIsCapabilitiesOpen] = useState(false);
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
    trigger: agent.trigger || TriggerConfigs.manual(),
    tools: (agent.tools as ToolConfig[]) || [],
    servers: (agent.servers as ServerConfig[]) || []
  });

  const handleEdit = () => {
    setIsEditMode(true);
    setEditFormData({
      name: agent.name || '',
      role: agent.role || '',
      description: agent.description || '',
      persona: agent.persona || '',
      status: agent.status || 'active',
      trigger: agent.trigger || TriggerConfigs.manual(),
      tools: (agent.tools as ToolConfig[]) || [],
      servers: (agent.servers as ServerConfig[]) || []
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
      trigger: agent.trigger || TriggerConfigs.manual(),
      tools: (agent.tools as ToolConfig[]) || [],
      servers: (agent.servers as ServerConfig[]) || []
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const updatedAgent = {
        ...agent,
        name: editFormData.name.trim(),
        role: editFormData.role.trim(),
        description: editFormData.description.trim(),
        persona: editFormData.persona.trim(),
        status: editFormData.status
      };

      const result = await updateAgentFromClient(agent.id, {
        name: editFormData.name.trim(),
        role: editFormData.role.trim(),
        description: editFormData.description.trim(),
        persona: editFormData.persona.trim(),
        status: editFormData.status,
        trigger: editFormData.trigger,
        tools: editFormData.tools,
        servers: editFormData.servers
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update agent');
      }
      
      setIsEditMode(false);
      onUpdate?.();
      
    } catch (error) {
      console.error('Error updating agent:', error);
      // Simple alert for now - could be replaced with a toast system later
      alert(error instanceof Error ? error.message : 'An error occurred while updating the agent');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
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
    
    setEditFormData(prev => ({ ...prev, trigger: newTrigger }));
  };

  const handleTriggerConfigChange = (config: Partial<TriggerConfig>) => {
    setEditFormData(prev => {
      // Type-safe trigger config update that preserves discriminated union
      let updatedTrigger: TriggerConfig;
      
      if (config.type && config.type !== prev.trigger.type) {
        // If changing trigger type, use factory function to create new trigger
        switch (config.type) {
          case 'MANUAL':
            updatedTrigger = TriggerConfigs.manual(config.enabled, config.description);
            break;
          case 'CALENDAR':
            updatedTrigger = TriggerConfigs.calendar('FREQ=DAILY;INTERVAL=1', {
              enabled: config.enabled,
              description: config.description
            });
            break;
          case 'DATABASE_EVENT':
            updatedTrigger = TriggerConfigs.databaseEvent(['INSERT', 'UPDATE'], {
              enabled: config.enabled,
              description: config.description
            });
            break;
          case 'WEBHOOK':
            updatedTrigger = TriggerConfigs.webhook({
              enabled: config.enabled,
              description: config.description
            });
            break;
          default:
            updatedTrigger = prev.trigger;
        }
      } else {
        // Same type, create new instance with updated values
        const currentTrigger = prev.trigger;
        
        if (currentTrigger instanceof TriggerConfigs.manual().constructor) {
          updatedTrigger = TriggerConfigs.manual(
            config.enabled !== undefined ? config.enabled : currentTrigger.enabled,
            config.description !== undefined ? config.description : currentTrigger.description
          );
        } else if (currentTrigger instanceof TriggerConfigs.calendar('FREQ=DAILY').constructor) {
          const current = currentTrigger as any;
          updatedTrigger = TriggerConfigs.calendar(current.rrule, {
            timezone: current.timezone,
            startDate: current.startDate,
            endDate: current.endDate,
            enabled: config.enabled !== undefined ? config.enabled : current.enabled,
            description: config.description !== undefined ? config.description : current.description
          });
        } else if (currentTrigger instanceof TriggerConfigs.databaseEvent(['INSERT']).constructor) {
          const current = currentTrigger as any;
          updatedTrigger = TriggerConfigs.databaseEvent(current.operations, {
            tableId: current.tableId,
            conditions: current.conditions,
            enabled: config.enabled !== undefined ? config.enabled : current.enabled,
            description: config.description !== undefined ? config.description : current.description
          });
        } else if (currentTrigger instanceof TriggerConfigs.webhook().constructor) {
          const current = currentTrigger as any;
          updatedTrigger = TriggerConfigs.webhook({
            webhookSecret: current.webhookSecret,
            allowedOrigins: current.allowedOrigins,
            requiresSignature: current.requiresSignature,
            enabled: config.enabled !== undefined ? config.enabled : current.enabled,
            description: config.description !== undefined ? config.description : current.description
          });
        } else {
          updatedTrigger = currentTrigger;
        }
      }
      
      return { ...prev, trigger: updatedTrigger };
    });
  };

  // Tool management functions
  const [availableTools, setAvailableTools] = useState<ToolMetadataDTO[]>([]);
  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);

  useEffect(() => {
    const loadAvailableTools = async () => {
      const result = await discoverTools({});
      if (result.success && result.data) {
        setAvailableTools(result.data.tools);
      }
    };
    loadAvailableTools();
  }, []);

  const addToolFromRegistry = async (toolMetadata: ToolMetadataDTO) => {
    const result = await createToolConfigFromMetadata(toolMetadata.name);
    if (result.success && result.data) {
      const newTool = ToolConfig.create(result.data.name, result.data.version, result.data.config);
      setEditFormData(prev => ({
        ...prev,
        tools: [...prev.tools, newTool]
      }));
    }
    setIsToolSelectorOpen(false);
  };

  const removeTool = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      tools: prev.tools.filter((_, i) => i !== index)
    }));
  };

  // Server management functions
  const addServer = () => {
    const newServer: ServerConfig = { name: '', endpoint: undefined, config: undefined };
    setEditFormData(prev => ({
      ...prev,
      servers: [...prev.servers, newServer]
    }));
  };

  const removeServer = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      servers: prev.servers.filter((_, i) => i !== index)
    }));
  };

  const updateServer = (index: number, field: keyof ServerConfig, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      servers: prev.servers.map((server, i) => 
        i === index 
          ? { ...server, [field]: value || undefined }
          : server
      )
    }));
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
          
          {/* Tools & Servers in a grid */}
          <div className="grid gap-3 md:grid-cols-2 mt-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-foreground text-sm">Tools</h4>
                {isEditMode && (
                  <Button
                    type="button"
                    onClick={() => setIsToolSelectorOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                  >
                    <Plus size={12} className="mr-1" />
                    Add Tool
                  </Button>
                )}
              </div>
              {isEditMode ? (
                <div className="space-y-2">
                  {editFormData.tools?.map((tool, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/20">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{tool.name}</div>
                        <div className="text-xs text-muted-foreground">v{tool.version}</div>
                      </div>
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
                  ))}
                  {editFormData.tools.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tools configured</p>
                  )}
                </div>
              ) : (
                agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0 ? (
                  <div className="space-y-1">
                    {agent.tools.slice(0, 3).map((tool: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-xs py-0">
                          {typeof tool === 'string' ? tool : tool.name || 'Unknown'}
                        </Badge>
                        {typeof tool === 'object' && tool.version && (
                          <span className="text-muted-foreground">v{tool.version}</span>
                        )}
                      </div>
                    ))}
                    {agent.tools.length > 3 && (
                      <Badge variant="secondary" className="text-xs py-0">
                        +{agent.tools.length - 3} more
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No tools configured</p>
                )
              )}
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-foreground text-sm">Servers</h4>
                {isEditMode && (
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
                )}
              </div>
              {isEditMode ? (
                <div className="space-y-2">
                  {editFormData.servers?.map((server, index) => (
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
                  ))}
                  {editFormData.servers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No servers configured</p>
                  )}
                </div>
              ) : (
                agent.servers && Array.isArray(agent.servers) && agent.servers.length > 0 ? (
                  <div className="space-y-1">
                    {agent.servers.slice(0, 3).map((server: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-xs py-0">
                          {typeof server === 'string' ? server : server.name || 'Unknown'}
                        </Badge>
                        {typeof server === 'object' && server.endpoint && (
                          <span className="text-muted-foreground">{server.endpoint}</span>
                        )}
                      </div>
                    ))}
                    {agent.servers.length > 3 && (
                      <Badge variant="secondary" className="text-xs py-0">
                        +{agent.servers.length - 3} more
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No servers configured</p>
                )
              )}
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
                agent={agent} 
                isEditable={isEditMode}
                onCapabilitiesChange={(capabilities) => {
                  // TODO: Handle capability updates - could trigger agent update
                  console.log('Capabilities updated:', capabilities);
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
              {!isEditMode ? (
                // Display mode
                <div className="space-y-2">
                  <div>
                    <h4 className="font-medium text-foreground mb-1 text-sm">Trigger Type</h4>
                    <Badge variant="outline" className="text-xs">
                      {agent.trigger ? getTriggerTypeLabel(agent.trigger.type) : 'Manual Execution'}
                    </Badge>
                  </div>
                  
                  {agent.trigger && isCalendarTrigger(agent.trigger) && agent.trigger.rrule && (
                    <div>
                      <h5 className="font-medium text-sm mb-1">Schedule</h5>
                      <p className="text-xs text-muted-foreground">
                        {agent.trigger.rrule}
                      </p>
                    </div>
                  )}
                  
                  {agent.trigger && isDatabaseEventTrigger(agent.trigger) && (
                    <div>
                      <h5 className="font-medium text-sm mb-1">Operations</h5>
                      <div className="flex gap-1">
                        {agent.trigger.operations.map((op, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {op}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  
                  {agent.trigger && isWebhookTrigger(agent.trigger) && (
                    <div className="space-y-1">
                      <div>
                        <h5 className="font-medium text-sm mb-1">Security</h5>
                        <Badge variant={agent.trigger.requiresSignature ? 'success' : 'secondary'} className="text-xs">
                          {agent.trigger.requiresSignature ? 'Signature Required' : 'No Signature'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Edit mode
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-foreground mb-2 text-sm">Trigger Type</h4>
                    <Select value={editFormData.trigger?.type || 'MANUAL'} onValueChange={handleTriggerTypeChange}>
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
                  {editFormData.trigger?.type === 'MANUAL' && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Agent will execute only when manually triggered by users.
                      </p>
                    </div>
                  )}

                  {editFormData.trigger?.type === 'CALENDAR' && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Configure recurring schedules using the calendar interface.
                      </p>
                      <ScheduleManager 
                        initialRRule={getCalendarRRule(editFormData.trigger)}
                        onScheduleChange={(rrule) => {
                          handleTriggerConfigChange({ rrule });
                        }}
                        isCreationMode={false}
                      />
                    </div>
                  )}

                  {editFormData.trigger?.type === 'DATABASE_EVENT' && (
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
                                checked={getDatabaseEventOperations(editFormData.trigger).includes(op as 'INSERT' | 'UPDATE' | 'DELETE')}
                                onChange={(e) => {
                                  const current = getDatabaseEventOperations(editFormData.trigger);
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


                  {editFormData.trigger?.type === 'WEBHOOK' && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Trigger agent execution via webhook HTTP calls.
                      </p>
                      <div className="grid gap-2">
                        <div>
                          <h5 className="font-medium text-sm mb-1">Webhook Secret</h5>
                          <Input
                            type="password"
                            value={getWebhookSecret(editFormData.trigger) || ''}
                            onChange={(e) => handleTriggerConfigChange({ webhookSecret: e.target.value })}
                            placeholder="Optional security secret"
                            className="text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs">
                          <input 
                            type="checkbox" 
                            checked={getWebhookRequiresSignature(editFormData.trigger)}
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

      {/* Tool Selector Modal */}
      <Dialog open={isToolSelectorOpen} onOpenChange={setIsToolSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Tool</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-2">
              {availableTools.map((tool) => (
                <div
                  key={tool.name}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => addToolFromRegistry(tool)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{tool.displayName}</div>
                      <div className="text-xs text-muted-foreground mt-1">{tool.description}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">{tool.category}</Badge>
                        {tool.requiresConnection && (
                          <Badge variant="secondary" className="text-xs">Requires Connection</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {availableTools.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No tools available
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
