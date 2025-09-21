'use client';

// AIDEV-NOTE: Team node component for organization chart using ReactFlow and design system components

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, Clock } from 'lucide-react';
import { Team } from '@/types/db';
import type { TaskDTO } from '@/app/mappers/task-mapper';

interface TeamNodeData extends Team {
  type: 'team';
  tasks: TaskDTO[];
}

interface TeamNodeProps {
  data: TeamNodeData;
  selected: boolean;
}

export default function TeamNode({ data, selected }: TeamNodeProps) {
  const activeTasks = data.tasks?.filter(task => task.status === 'in_progress') || [];
  const pendingTasks = data.tasks?.filter(task => task.status === 'pending') || [];
  const completedTasks = data.tasks?.filter(task => task.status === 'completed') || [];

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      
      <Card className={`w-72 shadow-md transition-all duration-200 ${
        selected ? 'ring-2 ring-primary ring-opacity-75 shadow-lg' : 'hover:shadow-lg'
      } bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Users className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg font-bold text-blue-900 truncate">
                  {data.name}
                </CardTitle>
                <p className="text-base text-blue-700 opacity-80">Team</p>
              </div>
            </div>
            <div className="flex flex-col items-end text-sm text-blue-600">
              <span>{data.agentIds?.length || 0} agents</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-2">
          {/* Purpose */}
          {data.purpose && (
            <div>
              <p className="text-base text-blue-800 line-clamp-2">
                {data.purpose}
              </p>
            </div>
          )}

          {/* Goals */}
          {data.goals && data.goals.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Goals:</p>
              <div className="flex flex-wrap gap-1">
                {data.goals.slice(0, 2).map((goal, index) => (
                  <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    {goal.length > 20 ? `${goal.substring(0, 20)}...` : goal}
                  </Badge>
                ))}
                {data.goals.length > 2 && (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    +{data.goals.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Responsibilities */}
          {data.responsibilities && data.responsibilities.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Key Responsibilities:</p>
              <div className="flex flex-wrap gap-1">
                {data.responsibilities.slice(0, 2).map((responsibility, index) => (
                  <Badge key={index} variant="outline" className="text-xs text-blue-600">
                    {responsibility.length > 15 ? `${responsibility.substring(0, 15)}...` : responsibility}
                  </Badge>
                ))}
                {data.responsibilities.length > 2 && (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    +{data.responsibilities.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Activity Summary */}
          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="text-green-700 font-semibold">{activeTasks.length} active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-orange-700 font-semibold">{pendingTasks.length} pending</span>
              </div>
              <div className="text-gray-600 font-medium">
                {completedTasks.length} completed
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
