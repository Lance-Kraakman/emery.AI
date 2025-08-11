'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Filter, 
  Calendar,
  User,
  Bot,
  ChevronLeft
} from 'lucide-react';
import { Task } from '@/app/actions/types';
import { format, formatDistanceToNow } from 'date-fns';

interface ActivityPanelProps {
  activities: Task[];
  selectedNodes: string[];
  onClearSelection: () => void;
  onCollapse?: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'in_progress':
      return <Activity className="w-4 h-4 text-green-600" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-blue-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'in_progress':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function ActivityPanel({ 
  activities, 
  selectedNodes, 
  onClearSelection,
  onCollapse 
}: ActivityPanelProps) {
  // Sort activities by most recent first
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const aDate = a.startedAt || a.createdAt;
      const bDate = b.startedAt || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [activities]);

  // Group activities by status
  const groupedActivities = useMemo(() => {
    return sortedActivities.reduce((acc, activity) => {
      const status = activity.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(activity);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [sortedActivities]);

  const activityCounts = useMemo(() => {
    return {
      total: activities.length,
      active: activities.filter(a => a.status === 'in_progress').length,
      pending: activities.filter(a => a.status === 'pending').length,
      completed: activities.filter(a => a.status === 'completed').length,
      failed: activities.filter(a => a.status === 'failed').length,
    };
  }, [activities]);

  return (
    <div className="h-full flex flex-col bg-muted/50 border-r">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity Feed
          </h2>
          <div className="flex items-center gap-2">
            {selectedNodes.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onClearSelection}
                className="text-xs"
              >
                <Filter className="w-3 h-3 mr-1" />
                Clear Filter
              </Button>
            )}
            {onCollapse && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCollapse}
                className="text-xs"
                title="Collapse activity panel"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Activity Summary */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{activityCounts.total}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active:</span>
            <span className="font-medium text-green-600">{activityCounts.active}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pending:</span>
            <span className="font-medium text-yellow-600">{activityCounts.pending}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Failed:</span>
            <span className="font-medium text-red-600">{activityCounts.failed}</span>
          </div>
        </div>

        {/* Selection Info */}
        {selectedNodes.length > 0 && (
          <div className="mt-3 p-2 bg-primary/10 rounded text-sm">
            <p className="text-primary font-medium">
              Filtered by {selectedNodes.length} selected node{selectedNodes.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {sortedActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Activity className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No activities found</p>
            {selectedNodes.length > 0 && (
              <p className="text-xs text-center mt-1">
                Try selecting different nodes or clearing the filter
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedActivities).map(([status, statusActivities]) => (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {getStatusIcon(status)}
                  <span className="capitalize">
                    {status.replace('_', ' ')} ({(statusActivities as Task[]).length})
                  </span>
                </div>
                
                {(statusActivities as Task[]).map((activity) => (
                  <Card key={activity.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {activity.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {activity.capabilityName}
                          </p>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getStatusColor(activity.status)}`}
                        >
                          {activity.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          <span>Agent {activity.agentId}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {activity.error && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                          <p className="text-red-800 font-medium">Error:</p>
                          <p className="text-red-700 mt-1">{activity.error}</p>
                        </div>
                      )}

                      {activity.result && activity.status === 'completed' && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                          <p className="text-green-800 font-medium">Result available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}