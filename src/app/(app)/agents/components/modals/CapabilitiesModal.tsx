'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Play,
  Code2
} from 'lucide-react';
import type { AgentDTO, CapabilityConfigDTO, StepConfigDTO, ToolConfigDTO } from '@/app/mappers/agent-mapper';
import type { CapabilityConfig, StepConfig } from '@/ddd/domain/agents/entities/agent';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { updateAgentFromClient } from '@/app/actions/agents';
import { ToolDropdown } from '@/components/chat/ToolDropdown';
import type { ToolDTO } from '@/app/mappers/tool-mapper';

interface CapabilitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
}

type ModalView = 'list' | 'create' | 'edit' | 'step-detail';

export function CapabilitiesModal({ isOpen, onClose, agent, onUpdate }: CapabilitiesModalProps) {
  const [view, setView] = useState<ModalView>('list');
  const [capabilities, setCapabilities] = useState<CapabilityConfig[]>([]);
  const [editingCapability, setEditingCapability] = useState<CapabilityConfig | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Tool selection state
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [editingToolInfo, setEditingToolInfo] = useState<{
    stepIndex: number;
    toolIndex: number;
    inputRef: HTMLInputElement | HTMLTextAreaElement | null;
  } | null>(null);

  // Initialize capabilities
  useEffect(() => {
    if (isOpen) {
      setCapabilities((agent.capabilities as CapabilityConfig[]) || []);
      setView('list');
      setEditingCapability(null);
      setEditingIndex(null);
      setEditingStepIndex(null);
    }
  }, [isOpen, agent]);

  const handleCreateCapability = () => {
    const newCapability: CapabilityConfig = {
      name: '',
      description: '',
      steps: []
    };
    setEditingCapability(newCapability);
    setEditingIndex(-1); // -1 indicates creating new
    setView('create');
  };

  const handleEditCapability = (capability: CapabilityConfig, index: number) => {
    setEditingCapability({ ...capability });
    setEditingIndex(index);
    setView('edit');
  };

  const handleDeleteCapability = (index: number) => {
    const newCapabilities = capabilities.filter((_, i) => i !== index);
    setCapabilities(newCapabilities);
  };

  const handleSaveCapability = () => {
    if (!editingCapability) return;

    const newCapabilities = [...capabilities];
    if (editingIndex === -1) {
      newCapabilities.push(editingCapability);
    } else if (editingIndex !== null) {
      newCapabilities[editingIndex] = editingCapability;
    }

    setCapabilities(newCapabilities);
    setView('list');
    setEditingCapability(null);
    setEditingIndex(null);
  };

  const handleAddStep = () => {
    if (!editingCapability) return;

    const newStep: StepConfig = {
      type: 'TOOL_STEP',
      instructions: '',
      tools: [],
      servers: []
    };

    setEditingCapability({
      ...editingCapability,
      steps: [...(editingCapability.steps || []), newStep]
    });
  };

  const handleDeleteStep = (stepIndex: number) => {
    if (!editingCapability) return;

    setEditingCapability({
      ...editingCapability,
      steps: editingCapability.steps?.filter((_, i) => i !== stepIndex) || []
    });
  };

  const handleUpdateStep = (stepIndex: number, updates: Partial<StepConfig>) => {
    if (!editingCapability) return;

    setEditingCapability({
      ...editingCapability,
      steps: editingCapability.steps?.map((step, i) =>
        i === stepIndex ? { ...step, ...updates } : step
      ) || []
    });
  };

  const handleAddStepTool = (stepIndex: number) => {
    if (!editingCapability) return;

    const newTool = ToolConfig.create('@', {}); // Start with @ to trigger dropdown
    const updatedSteps = editingCapability.steps?.map((step, i) =>
      i === stepIndex
        ? { ...step, tools: [...(step.tools || []), newTool] }
        : step
    ) || [];

    setEditingCapability({
      ...editingCapability,
      steps: updatedSteps
    });

    // Auto-focus the new input and trigger dropdown
    setTimeout(() => {
      const inputs = document.querySelectorAll('input[placeholder="Type @ to search tools..."]');
      const newInput = inputs[inputs.length - 1] as HTMLInputElement;
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(1, 1); // Position cursor after @
        // Trigger change event to show dropdown
        const event = new Event('input', { bubbles: true });
        Object.defineProperty(event, 'target', { value: newInput });
        newInput.dispatchEvent(event);
      }
    }, 100);
  };

  const handleRemoveStepTool = (stepIndex: number, toolIndex: number) => {
    if (!editingCapability) return;

    const updatedSteps = editingCapability.steps?.map((step, i) =>
      i === stepIndex
        ? { ...step, tools: step.tools?.filter((_, ti) => ti !== toolIndex) || [] }
        : step
    ) || [];

    setEditingCapability({
      ...editingCapability,
      steps: updatedSteps
    });
  };

  const handleToolInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    stepIndex: number,
    toolIndex: number
  ) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    // Update tool name
    handleUpdateStepTool(stepIndex, toolIndex, value);

    // Find @ symbol before cursor (exact same logic as CustomChatInput)
    const beforeCursor = value.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);

    if (atMatch) {
      const query = atMatch[1] || '';
      setDropdownQuery(query);
      setEditingToolInfo({
        stepIndex,
        toolIndex,
        inputRef: e.target
      });
      setShowToolDropdown(true);

      // Position dropdown above input
      const rect = e.target.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top - 400 - 4, // 400px dropdown height + 4px gap
        left: rect.left
      });
    } else {
      setShowToolDropdown(false);
      setEditingToolInfo(null);
    }
  };

  const handleUpdateStepTool = (stepIndex: number, toolIndex: number, name: string) => {
    if (!editingCapability) return;

    // Ensure we always have a valid name for ToolConfig
    const toolName = name?.trim() || 'New Tool';

    const updatedSteps = editingCapability.steps?.map((step, i) =>
      i === stepIndex
        ? {
            ...step,
            tools: step.tools?.map((tool, ti) =>
              ti === toolIndex ? ToolConfig.create(toolName, tool.config) : tool
            ) || []
          }
        : step
    ) || [];

    setEditingCapability({
      ...editingCapability,
      steps: updatedSteps
    });
  };

  const handleInstructionsInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
    stepIndex: number
  ) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    // Find @ symbol before cursor (same pattern as CustomChatInput)
    const beforeCursor = value.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);

    if (atMatch) {
      const query = atMatch[1] || '';
      setDropdownQuery(query);
      setEditingToolInfo({
        stepIndex,
        toolIndex: -1, // Use -1 to indicate instructions field
        inputRef: e.target
      });
      setShowToolDropdown(true);

      // Position dropdown above input
      const rect = e.target.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top - 400 - 4, // 400px dropdown height + 4px gap
        left: rect.left
      });
    } else {
      setShowToolDropdown(false);
      setEditingToolInfo(null);
    }
  };

  const handleToolSelect = (tool: ToolDTO) => {
    if (!editingToolInfo || !tool) return;

    const { stepIndex, toolIndex } = editingToolInfo;

    // All tools from dropdown are now ToolDTO
    const toolName = `@tool:${tool.name}`;

    if (toolIndex === -1) {
      // This is for instructions field - insert at cursor position AND add to tools array
      const inputRef = editingToolInfo.inputRef;
      if (inputRef && 'rows' in inputRef) { // Check if it's a textarea
        const cursorPos = inputRef.selectionStart || 0;
        const value = inputRef.value;
        const beforeCursor = value.slice(0, cursorPos);
        const afterCursor = value.slice(cursorPos);

        // Find the @ symbol and replace the partial text
        const atIndex = beforeCursor.lastIndexOf('@');
        if (atIndex >= 0) {
          const newValue = beforeCursor.slice(0, atIndex) + toolName + ' ' + afterCursor;

          // Create a ToolConfig for the step's tools array
          const newTool = ToolConfig.create(toolName, {});

          // Update both instructions and add tool to step
          if (!editingCapability) return;
          const updatedSteps = editingCapability.steps?.map((step, i) =>
            i === stepIndex
              ? {
                  ...step,
                  instructions: newValue,
                  tools: [...(step.tools || []), newTool]
                }
              : step
          ) || [];

          setEditingCapability({
            ...editingCapability,
            steps: updatedSteps
          });

          // Set cursor position after inserted text
          setTimeout(() => {
            const newCursorPos = atIndex + toolName.length + 1;
            inputRef.setSelectionRange(newCursorPos, newCursorPos);
            inputRef.focus();
          }, 0);
        }
      }
    } else {
      // This is for tool field
      handleUpdateStepTool(stepIndex, toolIndex, toolName);
    }

    setShowToolDropdown(false);
    setEditingToolInfo(null);
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);

      console.log('[CapabilitiesModal] handleSaveAll - capabilities before conversion:', JSON.stringify(capabilities, null, 2));
      
      // Log detailed tool information
      capabilities.forEach((cap, capIndex) => {
        console.log(`[CapabilitiesModal] handleSaveAll - Capability ${capIndex}:`, cap.name);
        cap.steps?.forEach((step, stepIndex) => {
          console.log(`[CapabilitiesModal] handleSaveAll - Step ${stepIndex}:`, step.type, 'tools:', step.tools);
          step.tools?.forEach((tool, toolIndex) => {
            console.log(`[CapabilitiesModal] handleSaveAll - Tool ${toolIndex}:`, {
              value: tool,
              type: typeof tool,
              isFunction: typeof tool === 'function',
              constructor: tool?.constructor?.name,
              keys: tool && typeof tool === 'object' ? Object.keys(tool) : 'N/A'
            });
          });
        });
      });

      // Convert domain capabilities to DTOs before sending to server action
      const capabilitiesDTO: CapabilityConfigDTO[] = capabilities.map(cap => ({
        name: cap.name,
        description: cap.description,
        steps: cap.steps.map(step => ({
          type: step.type,
          instructions: step.instructions,
          model: step.model,
          // Convert ToolConfig domain objects to DTOs
          tools: step.tools?.map(tool => {
            if (tool instanceof ToolConfig) {
              return tool.toPlain(); // Convert to plain DTO
            } else if (tool && typeof tool === 'object' && Object.getPrototypeOf(tool) === Object.prototype) {
              return tool as ToolConfigDTO; // Already a plain object
            } else {
              console.warn('[CapabilitiesModal] Invalid tool found:', tool);
              return null;
            }
          }).filter((tool): tool is ToolConfigDTO => tool !== null) || [],
          servers: step.servers || []
        }))
      }));

      console.log('[CapabilitiesModal] handleSaveAll - capabilitiesDTO after conversion:', JSON.stringify(capabilitiesDTO, null, 2));

      const result = await updateAgentFromClient(agent.id, {
        capabilities: capabilitiesDTO
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update capabilities');
      }

      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error saving capabilities:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getModalTitle = () => {
    switch (view) {
      case 'list':
        return 'Manage Capabilities';
      case 'create':
        return 'Create New Capability';
      case 'edit':
        return 'Edit Capability';
      case 'step-detail':
        return 'Configure Step';
      default:
        return 'Capabilities';
    }
  };

  const getModalDescription = () => {
    switch (view) {
      case 'list':
        return 'Configure multi-step workflows for your agent';
      case 'create':
      case 'edit':
        return 'Define the steps and tools needed for this capability';
      case 'step-detail':
        return 'Configure the instructions and tools for this step';
      default:
        return '';
    }
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {view !== 'list' && (
          <Button
            variant="outline"
            onClick={() => setView('list')}
            disabled={isSaving}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          {view === 'list' ? 'Close' : 'Cancel'}
        </Button>

        {view === 'list' && (
          <Button onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save All Changes
          </Button>
        )}

        {(view === 'create' || view === 'edit') && (
          <Button
            onClick={handleSaveCapability}
            disabled={!editingCapability?.name.trim() || isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Capability
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={getModalTitle()}
      description={getModalDescription()}
      size="xl"
      footer={footer}
      closeOnEscape={!isSaving}
      closeOnOutsideClick={!isSaving}
    >
      <div className="p-6">
        {view === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Capabilities ({capabilities.length})</h3>
                <p className="text-sm text-muted-foreground">
                  Multi-step workflows this agent can perform
                </p>
              </div>
              <Button onClick={handleCreateCapability}>
                <Plus className="h-4 w-4 mr-2" />
                Add Capability
              </Button>
            </div>

            {capabilities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Capabilities Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first capability to define what this agent can do
                  </p>
                  <Button onClick={handleCreateCapability}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Capability
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {capabilities.map((capability, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{capability.name}</CardTitle>
                          {capability.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {capability.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {capability.steps?.length || 0} steps
                            </Badge>
                            {capability.steps?.map((step, stepIndex) => (
                              <Badge key={stepIndex} variant="secondary" className="text-xs">
                                {step.type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCapability(capability, index)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCapability(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {(view === 'create' || view === 'edit') && editingCapability && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="capability-name">Capability Name *</Label>
                <Input
                  id="capability-name"
                  value={editingCapability.name}
                  onChange={(e) =>
                    setEditingCapability({ ...editingCapability, name: e.target.value })
                  }
                  placeholder="e.g., Data Analysis, Customer Support, Content Generation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capability-description">Description</Label>
                <Textarea
                  id="capability-description"
                  value={editingCapability.description || ''}
                  onChange={(e) =>
                    setEditingCapability({ ...editingCapability, description: e.target.value })
                  }
                  placeholder="Describe what this capability does and when to use it"
                  rows={3}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Steps</h3>
                <Button onClick={handleAddStep} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>

              {(!editingCapability.steps || editingCapability.steps.length === 0) ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Code2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No steps defined. Add your first step to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {editingCapability.steps.map((step, stepIndex) => (
                    <Card key={stepIndex} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Step {stepIndex + 1}</Badge>
                            <select
                              value={step.type}
                              onChange={(e) =>
                                handleUpdateStep(stepIndex, {
                                  type: e.target.value as 'CODE_STEP' | 'TOOL_STEP'
                                })
                              }
                              className="text-xs px-2 py-1 border rounded"
                            >
                              <option value="TOOL_STEP">Tool Step</option>
                              <option value="CODE_STEP">Code Step</option>
                            </select>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStep(stepIndex)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-2">
                        <div className="space-y-2">
                          <Label>Instructions</Label>
                          <Textarea
                            value={step.instructions}
                            onChange={(e) => {
                              handleUpdateStep(stepIndex, { instructions: e.target.value });
                              handleInstructionsInputChange(e, stepIndex);
                            }}
                            placeholder="What should this step do? (Type @ for tool suggestions)"
                            rows={2}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label>Tools</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddStepTool(stepIndex)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Tool
                            </Button>
                          </div>

                          {(!step.tools || step.tools.length === 0) ? (
                            <p className="text-xs text-muted-foreground">
                              No tools - click "Add Tool" to add tools
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {step.tools.map((tool, toolIndex) => {
                                if (!tool) return null; // Skip null/undefined tools
                                return (
                                  <div key={toolIndex} className="flex gap-2">
                                    <Input
                                      value={tool.name || ''}
                                    onChange={(e) =>
                                      handleToolInputChange(e, stepIndex, toolIndex)
                                    }
                                    onFocus={(e) => {
                                      // Show dropdown on focus if @ is present
                                      if (e.target.value.includes('@')) {
                                        const rect = e.target.getBoundingClientRect();
                                        setDropdownPosition({
                                          top: rect.bottom + 4,
                                          left: rect.left
                                        });
                                        setEditingToolInfo({
                                          stepIndex,
                                          toolIndex,
                                          inputRef: e.target
                                        });
                                        setShowToolDropdown(true);
                                      }
                                    }}
                                    placeholder="Type @ to search tools..."
                                    className="text-sm"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveStepTool(stepIndex, toolIndex)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tool Dropdown - Rendered outside modal for proper z-index */}
        {showToolDropdown && (
          <div style={{ position: 'fixed', zIndex: 9999 }}>
            <ToolDropdown
              query={dropdownQuery}
              isOpen={showToolDropdown}
              onClose={() => {
                setShowToolDropdown(false);
                setEditingToolInfo(null);
              }}
              onSelect={handleToolSelect}
              position={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                maxHeight: 400,
              }}
            />
          </div>
        )}
      </div>
    </BaseModal>
  );
}