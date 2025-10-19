'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Settings, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import type { AgentDTO, ToolConfigDTO, CapabilityConfigDTO, StepConfigDTO } from '@/app/mappers/agent-mapper';
import type { ServerConfig } from '@/ddd/domain/agents/entities/agent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToolDropdown } from '@/components/chat/ToolDropdown';
import type { ToolDTO } from '@/app/mappers/tool-mapper';

// AIDEV-NOTE: Capability manager with full CRUD functionality
// Supports both view and edit modes with compact UI

// Using domain CapabilityConfig type instead of local interface

interface CapabilityManagerProps {
  agent?: AgentDTO;  // Optional for creation mode
  capabilities?: CapabilityConfigDTO[];  // Alternative for creation mode
  isEditable?: boolean;
  onCapabilitiesChange?: (capabilities: CapabilityConfigDTO[]) => void;
}

export default function CapabilityManager({
  agent,
  capabilities: propCapabilities,
  isEditable = false,
  onCapabilitiesChange
}: CapabilityManagerProps) {
  const initialCapabilities = (propCapabilities || agent?.capabilities || []) as CapabilityConfigDTO[];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingCapability, setEditingCapability] = useState<CapabilityConfigDTO | null>(null);
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [editingStepToolIndex, setEditingStepToolIndex] = useState<{ stepIndex: number; toolIndex: number } | null>(null);

  const toolInputRef = useRef<HTMLInputElement>(null);

  const capabilities = initialCapabilities;

  // Log whenever editingCapability changes
  useEffect(() => {
    console.log('[CapabilityManager] editingCapability changed:', JSON.stringify(editingCapability, null, 2));
    
    // Log tools in editingCapability
    editingCapability?.steps?.forEach((step, stepIndex) => {
      console.log(`[CapabilityManager] editingCapability changed - Step ${stepIndex} tools:`, step.tools);
      step.tools?.forEach((tool, toolIndex) => {
        console.log(`[CapabilityManager] editingCapability changed - Step ${stepIndex} Tool ${toolIndex}:`, {
          value: tool,
          type: typeof tool,
          isFunction: typeof tool === 'function',
          constructor: tool?.constructor?.name,
          keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
        });
      });
    });
  }, [editingCapability]);

  const handleAdd = () => {
    const newCapability: CapabilityConfigDTO = {
      name: 'New Capability',
      description: '',
      steps: []
    };
    setEditingCapability(newCapability);
    setEditingIndex(-1); // -1 indicates new capability
  };

  const handleEdit = (index: number) => {
    console.log(`[CapabilityManager] handleEdit - Editing capability at index ${index}`);
    console.log('[CapabilityManager] handleEdit - Original capability:', JSON.stringify(capabilities[index], null, 2));
    
    // Log tools in original capability
    capabilities[index].steps?.forEach((step, stepIndex) => {
      console.log(`[CapabilityManager] handleEdit - Original step ${stepIndex} tools:`, step.tools);
      step.tools?.forEach((tool, toolIndex) => {
        console.log(`[CapabilityManager] handleEdit - Original tool ${toolIndex}:`, {
          value: tool,
          type: typeof tool,
          isFunction: typeof tool === 'function',
          constructor: tool?.constructor?.name,
          keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
        });
      });
    });
    
    const capabilityCopy = { ...capabilities[index] };
    console.log('[CapabilityManager] handleEdit - Capability copy:', JSON.stringify(capabilityCopy, null, 2));
    
    // Log tools in copied capability
    capabilityCopy.steps?.forEach((step, stepIndex) => {
      console.log(`[CapabilityManager] handleEdit - Copied step ${stepIndex} tools:`, step.tools);
      step.tools?.forEach((tool, toolIndex) => {
        console.log(`[CapabilityManager] handleEdit - Copied tool ${toolIndex}:`, {
          value: tool,
          type: typeof tool,
          isFunction: typeof tool === 'function',
          constructor: tool?.constructor?.name,
          keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
        });
      });
    });
    
    setEditingCapability(capabilityCopy);
    setEditingIndex(index);
  };

  const handleSave = () => {
    if (!editingCapability || !onCapabilitiesChange || editingIndex === null) return;

    console.log('[CapabilityManager] handleSave - BEFORE cleaning:', JSON.stringify(editingCapability, null, 2));
    
    // Log the actual data types and values
    console.log('[CapabilityManager] handleSave - Raw tools array:', editingCapability.steps[0]?.tools);
    editingCapability.steps[0]?.tools?.forEach((tool, index) => {
      console.log(`[CapabilityManager] handleSave - Tool ${index}:`, {
        value: tool,
        type: typeof tool,
        constructor: tool?.constructor?.name,
        isPlainObject: tool && typeof tool === 'object' && !tool.constructor || tool.constructor === Object,
        isFunction: typeof tool === 'function',
        keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
      });
    });

    // Filter out invalid tools (null, undefined, functions, empty placeholders) before saving
    const cleanedCapability = {
      ...editingCapability,
      steps: editingCapability.steps.map(step => {
        const originalTools = step.tools;
        const filteredTools = step.tools?.filter(tool => {
          console.log(`[CapabilityManager] Filtering tool: ${JSON.stringify(tool)}`);
          // Remove null/undefined using loose equality check
          if (tool == null) {
            console.log('[CapabilityManager] Filtering out null/undefined tool');
            return false;
          }
          // Remove functions
          if (typeof tool === 'function') {
            console.log('[CapabilityManager] Filtering out function tool');
            return false;
          }
          // Remove empty placeholder @tool:
          if (tool.name === '@tool:') {
            console.log('[CapabilityManager] Filtering out empty placeholder @tool:');
            return false;
          }
          // Keep all valid tools with proper names
          const isValid = tool.name && tool.name.length > 7;
          console.log(`[CapabilityManager] Tool "${tool.name}" - valid: ${isValid} (length: ${tool.name?.length || 0})`);
          return isValid;
        }) || [];

        console.log(`[CapabilityManager] Step tools: ${originalTools?.length || 0} → ${filteredTools.length}`);
        return {
          ...step,
          tools: filteredTools
        };
      })
    };

    console.log('[CapabilityManager] handleSave - AFTER cleaning:', JSON.stringify(cleanedCapability, null, 2));

    const newCapabilities = [...capabilities];
    if (editingIndex === -1) {
      // Adding new capability
      console.log('[CapabilityManager] Adding NEW capability');
      newCapabilities.push(cleanedCapability);
    } else {
      // Updating existing capability
      console.log(`[CapabilityManager] Updating capability at index ${editingIndex}`);
      newCapabilities[editingIndex] = cleanedCapability;
    }

    console.log('[CapabilityManager] Calling onCapabilitiesChange with:', JSON.stringify(newCapabilities, null, 2));
    console.log('[CapabilityManager] Final capabilities array being sent to parent:', newCapabilities);
    
    // Check if any tools are still non-serializable
    newCapabilities.forEach((cap, capIndex) => {
      cap.steps.forEach((step, stepIndex) => {
        step.tools?.forEach((tool, toolIndex) => {
          console.log(`[CapabilityManager] Final check - Capability ${capIndex}, Step ${stepIndex}, Tool ${toolIndex}:`, {
            value: tool,
            type: typeof tool,
            isString: typeof tool === 'string',
            isObject: typeof tool === 'object',
            constructor: tool?.constructor?.name
          });
        });
      });
    });
    onCapabilitiesChange(newCapabilities);
    setEditingCapability(null);
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setEditingCapability(null);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    if (!onCapabilitiesChange) return;
    const newCapabilities = capabilities.filter((_, i) => i !== index);
    onCapabilitiesChange(newCapabilities);
  };

  const handleAddStep = () => {
    if (!editingCapability) return;
    const newStep: StepConfigDTO = {
      type: 'TOOL_STEP',
      instructions: 'New step instructions',
      tools: [],
      servers: []
    };
    setEditingCapability({
      ...editingCapability,
      steps: [...(editingCapability.steps || []), newStep]
    });
  };

  const handleRemoveStep = (stepIndex: number) => {
    if (!editingCapability) return;
    setEditingCapability({
      ...editingCapability,
      steps: editingCapability.steps?.filter((_, i) => i !== stepIndex) || []
    });
  };

  const handleUpdateStep = (stepIndex: number, updatedStep: Partial<StepConfigDTO>) => {
    if (!editingCapability) return;
    console.log(`[CapabilityManager] handleUpdateStep - stepIndex:${stepIndex}`);
    console.log('[CapabilityManager] handleUpdateStep - updatedStep:', JSON.stringify(updatedStep, null, 2));
    console.log('[CapabilityManager] handleUpdateStep - current step tools:', JSON.stringify(editingCapability.steps[stepIndex]?.tools, null, 2));
    
    // Check if updatedStep.tools contains any functions
    if (updatedStep.tools) {
      console.log('[CapabilityManager] handleUpdateStep - updatedStep.tools contains:');
      updatedStep.tools.forEach((tool, i) => {
        console.log(`  Tool ${i}:`, {
          value: tool,
          type: typeof tool,
          isFunction: typeof tool === 'function',
          constructor: tool?.constructor?.name
        });
      });
    }
    
    const newCapability = {
      ...editingCapability,
      steps: editingCapability.steps?.map((step, i) =>
        i === stepIndex ? { ...step, ...updatedStep } : step
      ) || []
    };
    
    console.log('[CapabilityManager] handleUpdateStep - new capability step tools:', JSON.stringify(newCapability.steps[stepIndex]?.tools, null, 2));
    setEditingCapability(newCapability);
  };

  const handleAddStepTool = (stepIndex: number) => {
    if (!editingCapability) return;
    console.log(`[CapabilityManager] handleAddStepTool - Adding tool to step ${stepIndex}`);
    console.log('[CapabilityManager] handleAddStepTool - Current step tools before adding:', editingCapability.steps[stepIndex]?.tools);
    
    // Create empty tool placeholder as plain DTO - will be filled via @tool: dropdown
    const newTool: ToolConfigDTO = { name: '@tool:', config: {} };
    console.log('[CapabilityManager] handleAddStepTool - Creating new tool:', JSON.stringify(newTool));
    
    const updatedStep = {
      ...editingCapability.steps[stepIndex],
      tools: [...(editingCapability.steps[stepIndex].tools || []), newTool]
    };
    console.log('[CapabilityManager] handleAddStepTool - Updated step tools after adding:', JSON.stringify(updatedStep.tools));
    
    // Log all tools in the updated step
    updatedStep.tools?.forEach((tool, toolIndex) => {
      console.log(`[CapabilityManager] handleAddStepTool - Tool ${toolIndex} after adding:`, {
        value: tool,
        type: typeof tool,
        isFunction: typeof tool === 'function',
        constructor: tool?.constructor?.name,
        keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
      });
    });
    
    handleUpdateStep(stepIndex, updatedStep);
  };

  // Handle tool input change for @ tool detection
  const handleToolInputChange = (e: React.ChangeEvent<HTMLInputElement>, stepIndex: number, toolIndex: number) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    // Update the tool name
    handleUpdateStepTool(stepIndex, toolIndex, 'name', value);

    // Find @ symbol before cursor for tool dropdown
    const beforeCursor = value.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);

    if (atMatch) {
      const query = atMatch[1] || '';
      setDropdownQuery(query);
      setEditingStepToolIndex({ stepIndex, toolIndex });
      setShowToolDropdown(true);

      // Position dropdown
      if (toolInputRef.current) {
        const rect = toolInputRef.current.getBoundingClientRect();
        const dropdownHeight = 400;
        const gap = 4;

        let top = rect.top - dropdownHeight - gap;
        let left = rect.left;

        if (top < 0) {
          top = rect.bottom + gap;
        }

        const dropdownWidth = 400;
        if (left + dropdownWidth > window.innerWidth) {
          left = window.innerWidth - dropdownWidth - 16;
        }
        if (left < 0) {
          left = 16;
        }

        setDropdownPosition({ top, left });
      }
    } else {
      setShowToolDropdown(false);
      setEditingStepToolIndex(null);
    }
  };

  // Handle tool selection from dropdown
  const handleToolSelect = (tool: ToolDTO) => {
    console.log('[CapabilityManager] handleToolSelect - Tool selected:', JSON.stringify(tool, null, 2));
    if (!editingStepToolIndex) {
      console.log('[CapabilityManager] handleToolSelect - No editingStepToolIndex, returning');
      return;
    }

    const { stepIndex, toolIndex } = editingStepToolIndex;
    console.log(`[CapabilityManager] handleToolSelect - stepIndex:${stepIndex}, toolIndex:${toolIndex}`);

    // All tools from dropdown are now ToolDTO
    const toolName = `@tool:${tool.name}`;
    console.log(`[CapabilityManager] handleToolSelect - Generated toolName:"${toolName}"`);

    // Handle OAuth requirements for tools that require connection
    if (tool.requiresConnection && tool.connectionType === 'oauth') {
      // TODO: Check if user has connected the required OAuth provider
      // For now, allow selection but the backend will handle auth validation
      console.log(`Tool ${tool.displayName} requires OAuth authentication`);
    }

    console.log(`[CapabilityManager] handleToolSelect - Calling handleUpdateStepTool with name:"${toolName}"`);
    // Update the tool with selected name
    handleUpdateStepTool(stepIndex, toolIndex, 'name', toolName);

    setShowToolDropdown(false);
    setEditingStepToolIndex(null);
  };

  const handleRemoveStepTool = (stepIndex: number, toolIndex: number) => {
    if (!editingCapability) return;
    const updatedStep = {
      ...editingCapability.steps[stepIndex],
      tools: editingCapability.steps[stepIndex].tools?.filter((_, i) => i !== toolIndex) || []
    };
    handleUpdateStep(stepIndex, updatedStep);
  };

  const handleUpdateStepTool = (stepIndex: number, toolIndex: number, field: keyof ToolConfigDTO, value: string) => {
    if (!editingCapability) return;
    console.log(`[CapabilityManager] handleUpdateStepTool - step:${stepIndex} tool:${toolIndex} field:${field} value:"${value}"`);
    console.log('[CapabilityManager] handleUpdateStepTool - Current tools array before update:', editingCapability.steps[stepIndex].tools);
    
    // Log all tools before update
    editingCapability.steps[stepIndex].tools?.forEach((tool, i) => {
      console.log(`[CapabilityManager] handleUpdateStepTool - Tool ${i} before update:`, {
        value: tool,
        type: typeof tool,
        isFunction: typeof tool === 'function',
        constructor: tool?.constructor?.name,
        keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
      });
    });
    
    console.log('[CapabilityManager] handleUpdateStepTool - Current tool being updated:', editingCapability.steps[stepIndex].tools?.[toolIndex]);
    
    const updatedTools = editingCapability.steps[stepIndex].tools?.map((tool, i) => {
      if (i === toolIndex) {
        console.log('[CapabilityManager] handleUpdateStepTool - Found tool to update:', tool);
        // Create new plain tool DTO with updated field
        if (field === 'name') {
          const updatedTool = { name: value || '', config: tool.config };
          console.log('[CapabilityManager] handleUpdateStepTool - Updated tool name:', JSON.stringify(updatedTool));
          return updatedTool;
        } else if (field === 'config') {
          return { name: tool.name, config: { ...tool.config, ...(value ? JSON.parse(value) : {}) } };
        }
        return tool;
      }
      return tool;
    }) || [];
    
    // Log all tools after update
    updatedTools.forEach((tool, i) => {
      console.log(`[CapabilityManager] handleUpdateStepTool - Tool ${i} after update:`, {
        value: tool,
        type: typeof tool,
        isFunction: typeof tool === 'function',
        constructor: tool?.constructor?.name,
        keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
      });
    });
    
    const updatedStep = {
      ...editingCapability.steps[stepIndex],
      tools: updatedTools
    };
    console.log('[CapabilityManager] handleUpdateStepTool - Step tools after update:', JSON.stringify(updatedStep.tools));
    handleUpdateStep(stepIndex, updatedStep);
  };

  const handleAddStepServer = (stepIndex: number) => {
    if (!editingCapability) return;
    const newServer: ServerConfig = { name: '', endpoint: undefined, config: undefined };
    const updatedStep = {
      ...editingCapability.steps[stepIndex],
      servers: [...(editingCapability.steps[stepIndex].servers || []), newServer]
    };
    handleUpdateStep(stepIndex, updatedStep);
  };

  const handleRemoveStepServer = (stepIndex: number, serverIndex: number) => {
    if (!editingCapability) return;
    const updatedStep = {
      ...editingCapability.steps[stepIndex],
      servers: editingCapability.steps[stepIndex].servers?.filter((_, i) => i !== serverIndex) || []
    };
    handleUpdateStep(stepIndex, updatedStep);
  };

  const handleUpdateStepServer = (stepIndex: number, serverIndex: number, field: keyof ServerConfig, value: string) => {
    if (!editingCapability) return;
    const updatedServers = editingCapability.steps[stepIndex].servers?.map((server, i) => 
      i === serverIndex ? { ...server, [field]: value || undefined } : server
    ) || [];
    const updatedStep = {
      ...editingCapability.steps[stepIndex],
      servers: updatedServers
    };
    handleUpdateStep(stepIndex, updatedStep);
  };

  // If editing a capability, show the edit form
  if (editingCapability !== null) {
    return (
      <div className="space-y-3 border rounded-lg p-3">
        <div className="space-y-2">
          <Input
            value={editingCapability.name}
            onChange={(e) => setEditingCapability({ ...editingCapability, name: e.target.value })}
            placeholder="Capability name"
            className="text-sm"
          />
          <Textarea
            value={editingCapability.description || ''}
            onChange={(e) => setEditingCapability({ ...editingCapability, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="text-sm"
          />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">Steps</div>
              <Button 
                type="button"
                onClick={handleAddStep}
                size="sm" 
                variant="outline"
                className="h-6 px-2 text-xs"
              >
                <Plus size={10} className="mr-1" />
                Add Step
              </Button>
            </div>
            
            <div className="space-y-3">
              {editingCapability.steps?.map((step, stepIndex) => (
                <div key={stepIndex} className="border rounded-lg p-3 bg-muted/30">
                  <div className="space-y-2">
                    {/* Step Header */}
                    <div className="flex items-center gap-2">
                      <select 
                        value={step.type}
                        onChange={(e) => handleUpdateStep(stepIndex, { type: e.target.value as 'CODE_STEP' | 'TOOL_STEP' })}
                        className="text-xs px-2 py-1 border rounded"
                      >
                        <option value="CODE_STEP">Code Step</option>
                        <option value="TOOL_STEP">Tool Step</option>
                      </select>
                      <Button
                        type="button"
                        onClick={() => handleRemoveStep(stepIndex)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 size={10} />
                      </Button>
                    </div>
                    
                    {/* Step Instructions */}
                    <Textarea
                      value={step.instructions}
                      onChange={(e) => handleUpdateStep(stepIndex, { instructions: e.target.value })}
                      placeholder="Step instructions"
                      rows={2}
                      className="text-xs"
                    />
                    
                    {/* Step Tools */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-medium">Tools</div>
                          <Button
                            type="button"
                            onClick={() => handleAddStepTool(stepIndex)}
                            variant="outline"
                            size="sm"
                            className="h-5 px-1 text-xs"
                          >
                            <Plus size={8} />
                          </Button>
                        </div>
                        <div className="space-y-1 relative">
                          {step.tools?.map((tool, toolIndex) => (
                            <div key={toolIndex} className="flex gap-1">
                              <Input
                                ref={editingStepToolIndex?.stepIndex === stepIndex && editingStepToolIndex?.toolIndex === toolIndex ? toolInputRef : undefined}
                                value={tool.name}
                                onChange={(e) => handleToolInputChange(e, stepIndex, toolIndex)}
                                placeholder="Type @ to search tools..."
                                className="text-xs h-6 flex-1"
                              />
                              <Button
                                type="button"
                                onClick={() => handleRemoveStepTool(stepIndex, toolIndex)}
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <X size={8} />
                              </Button>
                            </div>
                          ))}
                          {(!step.tools || step.tools.length === 0) && (
                            <div className="text-xs text-muted-foreground">No tools - click "+" to add</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Step Servers */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-medium">Servers</div>
                          <Button
                            type="button"
                            onClick={() => handleAddStepServer(stepIndex)}
                            variant="outline"
                            size="sm"
                            className="h-5 px-1 text-xs"
                          >
                            <Plus size={8} />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {step.servers?.map((server, serverIndex) => (
                            <div key={serverIndex} className="flex gap-1">
                              <Input
                                value={server.name}
                                onChange={(e) => handleUpdateStepServer(stepIndex, serverIndex, 'name', e.target.value)}
                                placeholder="Server name"
                                className="text-xs h-6 flex-1"
                              />
                              <Button
                                type="button"
                                onClick={() => handleRemoveStepServer(stepIndex, serverIndex)}
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <X size={8} />
                              </Button>
                            </div>
                          ))}
                          {(!step.servers || step.servers.length === 0) && (
                            <div className="text-xs text-muted-foreground">No servers</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!editingCapability.steps || editingCapability.steps.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                  No steps defined. Click "Add Step" to create the first step.
                </div>
              )}
            </div>
          </div>
          
        </div>
        
        <div className="flex gap-2 justify-end pt-2">
          <Button onClick={handleCancel} variant="outline" size="sm">
            <X size={14} className="mr-1" /> Cancel
          </Button>
          <Button onClick={handleSave} size="sm">
            <Save size={14} className="mr-1" /> Save
          </Button>
        </div>

        {/* Tool Selection Dropdown */}
        <ToolDropdown
          query={dropdownQuery}
          isOpen={showToolDropdown}
          onClose={() => {
            setShowToolDropdown(false);
            setEditingStepToolIndex(null);
          }}
          onSelect={handleToolSelect}
          position={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            maxHeight: 400,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isEditable && (
        <Button 
          onClick={handleAdd} 
          variant="outline" 
          size="sm" 
          className="w-full"
        >
          <Plus size={14} className="mr-1" /> Add Capability
        </Button>
      )}
      
      {capabilities.length > 0 ? (
        <div className="space-y-2">
          {capabilities.map((cap, index) => (
            <div key={index} className="border rounded-lg p-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <Settings size={14} className="text-muted-foreground" />
                    <span className="font-medium text-sm">{cap.name}</span>
                  </div>
                  
                  {cap.description && (
                    <p className="text-xs text-muted-foreground mb-1">{cap.description}</p>
                  )}
                  
                  {cap.steps && cap.steps.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cap.steps.map((step, stepIndex: number) => (
                        <Badge key={stepIndex} variant="secondary" className="text-xs py-0">
                          {step.type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                {isEditable && (
                  <div className="flex gap-1 ml-2">
                    <Button 
                      onClick={() => handleEdit(index)}
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0"
                    >
                      <Edit size={14} />
                    </Button>
                    <Button 
                      onClick={() => handleDelete(index)}
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0 text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isEditable && (
          <div className="text-center py-3 text-muted-foreground">
            <Settings className="mx-auto h-5 w-5 mb-1" />
            <p className="text-xs">No capabilities configured</p>
          </div>
        )
      )}
    </div>
  );
}
