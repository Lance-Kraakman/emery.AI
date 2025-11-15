'use client';

/**
 * Unified Chat Input Component
 *
 * Reusable input component for both chat UI and form fields (like skill instructions).
 * Supports @ tool selection, file attachments, and optional send button.
 *
 * AIDEV-NOTE: Extracted from CustomChatInput to enable reuse across chat and forms.
 * Chat mode: auto-resize, send button, Enter to send
 * Form mode: fixed height, no send button, form field behavior
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Image as ImageIcon, File as FileIcon, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ToolDropdown } from '@/components/chat/ToolDropdown';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { toolResolverService } from '@/ddd/domain/tools/services/tool-resolver-service';
import { useChatInputState } from '@/hooks/useChatInputState';

interface UnifiedChatInputProps<T = ToolDTO> {
  // Core text input
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;

  // Tool selection (@mentions)
  tools?: T[];
  onToolsChange?: (tools: T[]) => void;

  // File attachments (optional)
  enableAttachments?: boolean;
  pendingAttachments?: File[];
  onAttachmentAdd?: (file: File) => void;
  onAttachmentRemove?: (index: number) => void;

  // Send functionality (optional)
  enableSendButton?: boolean;
  onSendMessage?: (message: string) => void;

  // Layout mode
  mode?: 'chat' | 'form'; // chat = auto-resize + Enter sends, form = fixed height + form behavior
  minHeight?: string;     // For form mode

  // Form field props (optional)
  id?: string;
  label?: string;
  helpText?: string;
}

export function UnifiedChatInput<T = ToolDTO>({
  value: controlledValue,
  onChange: controlledOnChange,
  placeholder = "Type your message here...",
  disabled = false,
  className = "",
  tools,
  onToolsChange,
  enableAttachments = true,
  pendingAttachments = [],
  onAttachmentAdd,
  onAttachmentRemove,
  enableSendButton = true,
  onSendMessage,
  mode = 'chat',
  minHeight,
  id,
  label,
  helpText
}: UnifiedChatInputProps<T>) {
  // Support both controlled and uncontrolled modes
  const [internalValue, setInternalValue] = useState('');
  const inputValue = controlledValue !== undefined ? controlledValue : internalValue;
  const setInputValue = (val: string) => {
    if (controlledValue !== undefined) {
      controlledOnChange?.(val);
    } else {
      setInternalValue(val);
    }
  };

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; left: number; maxHeight?: number }>({ left: 0 });
  const [selectedTools, setSelectedTools] = useState<T[]>(tools || []);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea only in chat mode
  const chatInputState = useChatInputState(inputRef, inputValue, {
    minHeight: mode === 'chat' ? 44 : undefined,  // Single line height
    maxHeight: mode === 'chat' ? 400 : undefined  // Max height before scrolling
  });
  const isSingleLine = mode === 'chat' ? chatInputState.isSingleLine : false;

  // Sync selected tools with prop
  useEffect(() => {
    if (tools) {
      setSelectedTools(tools);
    }
  }, [tools]);

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
        const gap = 8; // Gap between dropdown and input

        // Position dropdown so its bottom is at the top of the input
        const bottom = window.innerHeight - rect.top + gap;
        const maxHeight = rect.top - gap - 20; // 20px margin from top of viewport

        let left = rect.left;

        // Prevent going off right side of screen
        const dropdownWidth = 440; // Match w-[440px] in ToolDropdown

        // Check if dropdown would overflow on right side
        if (left + dropdownWidth > window.innerWidth) {
          // Position from right edge instead
          left = window.innerWidth - dropdownWidth - 16; // 16px margin
        }

        // Prevent going off left side of screen
        if (left < 0) {
          left = 16; // 16px margin
        }

        setDropdownPosition({ bottom, left, maxHeight });
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

      const rawInsertText = tool.insertText || getReferenceFallback();
      // AIDEV-NOTE: Remove line breaks, tabs, and extra whitespace from insert text
      const insertText = rawInsertText.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      const newValue = beforeAt + insertText + ' ' + afterCursor;
      setInputValue(newValue);

      // Add to selected tools (cast ToolDTO to T for generic compatibility)
      const updatedTools = [...selectedTools, tool as T];
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
    if (inputValue.trim() && !disabled && onSendMessage) {
      const message = inputValue.trim();

      // Use simple reference mapping
      const { mappedMessage } = toolResolverService.mapReferencesToTools(message);

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

    // Enter sends message in chat mode (if send button is enabled)
    if (mode === 'chat' && enableSendButton && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSendMessage();
    }
  };

  // File upload handlers
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      // Validate file type and size
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is 50MB.`);
        return;
      }

      // Accept images, audio, documents, and common file types
      const acceptedTypes = [
        'image/', 'audio/', 'video/',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument',
        'text/'
      ];

      const isAccepted = acceptedTypes.some(type => file.type.startsWith(type));
      if (!isAccepted) {
        alert(`File type ${file.type} is not supported.`);
        return;
      }

      onAttachmentAdd?.(file);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get icon for file type
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-3 h-3" />;
    if (file.type.startsWith('audio/')) return <Music className="w-3 h-3" />;
    return <FileIcon className="w-3 h-3" />;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    <div className={className}>
      {/* Form label */}
      {label && <Label htmlFor={id} className="mb-2 block">{label}</Label>}

      {/* Help text */}
      {helpText && <p className="text-sm text-muted-foreground mb-2">{helpText}</p>}

      <div className="relative">
        {/* Attachment previews */}
        {enableAttachments && pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachments.map((file, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-2 px-2 py-1 max-w-[200px]"
            >
              {getFileIcon(file)}
              <span className="text-xs truncate flex-1">{file.name}</span>
              <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAttachmentRemove?.(index)}
                className="h-4 w-4 p-0 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Conditional layout: single-row when compact (chat mode), traditional when multi-line or form mode */}
      <div className={isSingleLine && mode === 'chat' ? "flex items-center gap-2" : "relative"}>
        {/* File upload button - inline when single-line in chat mode */}
        {enableAttachments && isSingleLine && mode === 'chat' && (
          <Button
            onClick={handleFileButtonClick}
            disabled={disabled}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            title="Attach file (images, audio, documents)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}

        {/* Textarea */}
        <Textarea
          ref={inputRef}
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={mode === 'chat' ? 1 : undefined}
          className={
            isSingleLine && mode === 'chat'
              ? "resize-none px-3 py-2 flex-1 min-w-0"
              : mode === 'form'
              ? "resize-y px-3 py-2"
              : "resize-none px-3 pr-12 pb-10"
          }
          style={mode === 'form' && minHeight ? { minHeight } : undefined}
        />

        {/* Send button - inline when single-line in chat mode */}
        {enableSendButton && isSingleLine && mode === 'chat' && (
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || disabled}
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0 rounded-full shadow-sm hover:shadow-md transition-shadow"
          >
            <Send className="h-3 w-3" />
          </Button>
        )}

        {/* Bottom action bar - only show in chat mode when multi-line */}
        {mode === 'chat' && !isSingleLine && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            {/* File upload button */}
            {enableAttachments && (
              <Button
                onClick={handleFileButtonClick}
                disabled={disabled}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Attach file (images, audio, documents)"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            )}

            {/* Send Button */}
            {enableSendButton && (
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || disabled}
                size="sm"
                className="h-8 w-8 p-0 rounded-full shadow-sm hover:shadow-md transition-shadow"
              >
                <Send className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Hidden file input */}
        {enableAttachments && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        )}

        {/* Tool Dropdown */}
        <ToolDropdown
          query={dropdownQuery}
          isOpen={showDropdown}
          onClose={() => setShowDropdown(false)}
          onSelect={handleToolSelect}
          position={dropdownPosition}
        />
      </div>
    </div>
    </div>
  );
}
