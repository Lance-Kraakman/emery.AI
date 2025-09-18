'use client';

import React from 'react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { ExternalLink, Link } from 'lucide-react';
import type { RelationArrayFieldValue } from '@/src/ddd/domain/tables/value-objects/field-values';

interface RelationFieldDisplayProps {
  value: RelationArrayFieldValue;
  fieldName: string;
}

export function RelationFieldDisplay({ value, fieldName }: RelationFieldDisplayProps) {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {value.map((relation, index) => (
        <div key={relation.id || index} className="flex items-center justify-between p-2 border rounded bg-background">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground truncate">
                {relation.value || `Record ${relation.id}`}
              </div>
              <div className="text-xs text-muted-foreground">
                ID: {relation.id}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="View related record"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {value.length > 1 && (
        <div className="text-xs text-muted-foreground">
          {value.length} related records
        </div>
      )}
    </div>
  );
}