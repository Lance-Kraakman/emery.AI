'use client';

// AIDEV-NOTE: Agent node component for organization chart with status indicators and task tracking

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Bot, User, Activity, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { Agent } from '@/src/ddd/domain/agents/entities/agent';
import type { TaskDTO } from '@/src/app/mappers/task-mapper';

interface AgentNodeData extends Agent {
  type: 'agent';
  teamId?: number;
  tasks: TaskDTO[];
}

interface AgentNodeProps {
  data: AgentNodeData;
  selected: boolean;
}

export default function AgentNode({ data, selected }: AgentNodeProps) {
  const activeTasks = data.tasks?.filter(task => task.status === 'in_progress') || [];
  const pendingTasks = data.tasks?.filter(task => task.status === 'pending') || [];
  const completedTasks = data.tasks?.filter(task => task.status === 'completed') || [];
  const failedTasks = data.tasks?.filter(task => task.status === 'failed') || [];

  const renderPersona = (): React.ReactNode => {
    if (!data.persona) return null;
    return (
      <div>
        <p className="text-xs text-gray-700 line-clamp-2">
          {data.persona}
        </p>
      </div>
    );
  };

  const getStatusColor = () => {
    if (failedTasks.length > 0) return 'from-red-50 to-red-100 border-red-200';
    if (activeTasks.length > 0) return 'from-green-50 to-green-100 border-green-200';
    if (pendingTasks.length > 0) return 'from-yellow-50 to-yellow-100 border-yellow-200';
    return 'from-gray-50 to-gray-100 border-gray-200';
  };

  const getStatusIcon = (): React.ReactNode => {
    if (failedTasks.length > 0) return <XCircle className="w-4 h-4 text-red-600" />;
    if (activeTasks.length > 0) return <Activity className="w-4 h-4 text-green-600" />;
    if (pendingTasks.length > 0) return <Clock className="w-4 h-4 text-yellow-600" />;
    return <CheckCircle className="w-4 h-4 text-gray-600" />;
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      
      <Card className={`w-72 shadow-md transition-all duration-200 ${
        selected ? 'ring-2 ring-primary ring-opacity-75 shadow-lg' : 'hover:shadow-lg'
      } bg-gradient-to-br ${getStatusColor()}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Bot className="w-6 h-6 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg font-bold text-gray-900 truncate">
                  {data.name}
                </CardTitle>
                <p className="text-base text-gray-600">{data.role || 'Agent'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-2">
          {/* Description/Persona */}
          {/* @ts-ignore - temporary fix for React.ReactNode type inference issue */}
          {(data.persona && (
            <div>
              <p className="text-base text-gray-700 line-clamp-2">
                {String(data.persona)}
              </p>
            </div>
          )) as any}

          {/* Capabilities */}
          {data.capabilities && Array.isArray(data.capabilities) && data.capabilities.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Capabilities:</p>
              <div className="flex flex-wrap gap-1">
                {data.capabilities.slice(0, 2).map((capability: any, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {capability.name || capability}
                  </Badge>
                ))}
                {data.capabilities.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{data.capabilities.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Current Task */}
          {activeTasks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-700 mb-1">Current Task:</p>
              <p className="text-xs text-green-600 truncate">
                {activeTasks[0].name}
              </p>
            </div>
          )}

          {/* Task Summary */}
          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-green-700">{activeTasks.length} active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="font-semibold text-orange-700">{pendingTasks.length} pending</span>
              </div>
              <div className="font-medium text-gray-600">
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
