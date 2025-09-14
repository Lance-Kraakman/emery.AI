'use client';

/**
 * Simplified CustomChatInput
 *
 * Clean chat input without reference parsing.
 * References and tools are now selected explicitly via ToolSelectionPanel.
 *
 * AIDEV-NOTE: Removed all @ symbol parsing complexity.
 * Tools and references now come from explicit user selection only.
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CustomChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CustomChatInput({
  onSendMessage,
  placeholder = "Type your message here...",
  className = "",
  disabled = false
}: CustomChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = () => {
    const trimmedMessage = inputValue.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={`flex items-center gap-2 p-4 border-t bg-white ${className}`}>
      <div className="flex-1">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full resize-none"
        />
      </div>

      <Button
        onClick={handleSendMessage}
        disabled={!inputValue.trim() || disabled}
        size="sm"
        className="flex-shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}