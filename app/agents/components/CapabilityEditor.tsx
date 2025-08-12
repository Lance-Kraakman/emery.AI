'use client';

import { useState, useEffect } from 'react';
import { Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import DndWrapper from './DndWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PREDEFINED_TOOLS, ToolDefinition } from '@/lib/agents/tools-registry';
import { Plus, Trash2, GripVertical, AlertTriangle } from 'lucide-react';

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

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type, draggableId } = result;
  
    if (!destination) return;
  
    if (type === 'STEP' && source.droppableId === destination.droppableId) {
      const capId = source.droppableId.replace('steps-', '');
      const capIndex = capabilities.findIndex(c => c.id === capId);
      if (capIndex === -1) return;
  
      const newSteps = Array.from(capabilities[capIndex].steps);
      const [removed] = newSteps.splice(source.index, 1);
      newSteps.splice(destination.index, 0, removed);
      updateCapability(capIndex, { steps: newSteps });
  
    } else if (type === 'TOOL' && destination.droppableId.startsWith('step-tools-')) {
      const tool = PREDEFINED_TOOLS.find(t => t.name === draggableId);
      if (!tool) return;
  
      const [_, capId, stepIndexStr] = destination.droppableId.split('-');
      const capIndex = capabilities.findIndex(c => c.id === capId);
      const stepIndex = parseInt(stepIndexStr, 10);
      if (capIndex === -1 || isNaN(stepIndex)) return;
  
      addToolToStep(capIndex, stepIndex, tool);
    }
  };

  const filteredTools = PREDEFINED_TOOLS.filter(tool =>
    tool.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToolClick = (tool: ToolDefinition) => {
    let targetCapIndex = 0;
    let targetStepIndex = 0;
  
    if (capabilities.length === 0) {
      addCapability();
      setTimeout(() => {
        setCapabilities(prev => {
          const updatedCaps = [...prev];
          if (updatedCaps[0] && updatedCaps[0].steps.length === 0) {
            const newStep: Step = {
              id: generateUniqueId('step'),
              type: 'TOOL_STEP',
              instructions: '',
              tools: [tool],
            };
            updatedCaps[0].steps.push(newStep);
          }
          return updatedCaps;
        });
      }, 0);
      return;
    }
  
    const firstCap = capabilities[0];
    if (firstCap.steps.length === 0) {
      addStep(0);
      setTimeout(() => {
        setCapabilities(prev => {
          const updatedCaps = [...prev];
          if (updatedCaps[0] && updatedCaps[0].steps.length > 0) {
            if (!updatedCaps[0].steps[0].tools.find(t => t.name === tool.name)) {
              updatedCaps[0].steps[0].tools.push(tool);
            }
          }
          return updatedCaps;
        });
      }, 0);
      return;
    }
  
    addToolToStep(targetCapIndex, targetStepIndex, tool);
  };

  return (
    <DndWrapper onDragEnd={onDragEnd}>
      <div className="flex gap-4 h-full">
        <Card className="w-1/3">
          <CardHeader>
            <CardTitle>Tool Library</CardTitle>
            <Input
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </CardHeader>
          <CardContent className="overflow-y-auto h-[calc(100%-8rem)]">
            <Droppable droppableId="tools" type="TOOL" isDropDisabled={false}>
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {filteredTools.map((tool, index) => (
                    <Draggable key={tool.name} draggableId={tool.name} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="p-2 border rounded-lg mb-2 bg-card cursor-pointer hover:bg-muted"
                          onClick={() => handleToolClick(tool)}
                        >
                          <p className="font-semibold">{tool.display_name}</p>
                          <p className="text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </CardContent>
        </Card>

        <Card className="w-2/3">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Capabilities</CardTitle>
              <Button onClick={addCapability} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Capability
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto h-[calc(100%-4rem)]">
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
                <Droppable droppableId={`steps-${cap.id}`} type="STEP">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {cap.steps.map((step, stepIndex) => (
                        <Draggable key={step.id || stepIndex} draggableId={step.id || `step-${stepIndex}`} index={stepIndex}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="p-3 border rounded-lg bg-card"
                            >
                              <div className="flex items-start gap-2">
                                <span {...provided.dragHandleProps} className="mt-2 cursor-grab">
                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </span>
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
                              <Droppable droppableId={`step-tools-${cap.id}-${stepIndex}`} type="TOOL">
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`p-2 mt-2 border-dashed border-2 rounded-lg min-h-[40px] flex flex-wrap gap-2 ${snapshot.isDraggingOver ? 'bg-primary/20' : ''}`}
                                  >
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
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <Button onClick={() => addStep(capIndex)} variant="outline" size="sm" className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DndWrapper>
  );
};

export default CapabilityEditor;
