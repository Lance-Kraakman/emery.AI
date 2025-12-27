'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getPipedreamTools, getPipedreamToolById, type PipedreamToolMetadata, type PipedreamToolsGrouped } from '@/app/actions/tools';
import type { ToolExecutionConfig, ToolInputMapping, SkillInput } from '@/ddd/domain/skills/entities/skill';

interface ToolExecutionConfigFormProps {
  value: ToolExecutionConfig | undefined;
  onChange: (config: ToolExecutionConfig | undefined) => void;
  skillInputs: SkillInput[];
  onSkillInputsChange: (inputs: SkillInput[]) => void;
  disabled?: boolean;
}

/**
 * Form for configuring direct tool execution (executionType='tool').
 * Allows selecting a Pipedream tool and mapping skill inputs to tool parameters.
 */
export function ToolExecutionConfigForm({
  value,
  onChange,
  skillInputs,
  onSkillInputsChange,
  disabled
}: ToolExecutionConfigFormProps) {
  const [toolsGrouped, setToolsGrouped] = useState<PipedreamToolsGrouped>({});
  const [selectedTool, setSelectedTool] = useState<PipedreamToolMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Pipedream tools on mount
  useEffect(() => {
    async function loadTools() {
      setIsLoading(true);
      setError(null);
      const result = await getPipedreamTools();
      if (result.success && result.data) {
        setToolsGrouped(result.data);
      } else {
        setError(result.error || 'Failed to load tools');
      }
      setIsLoading(false);
    }
    loadTools();
  }, []);

  // Load selected tool details when value changes
  useEffect(() => {
    async function loadSelectedTool() {
      if (value?.toolId) {
        const result = await getPipedreamToolById(value.toolId);
        if (result.success && result.data) {
          setSelectedTool(result.data);
          // Expand the app containing this tool
          setExpandedApps(prev => new Set([...prev, result.data!.app]));
        }
      } else {
        setSelectedTool(null);
      }
    }
    loadSelectedTool();
  }, [value?.toolId]);

  // Filter tools by search query
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return toolsGrouped;

    const query = searchQuery.toLowerCase();
    const filtered: PipedreamToolsGrouped = {};

    for (const [appName, tools] of Object.entries(toolsGrouped)) {
      const matchingTools = tools.filter(
        tool =>
          tool.name.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          appName.toLowerCase().includes(query)
      );
      if (matchingTools.length > 0) {
        filtered[appName] = matchingTools;
      }
    }

    return filtered;
  }, [toolsGrouped, searchQuery]);

  // Get sorted app names
  const sortedAppNames = useMemo(() => {
    return Object.keys(filteredTools).sort((a, b) => a.localeCompare(b));
  }, [filteredTools]);

  // Handle tool selection
  const handleSelectTool = (tool: PipedreamToolMetadata) => {
    setSelectedTool(tool);

    // Auto-create skill inputs from tool parameters
    const newInputs: SkillInput[] = Object.entries(tool.inputs).map(([paramName, param]) => ({
      name: paramName,
      type: mapToolTypeToSkillType(param.type),
      required: param.required
    }));

    // Update skill inputs
    onSkillInputsChange(newInputs);

    // Create input mappings (skill input name = tool param name)
    const mappings: ToolInputMapping[] = Object.keys(tool.inputs).map(paramName => ({
      toolParam: paramName,
      skillInputName: paramName
    }));

    // Update config
    onChange({
      toolId: tool.id,
      inputMappings: mappings
    });
  };

  // Map tool parameter type to skill input type
  const mapToolTypeToSkillType = (toolType: string): SkillInput['type'] => {
    switch (toolType.toLowerCase()) {
      case 'string':
        return 'text';
      case 'number':
      case 'integer':
        return 'text'; // We'll handle as text, validation can happen later
      case 'boolean':
        return 'text';
      case 'object':
      case 'array':
        return 'text'; // JSON as text
      default:
        return 'text';
    }
  };

  // Handle mapping change
  const handleMappingChange = (toolParam: string, skillInputName: string | undefined, staticValue?: string) => {
    if (!value) return;

    const newMappings = value.inputMappings.map(m => {
      if (m.toolParam === toolParam) {
        return {
          toolParam,
          skillInputName: skillInputName || undefined,
          staticValue: staticValue !== undefined ? staticValue : undefined
        };
      }
      return m;
    });

    onChange({
      ...value,
      inputMappings: newMappings
    });
  };

  // Toggle app expansion
  const toggleApp = (appName: string) => {
    setExpandedApps(prev => {
      const next = new Set(prev);
      if (next.has(appName)) {
        next.delete(appName);
      } else {
        next.add(appName);
      }
      return next;
    });
  };

  // Clear tool selection
  const handleClearTool = () => {
    setSelectedTool(null);
    onChange(undefined);
    onSkillInputsChange([]);
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading tools...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Tool Display */}
      {selectedTool ? (
        <div className="border rounded-lg p-4 bg-primary/5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedTool.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedTool.app}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTool.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearTool}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Input Mappings */}
          {value && value.inputMappings.length > 0 && (
            <div className="mt-4 space-y-3">
              <Label className="text-sm font-medium">Input Mappings</Label>
              <div className="space-y-2">
                {value.inputMappings.map((mapping) => {
                  const toolInput = selectedTool.inputs[mapping.toolParam];
                  return (
                    <div key={mapping.toolParam} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={mapping.skillInputName || '__static__'}
                          onValueChange={(val) => {
                            if (val === '__static__') {
                              handleMappingChange(mapping.toolParam, undefined, '');
                            } else {
                              handleMappingChange(mapping.toolParam, val);
                            }
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select input..." />
                          </SelectTrigger>
                          <SelectContent>
                            {skillInputs.map(input => (
                              <SelectItem key={input.name} value={input.name}>
                                {input.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="__static__">
                              Static value
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{mapping.toolParam}</span>
                          {toolInput?.required && (
                            <Badge variant="outline" className="text-xs">required</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {toolInput?.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tool Selector */
        <div className="border rounded-lg">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Tool List */}
          <div className="max-h-[300px] overflow-y-auto">
            {sortedAppNames.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No tools found
              </div>
            ) : (
              sortedAppNames.map(appName => (
                <div key={appName} className="border-b last:border-b-0">
                  {/* App Header */}
                  <button
                    type="button"
                    onClick={() => toggleApp(appName)}
                    className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 transition-colors"
                    disabled={disabled}
                  >
                    {expandedApps.has(appName) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium capitalize">
                      {appName.replace(/^_/, '').replace(/_/g, ' ')}
                    </span>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {filteredTools[appName].length}
                    </Badge>
                  </button>

                  {/* App Tools */}
                  {expandedApps.has(appName) && (
                    <div className="bg-muted/30">
                      {filteredTools[appName].map(tool => (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => handleSelectTool(tool)}
                          className={cn(
                            'w-full text-left p-3 pl-10 hover:bg-accent/50 transition-colors border-t',
                            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
                          )}
                          disabled={disabled}
                        >
                          <div className="font-medium text-sm">{tool.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {tool.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
