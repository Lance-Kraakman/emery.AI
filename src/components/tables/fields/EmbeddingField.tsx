'use client';

import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

export interface EmbeddingFieldValue {
  vector: number[];
  model?: string;
  generatedAt?: string;
  sourceText?: string;
  metadata?: {
    embeddingSize: number;
    normalized: boolean;
  };
}

interface EmbeddingFieldProps {
  value: EmbeddingFieldValue | null | undefined;
  isEditMode?: boolean;
  compact?: boolean;
  onGenerate?: () => void;
}

/**
 * Display component for embedding vectors
 * Shows a preview of the vector with dimension count
 * Following the pattern of FileField and RelationField
 */
export function EmbeddingField({
  value,
  isEditMode = false,
  compact = false,
  onGenerate,
}: EmbeddingFieldProps) {
  // Empty state
  if (!value || !value.vector || value.vector.length === 0) {
    return (
      <div className={compact ? 'text-xs' : 'text-sm'}>
        <span className="text-muted-foreground">No embedding</span>
      </div>
    );
  }

  // Generate preview of first 3 values
  const preview = value.vector
    .slice(0, 3)
    .map((v) => v.toFixed(3))
    .join(', ');

  const dimensionCount = value.vector.length;

  return (
    <div className={`flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      <Badge variant="outline" className={`${compact ? 'text-[10px] px-1.5 py-0' : 'text-xs'} font-mono`}>
        <Sparkles className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
        [{preview}...] ({dimensionCount}d)
      </Badge>
      {value.model && !compact && (
        <span className="text-[10px] text-muted-foreground">
          {value.model.split('/').pop()}
        </span>
      )}
    </div>
  );
}
