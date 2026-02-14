'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, User, Loader2 } from 'lucide-react';
import { FieldRenderer } from '@/components/human-tasks/FieldRenderer';
import { getTasks, getMyAwaitingTasks, getAwaitingHumanTasks, completeHumanStep } from '@/app/actions/tasks';
import { getSkill } from '@/app/actions/skills';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface TasksClientProps {
  userId: string;
  organizationId: number;
}

type TabValue = 'my-tasks' | 'all-tasks' | 'scheduled';

/**
 * Status badge component for task status
 */
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case 'in_progress':
      return <Badge variant="default"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
    case 'awaiting_human':
      return <Badge className="bg-amber-500 text-white"><User className="w-3 h-3 mr-1" /> Awaiting Input</Badge>;
    case 'completed':
      return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    case 'cancelled':
      return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Human step completion dialog
 */
interface HumanStepDialogProps {
  task: TaskDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (outputs: Record<string, any>) => Promise<void>;
}

function HumanStepDialog({ task, isOpen, onClose, onComplete }: HumanStepDialogProps) {
  const [outputs, setOutputs] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skillInstructions, setSkillInstructions] = useState<string>('');
  const [outputSchema, setOutputSchema] = useState<Array<{ name: string; type?: string; fieldType?: string; description?: string }>>([]);

  // Get pending step info
  const pendingStep = task?.pendingHumanSteps?.find(s => !s.completedAt);

  // Load skill info to get instructions and output schema
  useEffect(() => {
    async function loadSkillInfo() {
      if (task?.skillId && isOpen) {
        const result = await getSkill(task.skillId);
        if (result.success && result.data) {
          const skill = result.data;
          // Get instructions from skill or humanSkillConfig
          setSkillInstructions(
            skill.humanSkillConfig?.instructions ||
            skill.instructions ||
            'Complete the task and provide the required outputs.'
          );
          // Get output schema from skill outputs
          setOutputSchema(skill.outputs || []);
          // Initialize outputs with empty/null values
          const initialOutputs: Record<string, unknown> = {};
          (skill.outputs || []).forEach(o => {
            initialOutputs[o.name] = null;
          });
          setOutputs(initialOutputs);
        }
      }
    }
    loadSkillInfo();
  }, [task?.skillId, isOpen]);

  const handleSubmit = async () => {
    if (!task || !pendingStep) return;

    setIsSubmitting(true);
    try {
      await onComplete(outputs);
      onClose();
    } catch (error) {
      toast.error('Failed to complete step');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!task || !pendingStep) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Complete Human Task</DialogTitle>
          <DialogDescription>
            {task.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Instructions</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {skillInstructions}
            </p>
          </div>

          {/* Inputs (read-only) */}
          {pendingStep.inputs && Object.keys(pendingStep.inputs).length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Context</h4>
              <div className="bg-muted/50 p-3 rounded border space-y-3">
                {Object.entries(pendingStep.inputs).map(([key, value]) => {
                  // Try to find matching input definition for field type
                  const inputDef = (outputSchema as any[]).find(
                    (i: any) => i.name === key
                  );
                  return (
                    <div key={key} className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {key}
                      </span>
                      <div>
                        <FieldRenderer
                          fieldType={inputDef?.fieldType || inputDef?.type}
                          value={value}
                          mode="view"
                          name={key}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outputs (editable) */}
          <div>
            <h4 className="font-medium mb-2">Your Response</h4>
            <div className="space-y-3">
              {outputSchema.length > 0 ? (
                outputSchema.map((output: any) => (
                  <div key={output.name}>
                    <Label htmlFor={output.name}>
                      {output.name}
                      {output.description && (
                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                          ({output.description})
                        </span>
                      )}
                    </Label>
                    <FieldRenderer
                      fieldType={output.fieldType || output.type}
                      value={outputs[output.name]}
                      onChange={(value) => setOutputs(prev => ({
                        ...prev,
                        [output.name]: value
                      }))}
                      mode="edit"
                      disabled={isSubmitting}
                      placeholder={`Enter ${output.name}...`}
                      name={output.name}
                      description={output.description}
                    />
                  </div>
                ))
              ) : (
                <div>
                  <Label htmlFor="result">Result</Label>
                  <FieldRenderer
                    fieldType="text"
                    value={outputs.result}
                    onChange={(value) => setOutputs(prev => ({
                      ...prev,
                      result: value
                    }))}
                    mode="edit"
                    disabled={isSubmitting}
                    placeholder="Enter your response..."
                    name="result"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Complete Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Task table component
 */
interface TaskTableProps {
  tasks: TaskDTO[];
  showAssignee?: boolean;
  onTaskClick?: (task: TaskDTO) => void;
  isLoading?: boolean;
}

function TaskTable({ tasks, showAssignee = false, onTaskClick, isLoading }: TaskTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Status</TableHead>
          {showAssignee && <TableHead>Assigned To</TableHead>}
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const pendingStep = task.pendingHumanSteps?.find(s => !s.completedAt);
          return (
            <TableRow key={task.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{task.name}</div>
                  {task.skillId && (
                    <div className="text-xs text-muted-foreground">
                      Skill #{task.skillId}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
              {showAssignee && (
                <TableCell>
                  {pendingStep?.assignedTo || '-'}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                {task.status === 'awaiting_human' && onTaskClick && (
                  <Button
                    size="sm"
                    onClick={() => onTaskClick(task)}
                  >
                    Complete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function TasksClient({ userId, organizationId }: TasksClientProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('my-tasks');
  const [myTasks, setMyTasks] = useState<TaskDTO[]>([]);
  const [allTasks, setAllTasks] = useState<TaskDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskDTO | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load tasks based on active tab
      if (activeTab === 'my-tasks') {
        const result = await getMyAwaitingTasks();
        if (result.success) {
          setMyTasks(result.data || []);
        }
      } else if (activeTab === 'all-tasks') {
        const result = await getTasks(undefined, 100);
        if (result.success) {
          setAllTasks(result.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleTaskClick = (task: TaskDTO) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleCompleteStep = async (outputs: Record<string, any>) => {
    if (!selectedTask) return;

    const pendingStep = selectedTask.pendingHumanSteps?.find(s => !s.completedAt);
    if (!pendingStep) return;

    const result = await completeHumanStep(selectedTask.id, pendingStep.stepId, outputs);
    if (result.success) {
      toast.success('Task completed successfully');
      loadTasks(); // Refresh the list
    } else {
      throw new Error(result.error || 'Failed to complete step');
    }
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="my-tasks">
              My Tasks
              {myTasks.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                  {myTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all-tasks">All Tasks</TabsTrigger>
            <TabsTrigger value="scheduled" disabled>
              Scheduled
            </TabsTrigger>
          </TabsList>

          <Button variant="outline" size="sm" onClick={loadTasks} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <TabsContent value="my-tasks">
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-medium">Tasks Assigned to You</h3>
              <p className="text-sm text-muted-foreground">
                Human tasks waiting for your input
              </p>
            </div>
            <TaskTable
              tasks={myTasks}
              onTaskClick={handleTaskClick}
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="all-tasks">
          <div className="bg-card rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-medium">All Organization Tasks</h3>
              <p className="text-sm text-muted-foreground">
                View all tasks across your organization
              </p>
            </div>
            <TaskTable
              tasks={allTasks}
              showAssignee
              onTaskClick={handleTaskClick}
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="scheduled">
          <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
            Scheduled tasks view coming soon.
          </div>
        </TabsContent>
      </Tabs>

      <HumanStepDialog
        task={selectedTask}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedTask(null);
        }}
        onComplete={handleCompleteStep}
      />
    </>
  );
}
