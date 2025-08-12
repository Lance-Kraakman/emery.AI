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
import { AlertCircle, Check, ExternalLink, Zap, Code, Database, MessageSquare, Globe, FileText, Brain, Settings, GripVertical } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Capability } from './CapabilityEditor';

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
    capabilities: (agent?.capabilities as Capability[]) || [],
  });

  useEffect(() => {
    const initialCapabilities = (agent?.capabilities as Capability[]) || [];
    if (agent) {
      setFormData(prev => ({
        ...prev,
        capabilities: initialCapabilities.map(cap => ({
          ...cap,
          id: cap.id || generateUniqueId('cap'),
          steps: cap.steps ? cap.steps.map(step => ({
            ...step,
            id: step.id || generateUniqueId('step'),
          })) : [],
        })),
      }));
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
        ...formData.triggerConfig
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
    { id: 'review', title: 'Review & Create', description: 'Review configuration and create agent' }
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 border-b p-4 flex justify-between items-center">
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
          <div className="w-64 border-r bg-muted/40 p-4 flex-shrink-0">
            <nav className="space-y-2">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentStep === index
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
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
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <div className="ml-3">
                    <div className="text-sm text-red-800">{error}</div>
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
                    Configure how and when your agent should execute.
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
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-1">Review & Create</h2>
                  <p className="text-sm text-muted-foreground">
                    Review your agent configuration before creating.
                  </p>
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Basic Info */}
                      <div>
                        <h3 className="text-base font-semibold border-b pb-2 mb-2">Basic Information</h3>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                          <div><dt className="font-medium text-muted-foreground">Name</dt><dd className="font-semibold">{formData.name}</dd></div>
                          <div><dt className="font-medium text-muted-foreground">Role</dt><dd>{formData.role || 'Not set'}</dd></div>
                          <div className="col-span-full"><dt className="font-medium text-muted-foreground">Description</dt><dd>{formData.description || 'Not set'}</dd></div>
                        </dl>
                      </div>

                      {/* Tools */}
                      <div>
                        <h3 className="text-base font-semibold border-b pb-2 mb-2">
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
                        <h3 className="text-base font-semibold border-b pb-2 mb-2">Trigger</h3>
                        <div className="text-xs">
                          <span className="font-medium text-muted-foreground">Type: </span>
                          <span className="font-semibold">{
                            PREDEFINED_TRIGGERS.find(t => t.type === formData.triggerType)?.display_name
                          }</span>
                          {formData.triggerType === 'CRON' && formData.triggerConfig.cron && (
                            <div className="mt-1">
                              <span className="font-medium text-muted-foreground">Schedule: </span>
                              <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs">{formData.triggerConfig.cron}</span>
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
