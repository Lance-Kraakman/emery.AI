'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, FileText, File, Database, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToolDropdown } from '@/components/chat/ToolDropdown';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata';

interface StepToolsSectionProps {
  tools: ToolConfigDTO[];
  onToolsChange: (tools: ToolConfigDTO[]) => void;
  stepIndex: number;
}

export function StepToolsSection({
  tools,
  onToolsChange,
  stepIndex
}: StepToolsSectionProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight?: number;
  }>({ left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleAddTool = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 8;

      // Position dropdown above the button
      const bottom = window.innerHeight - rect.top + gap;
      const maxHeight = rect.top - gap - 20;

      let left = rect.left;
      const dropdownWidth = 440;

      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 16;
      }

      if (left < 0) {
        left = 16;
      }

      setDropdownPosition({ bottom, left, maxHeight });
      setShowDropdown(true);
    }
  };

  const handleToolSelect = (tool: ToolDTO) => {
    // Convert ToolDTO to ToolConfigDTO with reference-style config
    const toolConfig: ToolConfigDTO = {
      name: getToolReference(tool),
      config: {
        displayName: tool.displayName,
        category: tool.category,
        type: tool.type
      }
    };

    onToolsChange([...tools, toolConfig]);
    setShowDropdown(false);
  };

  const handleRemoveTool = (index: number) => {
    const newTools = tools.filter((_, i) => i !== index);
    onToolsChange(newTools);
  };

  // Convert tool to reference format (@doc:, @file:, etc.)
  const getToolReference = (tool: ToolDTO): string => {
    if (tool.type !== 'reference') return tool.name;

    switch (tool.category) {
      case ToolCategory.DOCUMENTS:
        return `@doc:${tool.name}`;
      case ToolCategory.FILES:
        return `@file:${tool.name}`;
      case ToolCategory.AGENTS:
        return `@agent:${tool.name}`;
      case ToolCategory.TABLES:
        return `@table:${tool.name}`;
      case ToolCategory.DATABASES:
        return `@database:${tool.name}`;
      default:
        return `@tool:${tool.name}`;
    }
  };

  // Get icon based on tool reference
  const getToolIcon = (toolName: string) => {
    if (toolName.startsWith('@doc:')) {
      return <FileText className="h-3.5 w-3.5 text-blue-600" />;
    } else if (toolName.startsWith('@file:')) {
      return <File className="h-3.5 w-3.5 text-green-600" />;
    } else if (toolName.startsWith('@agent:')) {
      return <Users className="h-3.5 w-3.5 text-orange-600" />;
    } else if (toolName.startsWith('@table:') || toolName.startsWith('@database:')) {
      return <Database className="h-3.5 w-3.5 text-purple-600" />;
    }
    return <Plus className="h-3.5 w-3.5 text-gray-600" />;
  };

  // Get display name from tool config
  const getDisplayName = (tool: ToolConfigDTO): string => {
    return tool.config?.displayName || tool.name;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        showDropdown &&
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        !target.closest('[data-tool-dropdown]')
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Selected Tools */}
      {tools.map((tool, index) => (
        <div key={index} className="relative flex items-center group">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs
              transition-colors duration-150 flex-shrink-0 max-w-xs
              border-border bg-background hover:bg-muted/50"
            title={getDisplayName(tool)}
          >
            {getToolIcon(tool.name)}
            <span className="truncate font-medium">
              {getDisplayName(tool)}
            </span>
          </div>

          {/* Remove button */}
          <button
            onClick={() => handleRemoveTool(index)}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove tool"
          >
            <X className="w-2 h-2" />
          </button>
        </div>
      ))}

      {/* Add Tool Button - Inline */}
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        className="h-[30px]"
        onClick={handleAddTool}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        {tools.length === 0 ? 'Add tools' : 'Add'}
      </Button>

      {/* Tool Dropdown */}
      {showDropdown && (
        <ToolDropdown
          query=""
          isOpen={showDropdown}
          onClose={() => setShowDropdown(false)}
          onSelect={handleToolSelect}
          position={dropdownPosition}
        />
      )}
    </div>
  );
}
