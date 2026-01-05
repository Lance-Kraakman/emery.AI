'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SkillRefNodeData } from '../types';

interface SkillRefNodeProps {
  data: SkillRefNodeData;
  selected: boolean;
}

/**
 * SkillRefNode - Reference to another skill
 */
export const SkillRefNode = memo(function SkillRefNode({
  data,
  selected,
}: SkillRefNodeProps) {
  return (
    <Card
      className={cn(
        'min-w-[200px] max-w-[280px] shadow-md transition-shadow',
        selected && 'ring-2 ring-primary shadow-lg'
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-3 !h-3"
      />

      <CardHeader className="p-3 pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-100 dark:bg-purple-900">
            <Link2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-sm font-medium truncate">{data.name}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <p className="text-xs text-muted-foreground">
          {data.skillName || `Skill ID: ${data.skillId || 'Not set'}`}
        </p>
        {data.skillType && (
          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted">
            {data.skillType}
          </span>
        )}
      </CardContent>

      {/* Output handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        className="!bg-green-500 !w-3 !h-3"
        style={{ left: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="error"
        className="!bg-red-500 !w-3 !h-3"
        style={{ left: '65%' }}
      />
    </Card>
  );
});
