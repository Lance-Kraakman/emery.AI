'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface CapabilityFormData {
  name: string;
  description: string;
  steps: Array<{
    type: 'TOOL_STEP' | 'CODE_STEP';
    instructions: string;
    model?: string;
    tools?: Array<{ name: string; config: any }>;
    servers?: any[];
  }>;
}

interface CapabilityEditorProps {
  value: CapabilityFormData;
  onChange: (value: CapabilityFormData) => void;
  agentId: number;
  capabilityId?: number;
}

/**
 * CapabilityEditor Component
 *
 * AIDEV-NOTE: This is a simplified version for Step 9.
 * Will be enhanced in Step 10 with:
 * - ToolDropdown integration for tool selection
 * - @doc:, @file:, @agent: reference conversion
 * - ToolPanel integration for visual tool display
 * - Drag-and-drop step reordering
 * - Full step management UI
 */
export function CapabilityEditor({
  value,
  onChange,
  agentId,
  capabilityId
}: CapabilityEditorProps) {
  return (
    <div className="space-y-6">
      {/* Basic Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Enter capability name..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            placeholder="Enter capability description..."
            rows={3}
          />
        </div>
      </div>

      {/* Steps Section - Placeholder */}
      <div className="space-y-2">
        <Label>Steps</Label>
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p>Step editor will be implemented in the next phase</p>
          <p className="text-sm mt-2">
            This will include tool selection, code editing, and drag-and-drop reordering
          </p>
        </div>
      </div>
    </div>
  );
}
