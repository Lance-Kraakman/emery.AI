'use client';

/**
 * Ultra-Simplified CustomChatInput
 * 
 * Clean integration with new ReferenceDropdown using TanStack Query pattern.
 * Minimal chat input that triggers reference search on @ detection.
 * 
 * AIDEV-NOTE: Complete rewrite eliminating all over-engineered complexity.
 * Only 3 files total: ReferenceApplicationService, ReferenceDropdown, CustomChatInput.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReferenceDropdown } from './ReferenceDropdown';
import type { SimpleReference } from '@/ddd/application/services/chat/reference-application-service';
import { useEmery } from '@/contexts/EmeryStoreProvider';
import type { ResolvedReference } from '@/lib/chat/reference-resolver';


interface CustomChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  className?: string;
  onArtifactCreated?: (artifact: any) => void; // For backward compatibility
  onReferencesChange?: (references: ResolvedReference[], isLoading: boolean) => void;
}

export default function CustomChatInput({
  onSendMessage,
  placeholder = "Type your message here...",
  className = "",
  onArtifactCreated,
  onReferencesChange
}: CustomChatInputProps) {
  // Basic state
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [resolvedReferences, setResolvedReferences] = useState<ResolvedReference[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, currentOrganization } = useEmery();

  // TODO: Add manual reference resolution on message send for manually typed references
  // (References selected from dropdown are resolved immediately below)

  // Detect @ references and show/hide dropdown
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    setInputValue(value);
    
    // Find @ symbol before cursor
    const beforeCursor = value.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);
    
    if (atMatch) {
      const query = atMatch[1] || '';
      setDropdownQuery(`@${query}`);
      setShowDropdown(true);
      
      // Position above input since chat is at bottom of screen
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.top - 400 - 4, // 400px dropdown height + 4px gap
          left: rect.left,
        });
      }
    } else {
      setShowDropdown(false);
    }
  };

  // Handle reference selection - directly add to ReferencesPanel
  const handleReferenceSelect = (reference: SimpleReference) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const beforeCursor = inputValue.slice(0, cursorPos);
    const afterCursor = inputValue.slice(cursorPos);
    
    // Find and replace the @ query with the full reference
    const atMatch = beforeCursor.match(/@[^@\s]*$/);
    if (atMatch) {
      const beforeAt = beforeCursor.slice(0, atMatch.index);
      const newValue = beforeAt + reference.insertText + afterCursor;
      setInputValue(newValue);
      
      // NEW: Directly add resolved reference to ReferencesPanel
      const resolvedRef: ResolvedReference = {
        type: reference.category as 'doc' | 'file' | 'table' | 'agent' | 'tool',
        fullPath: reference.insertText.replace(/^@\w+:/, ''), // Extract path from insertText
        originalMatch: reference.insertText,
        startIndex: beforeAt.length,
        endIndex: beforeAt.length + reference.insertText.length,
        data: reference, // Store the reference data itself
        metadata: {
          title: reference.displayName,
          description: reference.description,
        }
      };
      
      // Add to current resolved references
      const updatedRefs = [...resolvedReferences, resolvedRef];
      setResolvedReferences(updatedRefs);
      onReferencesChange?.(updatedRefs, false);
      
      // Position cursor after inserted text
      const newCursorPos = beforeAt.length + reference.insertText.length;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    }
    
    setShowDropdown(false);
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // When dropdown is open, prevent default behavior and stop propagation for navigation keys
    if (showDropdown && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return; // Let ReferenceDropdown handle these
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Send message
  const handleSendMessage = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      setShowDropdown(false);
      // Clear resolved references after sending
      setResolvedReferences([]);
      onReferencesChange?.([], false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pr-12"
          />
          
          {/* Reference Dropdown */}
          <ReferenceDropdown
            query={dropdownQuery}
            organizationId={currentOrganization?.id || data?.organization?.id || 1}
            isOpen={showDropdown}
            onClose={() => setShowDropdown(false)}
            onSelect={handleReferenceSelect}
            position={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              maxHeight: 400,
            }}
          />
        </div>
        
        <Button
          onClick={handleSendMessage}
          disabled={!inputValue.trim()}
          size="sm"
          className="px-3"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Helpful hint */}
      {!inputValue && (
        <div className="text-xs text-gray-400 mt-1">
          Type @ to reference documents, agents, tables, and more
        </div>
      )}
    </div>
  );
}