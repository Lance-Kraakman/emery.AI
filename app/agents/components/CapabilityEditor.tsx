'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PREDEFINED_TOOLS, ToolDefinition } from '@/lib/agents/tools-registry';
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';

const generateUniqueId = (prefix: string) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export interface Step {
  id: string;
  type: 'CODE_STEP' | 'TOOL_STEP';
  instructions: string;
  tools: ToolDefinition[];
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  steps: Step[];
}

interface CapabilityEditorProps {
  capabilities: Capability[];
  setCapabilities: React.Dispatch<React.SetStateAction<Capability[]>>;
}

const CapabilityEditor = ({ capabilities, setCapabilities }: CapabilityEditorProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const addCapability = () => {
    const newCapability: Capability = {
      id: generateUniqueId('cap'),
      name: `New Capability ${capabilities.length + 1}`,
      description: '',
      steps: [],
    };
    setCapabilities(prev => [...prev, newCapability]);
  };

  const updateCapability = (capIndex: number, updatedCap: Partial<Capability>) => {
    setCapabilities(prev =>
      prev.map((cap, index) =>
        index === capIndex ? { ...cap, ...updatedCap } : cap
      )
    );
  };

  const addStep = (capIndex: number) => {
    const newStep: Step = {
      id: generateUniqueId('step'),
      type: 'TOOL_STEP',
      instructions: '',
      tools: [],
    };
    setCapabilities(prev =>
      prev.map((cap, index) =>
        index === capIndex ? { ...cap, steps: [...cap.steps, newStep] } : cap
      )
    );
  };

  const updateStep = (capIndex: number, stepIndex: number, updatedStep: Partial<Step>) => {
    setCapabilities(prev =>
      prev.map((cap, cIndex) => {
        if (cIndex === capIndex) {
          const newSteps = cap.steps.map((step, sIndex) =>
            sIndex === stepIndex ? { ...step, ...updatedStep } : step
          );
          return { ...cap, steps: newSteps };
        }
        return cap;
      })
    );
  };

  const removeStep = (capIndex: number, stepIndex: number) => {
    setCapabilities(prev =>
      prev.map((cap, cIndex) => {
        if (cIndex === capIndex) {
          return { ...cap, steps: cap.steps.filter((_, sIndex) => sIndex !== stepIndex) };
        }
        return cap;
      })
    );
  };

  const addToolToStep = (capIndex: number, stepIndex: number, tool: ToolDefinition) => {
    setCapabilities(prev =>
      prev.map((cap, cIndex) => {
        if (cIndex === capIndex) {
          const newSteps = cap.steps.map((step, sIndex) => {
            if (sIndex === stepIndex) {
              if (step.tools.find(t => t.name === tool.name)) {
                return step;
              }
              return { ...step, tools: [...step.tools, tool] };
            }
            return step;
          });
          return { ...cap, steps: newSteps };
        }
        return cap;
      })
    );
  };

  const moveStepUp = (capIndex: number, stepIndex: number) => {
    if (stepIndex === 0) return; // Can't move first step up
    
    setCapabilities(prev =>
      prev.map((cap, cIndex) => {
        if (cIndex === capIndex) {
          const newSteps = [...cap.steps];
          const temp = newSteps[stepIndex];
          newSteps[stepIndex] = newSteps[stepIndex - 1];
          newSteps[stepIndex - 1] = temp;
          return { ...cap, steps: newSteps };
        }
        return cap;
      })
    );
  };

  const moveStepDown = (capIndex: number, stepIndex: number) => {
    setCapabilities(prev =>
      prev.map((cap, cIndex) => {
        if (cIndex === capIndex) {
          if (stepIndex === cap.steps.length - 1) return cap; // Can't move last step down
          
          const newSteps = [...cap.steps];
          const temp = newSteps[stepIndex];
          newSteps[stepIndex] = newSteps[stepIndex + 1];
          newSteps[stepIndex + 1] = temp;
          return { ...cap, steps: newSteps };
        }
        return cap;
      })
    );
  };

  const filteredTools = PREDEFINED_TOOLS.filter(tool =>
    tool.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full space-y-4">
      <div>
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">Capabilities</h3>
          <Button onClick={addCapability} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Capability
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Capabilities define what an agent can do. When an agent is assigned a task, it determines if it can perform the task based on its capabilities.
        </p>
      </div>
      <div className="overflow-y-auto h-[calc(100%-6rem)]">
        {capabilities.map((cap, capIndex) => (
          <div key={cap.id || capIndex} className="mb-4 p-4 border rounded-lg bg-muted/50">
            <Input
              value={cap.name}
              onChange={(e) => updateCapability(capIndex, { name: e.target.value })}
              className="font-bold text-lg mb-2"
            />
                <Textarea
                  value={cap.description}
                  onChange={(e) => updateCapability(capIndex, { description: e.target.value })}
                  placeholder="Capability description..."
                  className="mb-2 text-sm"
                  rows={2}
                />
                <div className="space-y-2">
                  {cap.steps.map((step, stepIndex) => (
                    <div key={step.id || stepIndex} className="p-3 border rounded-lg bg-card">
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveStepUp(capIndex, stepIndex)}
                            disabled={stepIndex === 0}
                            className="h-6 w-6"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveStepDown(capIndex, stepIndex)}
                            disabled={stepIndex === cap.steps.length - 1}
                            className="h-6 w-6"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <Textarea
                          value={step.instructions}
                          onChange={(e) => updateStep(capIndex, stepIndex, { instructions: e.target.value })}
                          placeholder="Step instructions..."
                          className="flex-grow text-sm"
                          rows={1}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeStep(capIndex, stepIndex)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="p-2 mt-2 border-dashed border-2 rounded-lg min-h-[40px] flex flex-wrap gap-2">
                        {step.tools.map((tool, toolIndex) => (
                          <div key={tool.name || toolIndex} className="p-1.5 border rounded bg-secondary text-secondary-foreground text-xs flex items-center gap-1">
                            <span>{tool.display_name}</span>
                            {tool.requires_auth && (
                              <span title="Connection required">
                                <AlertTriangle className="h-3 w-3 text-orange-500" />
                              </span>
                            )}
                          </div>
                        ))}
                        {step.tools.length === 0 && (
                          <span className="text-muted-foreground text-xs">Click to add tools to this step</span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-6 w-6">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="max-h-60 overflow-y-auto">
                            <Input
                              placeholder="Search tools..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="m-1 w-[calc(100%-0.5rem)]"
                            />
                            {filteredTools.map((tool) => (
                              <DropdownMenuItem
                                key={tool.name}
                                onSelect={() => addToolToStep(capIndex, stepIndex, tool)}
                              >
                                {tool.display_name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={() => addStep(capIndex)} variant="outline" size="sm" className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            ))}
      </div>
    </div>
  );
};

export default CapabilityEditor;
