'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Calendar, User, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Loading } from '@/src/components/ui/loading';
import { BaseModal } from './BaseModal';
import TaskFormDialog from '../TaskFormDialog';
import type { AgentDTO } from '@/src/app/mappers/agent-mapper';
import { getTasks } from '@/src/app/actions/tasks';

interface ActivityDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
}

interface Task {
  id: string;
  name: string;
  instructions: string | { instructions: string; tools?: any[]; servers?: any[] };
  capabilityName?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export function ActivityDetailsModal({ isOpen, onClose, agent, onUpdate }: ActivityDetailsModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);

  // Fetch tasks when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen, agent.id]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const result = await getTasks(agent.id);
      if (result.success) {
        setTasks(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAssigned = () => {
    setIsAssignTaskOpen(false);
    fetchTasks(); // Refresh task list
    onUpdate?.(); // Notify parent to refresh agent data
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'running':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => setIsAssignTaskOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Task
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Activity Details"
        description={`Task history and performance for ${agent.name}`}
        size="lg"
        footer={footer}
      >
        <div className="p-6">
          {loading ? (
            <Loading text="Loading tasks..." />
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Tasks Yet</h3>
                <p className="text-muted-foreground mb-4">
                  This agent hasn't been assigned any tasks yet
                </p>
                <Button onClick={() => setIsAssignTaskOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign First Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Task History</h3>
                <Button variant="outline" size="sm" onClick={() => setIsAssignTaskOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Task
                </Button>
              </div>

              <div className="space-y-3">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-medium truncate">
                            {task.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            {task.capabilityName && (
                              <Badge variant="outline" className="text-xs">
                                {task.capabilityName}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {formatDate(task.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          {getStatusIcon(task.status)}
                          <Badge
                            variant="outline"
                            className={`text-xs ${getStatusColor(task.status)}`}
                          >
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        {typeof task.instructions === 'string'
                          ? task.instructions
                          : task.instructions?.instructions || 'No instructions provided'
                        }
                      </p>
                      {task.completedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Completed: {formatDate(task.completedAt)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </BaseModal>

      {/* Task Assignment Dialog */}
      <TaskFormDialog
        isOpen={isAssignTaskOpen}
        onClose={handleTaskAssigned}
        agent={agent}
      />
    </>
  );
}