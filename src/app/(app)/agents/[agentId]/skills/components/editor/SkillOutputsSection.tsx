'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [outputName, setOutputName] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    if (!outputName.trim()) return;

    if (editingIndex !== null) {
      // Update existing output
      const newOutputs = [...outputs];
      newOutputs[editingIndex] = { name: outputName.trim() };
      onOutputsChange(newOutputs);
    } else {
      // Add new output
      onOutputsChange([...outputs, { name: outputName.trim() }]);
    }

    // Reset form
    setOutputName('');
    setShowAddForm(false);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    onOutputsChange(outputs.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    setOutputName(outputs[index].name);
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setOutputName('');
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
            title={output.name}
          >
            <span className="truncate font-medium font-mono">
              {output.name}
            </span>
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
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            placeholder="output_name"
            className="w-32 h-8 font-mono text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={handleAdd}
            disabled={!outputName.trim()}
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
