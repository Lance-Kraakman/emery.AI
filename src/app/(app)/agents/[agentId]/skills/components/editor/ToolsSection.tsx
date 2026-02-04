'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolDropdown } from '@/components/chat/ToolDropdown';
import { ToolChip } from './ToolChip';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata';

interface ToolsSectionProps {
  tools: ToolConfigDTO[];
  onToolsChange: (tools: ToolConfigDTO[]) => void;
}

export function ToolsSection({
  tools,
  onToolsChange,
}: ToolsSectionProps) {
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
      const minHeight = 300;

      let left = rect.left;
      const dropdownWidth = 440;

      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 16;
      }

      if (left < 0) {
        left = 16;
      }

      const spaceAbove = rect.top - gap - 20;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 20;

      if (spaceAbove >= minHeight) {
        // Position above the button
        setDropdownPosition({
          bottom: window.innerHeight - rect.top + gap,
          left,
          maxHeight: spaceAbove,
        });
      } else {
        // Position below the button
        setDropdownPosition({
          top: rect.bottom + gap,
          left,
          maxHeight: spaceBelow,
        });
      }
      setShowDropdown(true);
    }
  };

  const handleToolSelect = (tool: ToolDTO) => {
    // Check for duplicates
    const toolRef = getToolReference(tool);
    if (tools.some((t) => t.name === toolRef)) {
      setShowDropdown(false);
      return;
    }

    const toolConfig: ToolConfigDTO = {
      name: toolRef,
      config: {
        displayName: tool.displayName,
        category: tool.category,
        type: tool.type,
      },
      // icon is enriched by ToolDropdown from appTypes.iconUrl
      iconUrl: tool.icon || undefined,
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
      {/* Selected Tools — rendered with ToolChip */}
      {tools.map((tool, index) => (
        <div key={index} className="relative flex items-center group">
          <ToolChip
            toolName={tool.name}
            displayName={tool.config?.displayName}
            iconUrl={tool.iconUrl}
          />

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
