'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableMappingCard } from './TableMappingCard';
import type { TableMappingCardProps } from './TableMappingCard';

interface SortableTableMappingCardProps extends Omit<TableMappingCardProps, 'dragHandleProps'> {
  id: number;
  renderContentOnly?: boolean;
}

export function SortableTableMappingCard({ id, renderContentOnly, ...props }: SortableTableMappingCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TableMappingCard {...props} dragHandleProps={{ attributes, listeners: listeners || {} }} renderContentOnly={renderContentOnly} />
    </div>
  );
}
