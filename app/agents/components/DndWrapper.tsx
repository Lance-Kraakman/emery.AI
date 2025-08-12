'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, DropResult, Droppable } from 'react-beautiful-dnd';

interface DndWrapperProps {
  children: React.ReactNode;
  onDragEnd: (result: DropResult) => void;
}

export const DndWrapper = ({ children, onDragEnd }: DndWrapperProps) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? (
    <DragDropContext onDragEnd={onDragEnd}>{children}</DragDropContext>
  ) : null;
};

export default DndWrapper;
