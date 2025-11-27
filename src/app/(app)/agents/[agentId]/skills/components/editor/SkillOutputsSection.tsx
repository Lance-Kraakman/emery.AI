'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SkillOutput } from '@/app/mappers/skill-mapper';

interface SkillOutputsSectionProps {
  outputs: SkillOutput[];
  onOutputsChange: (outputs: SkillOutput[]) => void;
}

export function SkillOutputsSection({
  outputs,
  onOutputsChange
}: SkillOutputsSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<SkillOutput>({ name: '', type: 'text' });
  const formRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    if (!formData.name.trim()) return;

    if (editingIndex !== null) {
      // Update existing output
      const newOutputs = [...outputs];
      newOutputs[editingIndex] = formData;
      onOutputsChange(newOutputs);
    } else {
      // Add new output
      onOutputsChange([...outputs, formData]);
    }

    // Reset form
    setFormData({ name: '', type: 'text' });
    setShowAddForm(false);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    onOutputsChange(outputs.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    setFormData(outputs[index]);
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setFormData({ name: '', type: 'text' });
    setShowAddForm(false);
    setEditingIndex(null);
  };

  // Close form when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        showAddForm &&
        formRef.current &&
        !formRef.current.contains(target)
      ) {
        handleCancel();
      }
    };

    if (showAddForm) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddForm]);

  return (
    <div className="flex items-start gap-2 flex-wrap">
      {/* Selected Outputs */}
      {outputs.map((output, index) => (
        <div key={index} className="relative flex items-center group">
          <button
            onClick={() => handleEdit(index)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs
              transition-colors duration-150 flex-shrink-0 max-w-xs
              border-border bg-background hover:bg-muted/50 cursor-pointer"
            title={`${output.name} (type: ${output.type || 'text'})`}
          >
            <span className="truncate font-medium font-mono">
              {output.name}
            </span>
            {output.type && output.type !== 'text' && (
              <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
                {output.type}
              </span>
            )}
          </button>

          {/* Remove button */}
          <button
            onClick={() => handleRemove(index)}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove output"
          >
            <X className="w-2 h-2" />
          </button>
        </div>
      ))}

      {/* Add Output Button or Form */}
      {showAddForm ? (
        <div
          ref={formRef}
          className="flex items-center gap-2 p-2 border rounded-md bg-background shadow-sm"
        >
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="output_name"
            className="w-32 h-8 font-mono text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <Select
            value={formData.type || 'text'}
            onValueChange={(v) => setFormData({ ...formData, type: v as any })}
          >
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="file">File</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="document">Document</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={handleAdd}
            disabled={!formData.name.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive"
            onClick={handleCancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-[30px]"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {outputs.length === 0 ? 'Add output' : 'Add'}
        </Button>
      )}
    </div>
  );
}
