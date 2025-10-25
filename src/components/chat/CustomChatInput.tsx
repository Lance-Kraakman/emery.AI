'use client';

/**
 * CustomChatInput with Enhanced Tool Selection Support
 *
 * Chat input with @ tool selection functionality using ReferenceTool objects.
 * Supports @doc:, @file:, @agent:, @table:, @database: for tool selection.
 *
 * AIDEV-NOTE: Enhanced with proper Tool domain integration.
 * Uses ReferenceTool objects for type-safe tool configs and unified architecture.
 * Simplified @ detection using input change handler with DDD ToolDropdown.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolDropdown } from './ToolDropdown';
import { resolveReferences } from '@/app/actions/references';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { toolResolverService } from '@/ddd/domain/tools/services/tool-resolver-service';

interface CustomChatInputProps {
  onSendMessage: (message: string) => void;
  onToolsChange?: (tools: ToolDTO[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CustomChatInput({
  onSendMessage,
  onToolsChange,
  placeholder = "Type your message here...",
  className = "",
  disabled = false
}: CustomChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedTools, setSelectedTools] = useState<ToolDTO[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Detect @ tools and show/hide dropdown
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setInputValue(value);

    // Find @ symbol before cursor - allow spaces in search but exclude completed tool references
    const beforeCursor = value.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@]*)$/);

    // Don't show dropdown if we're in a completed tool reference
    const isCompletedTool = atMatch && (
      atMatch[0].startsWith('@tool:') ||
      atMatch[0].startsWith('@doc:') ||
      atMatch[0].startsWith('@file:') ||
      atMatch[0].startsWith('@agent:') ||
      atMatch[0].startsWith('@table:') ||
      atMatch[0].startsWith('@database:')
    );

    if (atMatch && !isCompletedTool) {
      const query = atMatch[1] || '';
      setDropdownQuery(query);
      setShowDropdown(true);

      // Position above input since chat is at bottom of screen
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const dropdownHeight = 400;
        const gap = 4;

        // Calculate optimal position to stay within viewport
        let top = rect.top - dropdownHeight - gap;
        let left = rect.left;

        // Prevent going off top of screen
        if (top < 0) {
          top = rect.bottom + gap; // Position below input instead
        }

        // Prevent going off right side of screen
        // Dropdown uses min-w-96 (384px) and max-w-2xl (768px)
        // Calculate the actual width based on viewport
        const maxDropdownWidth = Math.min(768, window.innerWidth - 32); // max-w-2xl with margin
        const minDropdownWidth = 384; // min-w-96
        const dropdownWidth = Math.max(minDropdownWidth, maxDropdownWidth);

        // Check if dropdown would overflow on right side
        if (left + dropdownWidth > window.innerWidth) {
          // Position from right edge instead
          left = window.innerWidth - dropdownWidth - 16; // 16px margin
        }

        // Prevent going off left side of screen
        if (left < 0) {
          left = 16; // 16px margin
        }

        setDropdownPosition({ top, left });
      }
    } else {
      setShowDropdown(false);
    }
  };

  // Handle tool selection - add to selected tools and update input
  const handleToolSelect = (tool: ToolDTO) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const beforeCursor = inputValue.slice(0, cursorPos);
    const afterCursor = inputValue.slice(cursorPos);

    // Find and replace the @ query with the full tool reference - allow spaces
    const atMatch = beforeCursor.match(/@[^@]*$/);
    if (atMatch) {
      const beforeAt = beforeCursor.slice(0, atMatch.index);
      // Get insertText from unified ToolDTO with proper fallback for each type
      const getReferenceFallback = () => {
        if (tool.type !== 'reference') return `@tool:${tool.name}`;

        // Map unified ToolCategory back to reference prefixes
        switch (tool.category) {
          case 'documents': return `@doc:${tool.name}`;
          case 'files': return `@file:${tool.name}`;
          case 'agents': return `@agent:${tool.name}`;
          case 'tables': return `@table:${tool.name}`;
          case 'databases': return `@database:${tool.name}`;
          default: return `@tool:${tool.name}`;
        }
      };

      console.log('[CustomChatInput] Tool info:', {
        name: tool.name,
        type: tool.type,
        category: tool.category,
        insertText: tool.insertText,
        fallback: getReferenceFallback()
      });

      const insertText = tool.insertText || getReferenceFallback();
      const newValue = beforeAt + insertText + ' ' + afterCursor;
      setInputValue(newValue);

      // Add to selected tools
      const updatedTools = [...selectedTools, tool];
      setSelectedTools(updatedTools);
      onToolsChange?.(updatedTools);

      // Position cursor after inserted text
      const newCursorPos = beforeAt.length + (insertText?.length || 0) + 1;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    }

    setShowDropdown(false);
  };


  // Send message with simple reference mapping
  const handleSendMessage = async () => {
    if (inputValue.trim() && !disabled) {
      const message = inputValue.trim();

      // Use simple reference mapping
      const { mappedMessage, toolReferences } = toolResolverService.mapReferencesToTools(message);

      console.log('[CustomChatInput] Reference mapping:', {
        original: message,
        mapped: mappedMessage,
        references: toolReferences
      });

      // Send the mapped message (e.g., "@doc:myfile.pdf" becomes "@tool:document_reader")
      onSendMessage(mappedMessage);
      setInputValue('');
      setShowDropdown(false);

      // Keep selected tools visible after sending
      inputRef.current?.focus();
    }
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When dropdown is open, prevent default behavior for navigation keys
    if (showDropdown && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return; // Let ToolDropdown handle these
    }

    // Enter without Shift sends message, Shift+Enter creates new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation(); // AIDEV-NOTE: Prevent event bubbling to parent forms
      handleSendMessage();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showDropdown) return;

      const target = event.target as Node;
      const input = inputRef.current;
      const dropdown = document.querySelector('[data-tool-dropdown]');

      // Don't close if clicking on input or dropdown elements
      if (input && input.contains(target)) return;
      if (dropdown && dropdown.contains(target)) return;

      setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[120px] max-h-[300px] resize-none px-0 pr-12"
        />

        {/* Floating Send Button - positioned inside textarea */}
        <Button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || disabled}
          size="sm"
          className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-full shadow-sm hover:shadow-md transition-shadow"
        >
          <Send className="h-3 w-3" />
        </Button>

        {/* Tool Dropdown */}
        <ToolDropdown
          query={dropdownQuery}
          isOpen={showDropdown}
          onClose={() => setShowDropdown(false)}
          onSelect={handleToolSelect}
          position={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            maxHeight: 400,
          }}
        />
      </div>

      {/* Helpful hint */}
      {!inputValue && (
        <div className="text-xs text-gray-400 mt-1">
          Type @ to add tools, documents, agents, and more • Shift+Enter for new line
        </div>
      )}
    </div>
  );
}