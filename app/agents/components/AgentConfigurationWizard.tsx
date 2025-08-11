'use client';

import { useState, useEffect } from 'react';
import { Agent } from '@/types/db';
import { createAgent, updateAgent } from '@/app/actions/agents';
import { getUserOAuthConnections } from '@/app/actions/pipedream';
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

import {
  PREDEFINED_TOOLS,
  PREDEFINED_TRIGGERS,
  getToolsByCategory,
  getToolCategories,
  isToolAvailableForUser,
  getAvailableToolsForUser,
  getUnavailableToolsForUser,
  type ToolDefinition,
  type TriggerDefinition
} from '@/lib/agents/tools-registry';

// AIDEV-NOTE: Enhanced agent configuration wizard with OAuth-aware tool selection

interface AgentConfigurationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent | null;
  onSuccess?: () => void;
}

interface Connection {
  id: string;
  app: string;
  status: 'connected' | 'disconnected' | 'error';
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
  isOpen, 
  onClose, 
  agent,
  onSuccess 
}: AgentConfigurationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    role: agent?.role || '',
    description: agent?.description || '',
    persona: agent?.persona || '',
    selectedTools: [] as string[],
    triggerType: 'MANUAL' as string,
    triggerConfig: {} as Record<string, any>,
    capabilities: [] as Array<{
      name: string;
      description: string;
      steps: Array<{
        id: string;
        type: 'CODE_STEP' | 'TOOL_STEP';
        instructions: string;
        tools: Array<{ name: string }>;
      }>;
    }>
  });

  // OAuth connections
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);

  // Load user's OAuth connections
  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  const loadConnections = async () => {
    try {
      setConnectionsLoading(true);
      const result = await getUserOAuthConnections();
      if (result.success) {
        setConnections(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const connectedServices = connections
    .filter(conn => conn.status === 'connected')
    .map(conn => conn.app);

  const availableTools = getAvailableToolsForUser(connectedServices);
  const unavailableTools = getUnavailableToolsForUser(connectedServices);

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
        capabilities = [{
          name: 'default_capability',
          description: 'Default capability for this agent',
          steps: [{
            id: 'step_1',
            type: 'TOOL_STEP' as const,
            instructions: formData.description || 'Execute the selected tools as needed',
            tools: formData.selectedTools.map(toolName => ({ name: toolName }))
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
    { id: 'tools', title: 'Tools & Capabilities', description: 'Select tools and configure capabilities' },
    { id: 'triggers', title: 'Triggers', description: 'How and when the agent runs' },
    { id: 'review', title: 'Review & Create', description: 'Review configuration and create agent' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {agent ? 'Edit Agent' : 'Create New Agent'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[600px]">
          {/* Sidebar Navigation */}
          <div className="w-64 border-r bg-gray-50 p-4">
            <nav className="space-y-2">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentStep === index
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-gray-200'
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
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
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
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Basic Information</h2>
                  <p className="text-muted-foreground">
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
                    rows={4}
                  />
                </FormField>

                <FormField label="Persona">
                  <Textarea
                    value={formData.persona}
                    onChange={(e) => setFormData(prev => ({ ...prev, persona: e.target.value }))}
                    placeholder="Describe the agent's communication style and personality..."
                    rows={3}
                  />
                </FormField>
              </div>
            )}

            {/* Step 1: Tools & Capabilities */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Tools & Capabilities</h2>
                  <p className="text-muted-foreground">
                    Select the tools your agent can use. OAuth tools require connected accounts.
                  </p>
                </div>

                {connectionsLoading ? (
                  <div className="text-center py-8">Loading your connected services...</div>
                ) : (
                  <>
                    {/* OAuth Status */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="w-5 h-5" />
                          OAuth Connections
                        </CardTitle>
                        <CardDescription>
                          Your connected services: {connectedServices.length > 0 
                            ? connectedServices.join(', ') 
                            : 'None connected'}
                          {connectedServices.length === 0 && (
                            <Link 
                              href="/connections" 
                              className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Connect services <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </CardDescription>
                      </CardHeader>
                    </Card>

                    {/* Available Tools */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-green-700">Available Tools</h3>
                      {getToolCategories().map(category => {
                        const categoryTools = availableTools.filter(tool => tool.category === category);
                        if (categoryTools.length === 0) return null;

                        const Icon = getCategoryIcon(category);
                        
                        return (
                          <Card key={category}>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 capitalize">
                                <Icon className="w-4 h-4" />
                                {category}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 gap-3">
                                {categoryTools.map(tool => (
                                  <div 
                                    key={tool.name}
                                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
                                  >
                                    <Checkbox
                                      checked={formData.selectedTools.includes(tool.name)}
                                      onCheckedChange={() => handleToolToggle(tool.name)}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{tool.display_name}</span>
                                        {tool.requires_auth && (
                                          <Badge variant="secondary" className="text-xs">
                                            {tool.oauth_service}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {tool.description}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Unavailable Tools */}
                    {unavailableTools.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-orange-700">Requires OAuth Connection</h3>
                          <Link 
                            href="/connections" 
                            className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            Connect services <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        
                        {getToolCategories().map(category => {
                          const categoryTools = unavailableTools.filter(tool => tool.category === category);
                          if (categoryTools.length === 0) return null;

                          const Icon = getCategoryIcon(category);
                          
                          return (
                            <Card key={category} className="opacity-60">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 capitalize">
                                  <Icon className="w-4 h-4" />
                                  {category}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-1 gap-3">
                                  {categoryTools.map(tool => (
                                    <div 
                                      key={tool.name}
                                      className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50"
                                    >
                                      <Checkbox disabled />
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{tool.display_name}</span>
                                          <Badge variant="outline" className="text-xs">
                                            Connect {tool.oauth_service}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {tool.description}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 2: Triggers */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Agent Triggers</h2>
                  <p className="text-muted-foreground">
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
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Review & Create</h2>
                  <p className="text-muted-foreground">
                    Review your agent configuration before creating.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-2">
                        <div><dt className="font-medium">Name:</dt><dd>{formData.name}</dd></div>
                        <div><dt className="font-medium">Role:</dt><dd>{formData.role}</dd></div>
                        <div><dt className="font-medium">Description:</dt><dd>{formData.description}</dd></div>
                      </dl>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Selected Tools ({formData.selectedTools.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {formData.selectedTools.map(toolName => {
                          const tool = PREDEFINED_TOOLS.find(t => t.name === toolName);
                          return (
                            <Badge key={toolName} variant="secondary">
                              {tool?.display_name || toolName}
                            </Badge>
                          );
                        })}
                        {formData.selectedTools.length === 0 && (
                          <span className="text-muted-foreground">No tools selected</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Trigger Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <span className="font-medium">Type:</span> {
                          PREDEFINED_TRIGGERS.find(t => t.type === formData.triggerType)?.display_name
                        }
                        {formData.triggerType === 'CRON' && formData.triggerConfig.cron && (
                          <div className="mt-2">
                            <span className="font-medium">Schedule:</span> {formData.triggerConfig.cron}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                
                {currentStep < steps.length - 1 ? (
                  <Button
                    onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                    disabled={currentStep === 0 && !formData.name}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isPending || !formData.name}
                  >
                    {isPending ? 'Creating...' : (agent ? 'Update Agent' : 'Create Agent')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
