'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, X } from 'lucide-react';
import type { RelationArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface RelationFieldInputProps {
  value: RelationArrayFieldValue;
  onChange: (value: RelationArrayFieldValue) => void;
  relatedTableId?: number;
  required?: boolean;
  multiple?: boolean;
  error?: string;
}

export function RelationFieldInput({
  value,
  onChange,
  relatedTableId,
  required,
  multiple = true,
  error
}: RelationFieldInputProps) {
  const relations = Array.isArray(value) ? value : [];
  const [searchTerm, setSearchTerm] = React.useState('');

  // TODO: Implement actual relation search/lookup
  // For now, provide manual input for relation data
  const handleAddRelation = () => {
    if (!searchTerm.trim()) return;

    const newRelation = {
      id: `temp-${Date.now()}`,
      value: searchTerm.trim()
    };

    if (multiple) {
      onChange([...relations, newRelation]);
    } else {
      onChange([newRelation]);
    }

    setSearchTerm('');
  };

  const handleRemoveRelation = (index: number) => {
    const updatedRelations = relations.filter((_, i) => i !== index);
    onChange(updatedRelations);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRelation();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Search or enter ${relatedTableId ? `table ${relatedTableId}` : 'related'} record...`}
            className={error ? 'border-destructive' : ''}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddRelation}
          disabled={!searchTerm.trim() || (!multiple && relations.length > 0)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {relations.length > 0 && (
        <div className="space-y-2 border rounded-md p-3">
          <div className="text-sm font-medium text-muted-foreground">
            Selected Relations:
          </div>
          {relations.map((relation, index) => (
            <div key={relation.id || index} className="flex items-center justify-between p-2 bg-muted rounded">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge variant="outline" className="text-xs">
                  {relation.id}
                </Badge>
                <span className="text-sm truncate">
                  {relation.value || `Record ${relation.id}`}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRelation(index)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {relatedTableId && (
        <div className="text-xs text-muted-foreground">
          Linking to table ID: {relatedTableId}
        </div>
      )}

      {!multiple && relations.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Only one relation allowed. Remove existing to add another.
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      {required && relations.length === 0 && (
        <div className="text-sm text-muted-foreground">
          At least one relation is required
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Note: Full relation lookup will be implemented. For now, manually enter record identifiers.
      </div>
    </div>
  );
}