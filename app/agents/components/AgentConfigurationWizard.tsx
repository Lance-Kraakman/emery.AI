'use client';

import { useState, useEffect } from 'react';
import { Agent } from '@/types/db';
import { createAgent, updateAgent } from '@/app/actions/agents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Check, ExternalLink, Zap, Code, Database, MessageSquare, Globe, FileText, Brain, Settings } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Capability } from './CapabilityEditor';
import ScheduleManager from './ScheduleManager';

const CapabilityEditor = dynamic(() => import('./CapabilityEditor'), { ssr: false });

const generateUniqueId = (prefix: string) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

import {
  PREDEFINED_TOOLS,
  PREDEFINED_TRIGGERS,
  getToolsByCategory,
  getToolCategories,
  type ToolDefinition,
  type TriggerDefinition
} from '@/lib/agents/tools-registry';

// AIDEV-NOTE: Enhanced agent configuration wizard with OAuth-aware tool selection

interface AgentConfigurationWizardProps {
  onClose: () => void;
  agent?: Agent | null;
  onSuccess?: () => void;
}


const getCategoryIcon = (category: string) => {
  const icons = {
    data: Database,
    communication: MessageSquare,
    code: Code,
    analysis: Brain,
    web: Globe,
    file: FileText,
    ai: Brain,
    system: Settings
  };
  return icons[category as keyof typeof icons] || Settings;
};

export default function AgentConfigurationWizard({ 
  onClose, 
  agent,
  onSuccess 
}: AgentConfigurationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Form data
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    role: agent?.role || '',
    description: agent?.description || '',
    persona: agent?.persona || '',
    selectedTools: [] as string[],
    triggerType: 'MANUAL' as string,
    triggerConfig: {} as Record<string, any>,
    taskDefinition: {
      name: '',
      capabilityName: '',
      description: '',
      payload: {} as Record<string, any>
    },
    capabilities: (agent?.capabilities as Capability[]) || [],
  });

  useEffect(() => {
    const initialCapabilities = (agent?.capabilities as Capability[]) || [];
    
    if (agent) {
      // Extract trigger config and task definition from agent
      const trigger = agent.trigger as any;
      const triggerType = trigger?.type || 'MANUAL';
      const triggerConfig = trigger ? { ...trigger } : {};
      delete triggerConfig.type;
      delete triggerConfig.taskDefinition;
      
      const taskDefinition = trigger?.taskDefinition || {
        name: '',
        capabilityName: '',
        description: '',
        payload: {}
      };

      setFormData({
        name: agent.name || '',
        role: agent.role || '',
        description: agent.description || '',
        persona: agent.persona || '',
        selectedTools: [] as string[],
        triggerType,
        triggerConfig,
        taskDefinition,
        capabilities: initialCapabilities.map(cap => ({
          ...cap,
          id: cap.id || generateUniqueId('cap'),
          steps: cap.steps ? cap.steps.map(step => ({
            ...step,
            id: step.id || generateUniqueId('step'),
          })) : [],
        })),
      });
    } else {
      // Reset form for new agent
      setFormData({
        name: '',
        role: '',
        description: '',
        persona: '',
        selectedTools: [] as string[],
        triggerType: 'MANUAL' as string,
        triggerConfig: {} as Record<string, any>,
        taskDefinition: {
          name: '',
          capabilityName: '',
          description: '',
          payload: {} as Record<string, any>
        },
        capabilities: [],
      });
    }
  }, [agent]);


  const handleToolToggle = (toolName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(toolName)
        ? prev.selectedTools.filter(t => t !== toolName)
        : [...prev.selectedTools, toolName]
    }));
  };

  const handleSubmit = async () => {
    try {
      setIsPending(true);
      setError(null);

      // Create tools config
      const tools = formData.selectedTools.map(toolName => ({ name: toolName }));
      
      // Create basic capability if none specified
      let capabilities = formData.capabilities;
      if (capabilities.length === 0) {
        const selectedToolDefinitions = formData.selectedTools.map(toolName => 
          PREDEFINED_TOOLS.find(t => t.name === toolName)
        ).filter(t => t) as ToolDefinition[];

        capabilities = [{
          id: 'cap_1',
          name: 'default_capability',
          description: 'Default capability for this agent',
          steps: [{
            id: 'step_1',
            type: 'TOOL_STEP' as const,
            instructions: formData.description || 'Execute the selected tools as needed',
            tools: selectedToolDefinitions
          }]
        }];
      }

      // Create trigger config
      const trigger = {
        type: formData.triggerType as 'MANUAL' | 'CRON' | 'WEBHOOK' | 'DATABASE_EVENT',
        ...formData.triggerConfig,
        // Include task definition for non-manual triggers
        ...(formData.triggerType !== 'MANUAL' && {
          taskDefinition: formData.taskDefinition
        })
      };

      const agentData = {
        name: formData.name,
        role: formData.role,
        description: formData.description,
        persona: formData.persona,
        tools,
        trigger,
        capabilities,
        status: 'active' as const
      };

      let result;
      if (agent) {
        result = await updateAgent(agent.id, agentData);
      } else {
        result = await createAgent(agentData);
      }

      if (result.success) {
        // Show integration test configuration
        if (result.data?.id && result.data?.apiKey) {
          const userId = '550e8400-e29b-41d4-a716-446655440000'; // Development test user
          const orgId = 1; // Default org
          
          const configMessage = `
📋 Integration Test Configuration:
const USER_ACCOUNT_ID = '${userId}';
const USER_ORGANIZATION_ID = ${orgId};
const AGENT_ID = ${result.data.id};

🔐 API Key Authentication:
export AGENT_API_KEY="${result.data.apiKey}"

🧪 Python Client Testing:
cd backend && uv run scripts/test_integration.py ${result.data.id}

🌐 Development API Testing:
curl -H "x-test-user-id: ${userId}" http://localhost:3000/api/agents/${result.data.id}/capabilities
          `.trim();
          
          console.log(configMessage);
          
          // Also show in a notification or modal if needed
          // For now, log to console for developer access
        }
        
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'Failed to save agent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setIsPending(false);
    }
  };

  const steps = [
    { id: 'basic', title: 'Basic Info', description: 'Name, role, and description' },
    { id: 'capabilities', title: 'Capabilities', description: 'Configure agent capabilities and steps' },
    { id: 'triggers', title: 'Triggers', description: 'How and when the agent runs' },
    { id: 'review', title: 'Review', description: 'Review configuration and create agent' }
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-border/20 p-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">
          {agent ? 'Edit Agent' : 'Create New Agent'}
        </h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !formData.name}
          >
            {isPending ? 'Saving...' : (agent ? 'Save Changes' : 'Create Agent')}
          </Button>
        </div>
      </div>
      <div className="flex-grow flex overflow-hidden">
        <div className="flex h-full w-full">
          {/* Sidebar Navigation */}
          <div className="w-64 border-r border-border/20 p-4 flex-shrink-0">
            <nav className="space-y-2">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentStep === index
                      ? 'bg-primary/20 text-primary-foreground'
                      : 'hover:bg-accent/10 hover:text-accent-foreground'
                  }`}
                >
                  <div className="font-medium">{step.title}</div>
                  <div className="text-sm opacity-70">{step.description}</div>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <div className="ml-3">
                    <div className="text-sm text-destructive">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 0: Basic Info */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-1">Basic Information</h2>
                  <p className="text-sm text-muted-foreground">
                    Give your agent a name and describe its purpose.
                  </p>
                </div>

                <FormField label="Agent Name" required>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Sales Report Bot"
                  />
                </FormField>

                <FormField label="Role">
                  <Input
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g., Data Analyst, Assistant, Automation Bot"
                  />
                </FormField>

                <FormField label="Description">
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this agent does and its main objectives..."
                    rows={3}
                  />
                </FormField>

                <FormField label="Persona">
                  <Textarea
                    value={formData.persona}
                    onChange={(e) => setFormData(prev => ({ ...prev, persona: e.target.value }))}
                    placeholder="Describe the agent's communication style and personality..."
                    rows={2}
                  />
                </FormField>
              </div>
            )}

            {/* Step 1: Capabilities */}
            {currentStep === 1 && isClient && (
              <CapabilityEditor
                capabilities={formData.capabilities}
                setCapabilities={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    capabilities: typeof value === 'function' ? value(prev.capabilities) : value,
                  }));
                }}
              />
            )}

            {/* Step 2: Triggers */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-1">Agent Triggers</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure how and when your agent should execute, and what task to create when triggered.
                  </p>
                </div>

                <FormField label="Trigger Type">
                  <Select 
                    value={formData.triggerType}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      triggerType: value,
                      triggerConfig: {} 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_TRIGGERS.map(trigger => (
                        <SelectItem key={trigger.type} value={trigger.type}>
                          {trigger.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* Trigger-specific configuration */}
                {formData.triggerType === 'CRON' && (
                  <FormField label="Cron Schedule" description="Unix cron expression">
                    <Input
                      value={formData.triggerConfig.cron || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        triggerConfig: { ...prev.triggerConfig, cron: e.target.value }
                      }))}
                      placeholder="0 9 * * MON-FRI (Every weekday at 9 AM)"
                    />
                  </FormField>
                )}

                {formData.triggerType === 'CALENDAR' && agent?.id && (
                  <FormField label="Calendar Schedule">
                    <ScheduleManager
                      agentId={agent.id}
                      initialRRule={formData.triggerConfig.rrule}
                      onScheduleChange={(rrule) => setFormData(prev => ({
                        ...prev,
                        triggerConfig: { ...prev.triggerConfig, rrule }
                      }))}
                    />
                  </FormField>
                )}

                {formData.triggerType === 'WEBHOOK' && (
                  <div className="space-y-4">
                    <FormField label="Webhook URL">
                      <Input
                        value={formData.triggerConfig.webhook_url || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          triggerConfig: { ...prev.triggerConfig, webhook_url: e.target.value }
                        }))}
                        placeholder="/api/webhook/my-agent"
                      />
                    </FormField>
                    <FormField label="Webhook Secret (Optional)">
                      <Input
                        value={formData.triggerConfig.webhook_secret || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          triggerConfig: { ...prev.triggerConfig, webhook_secret: e.target.value }
                        }))}
                        placeholder="Optional security token"
                        type="password"
                      />
                    </FormField>
                  </div>
                )}

                {/* Task Definition - shown for all non-manual triggers */}
                {formData.triggerType !== 'MANUAL' && (
                  <div className="space-y-4 border-t border-border/20 pt-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Task Definition</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Define what task should be created when this trigger fires.
                      </p>
                    </div>

                    <FormField label="Task Name" required>
                      <Input
                        value={formData.taskDefinition.name}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          taskDefinition: { ...prev.taskDefinition, name: e.target.value }
                        }))}
                        placeholder="e.g., Daily Report Generation"
                      />
                    </FormField>

                    <FormField label="Capability to Execute" description="Optional - system will auto-select if not specified">
                      <Select
                        value={formData.taskDefinition.capabilityName || '_auto'}
                        onValueChange={(value) => {
                          setFormData(prev => ({
                            ...prev,
                            taskDefinition: {
                              ...prev.taskDefinition,
                              capabilityName: value === '_auto' ? '' : value
                            }
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Auto-select capability" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.capabilities.length === 0 ? (
                            <SelectItem value="_placeholder" disabled>
                              No capabilities available
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="_auto">Auto-select (recommended)</SelectItem>
                              {formData.capabilities.map((capability) => (
                                <SelectItem key={capability.id} value={capability.name}>
                                  {capability.name} - {capability.description}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField label="Task Description">
                      <Textarea
                        value={formData.taskDefinition.description}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          taskDefinition: { ...prev.taskDefinition, description: e.target.value }
                        }))}
                        placeholder="Describe what this scheduled task should accomplish..."
                        rows={2}
                      />
                    </FormField>

                    <FormField 
                      label="Task Payload (JSON)" 
                      description="Additional data to pass to the task (optional)"
                    >
                      <Textarea
                        value={JSON.stringify(formData.taskDefinition.payload, null, 2)}
                        onChange={(e) => {
                          try {
                            const payload = e.target.value ? JSON.parse(e.target.value) : {};
                            setFormData(prev => ({
                              ...prev,
                              taskDefinition: { ...prev.taskDefinition, payload }
                            }));
                          } catch (error) {
                            // Invalid JSON - don't update state, but allow user to continue typing
                          }
                        }}
                        placeholder='{"key": "value"}'
                        rows={3}
                        className="font-mono text-sm"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-1">Review</h2>
                  <p className="text-sm text-muted-foreground">
                    Review your agent configuration before creating.
                  </p>
                </div>

                <Card className="bg-transparent border-border/20">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Basic Info */}
                      <div>
                        <h3 className="text-base font-semibold border-b border-border/20 pb-2 mb-2">Basic Information</h3>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                          <div><dt className="font-medium text-muted-foreground">Name</dt><dd className="font-semibold">{formData.name}</dd></div>
                          <div><dt className="font-medium text-muted-foreground">Role</dt><dd>{formData.role || 'Not set'}</dd></div>
                          <div className="col-span-full"><dt className="font-medium text-muted-foreground">Description</dt><dd>{formData.description || 'Not set'}</dd></div>
                        </dl>
                      </div>

                      {/* Tools */}
                      <div>
                        <h3 className="text-base font-semibold border-b border-border/20 pb-2 mb-2">
                          Selected Tools ({formData.selectedTools.length})
                        </h3>
                        <div className="flex flex-wrap gap-1">
                          {formData.selectedTools.map(toolName => {
                            const tool = PREDEFINED_TOOLS.find(t => t.name === toolName);
                            return (
                              <Badge key={toolName} variant="secondary" className="text-xs">
                                {tool?.display_name || toolName}
                              </Badge>
                            );
                          })}
                          {formData.selectedTools.length === 0 && (
                            <span className="text-xs text-muted-foreground">No tools selected</span>
                          )}
                        </div>
                      </div>

                      {/* Trigger */}
                      <div>
                        <h3 className="text-base font-semibold border-b border-border/20 pb-2 mb-2">Trigger</h3>
                        <div className="text-xs">
                          <span className="font-medium text-muted-foreground">Type: </span>
                          <span className="font-semibold">{
                            PREDEFINED_TRIGGERS.find(t => t.type === formData.triggerType)?.display_name
                          }</span>
                          {formData.triggerType === 'CRON' && formData.triggerConfig.cron && (
                            <div className="mt-1">
                              <span className="font-medium text-muted-foreground">Schedule: </span>
                              <span className="font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">{formData.triggerConfig.cron}</span>
                            </div>
                          )}
                          {formData.triggerType !== 'MANUAL' && formData.taskDefinition.name && (
                            <div className="mt-2 pt-2 border-t border-border/20">
                              <div className="text-xs">
                                <span className="font-medium text-muted-foreground">Task: </span>
                                <span className="font-semibold">{formData.taskDefinition.name}</span>
                              </div>
                              <div className="mt-1 text-xs">
                                <span className="font-medium text-muted-foreground">Capability: </span>
                                <span>{formData.taskDefinition.capabilityName || 'Auto-select (recommended)'}</span>
                              </div>
                              {formData.taskDefinition.description && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {formData.taskDefinition.description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
