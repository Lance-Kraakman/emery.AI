'use server'

import { revalidatePath } from "next/cache";
import { requirePermission, requireResourcePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import type { Result, CreateTaskData } from "./types";
import { getAgentTaskApplicationService, getAgentApplicationService, getAuditApplicationService } from "@/ddd/application/di/container";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import type { CreateTaskDTO } from "@/app/dtos/task.dto";
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { getTaskAttachmentKey } from '@/lib/s3/path-registry';
import { invalidateOrgStorageCache } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';

export async function createTask(data: CreateTaskData): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const { agentId, name, instructions, createdBy } = data;

      if (!name || !instructions?.task) {
        return {
          success: false,
          error: "Task name and instructions are required",
        };
      }

      // Check resource-specific permission for task creation to this specific agent
      const session = await requireResourcePermission("tasks:create", "agent", agentId);
      const currentOrg = await requireCurrentOrganization();

      // Create task using application service - service accepts primitives
      const taskApplicationService = getAgentTaskApplicationService();
      const createDTO: CreateTaskDTO = {
        agentId,
        name,
        instructions,
        createdBy: createdBy || session.user.id,
        organizationId: currentOrg.id,
        triggerType: 'manual',
        triggeredByUserId: session.user.id,
        triggeredByUserName: session.user.name || session.user.email || undefined,
      };

      const result = await taskApplicationService.createTask(createDTO);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to create task"
        };
      }

      // Audit log task creation
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'agent',
          eventCategory: 'task_crud',
          eventAction: 'create',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || session.user.email || undefined,
          resourceType: 'task',
          resourceId: result.data?.id || 'unknown',
          resourceName: name,
          parentResourceType: 'agent',
          parentResourceId: String(agentId),
          eventData: {
            agentId,
            taskName: name,
            hasInstructions: !!instructions?.task,
          },
          success: true,
        }
      );

      revalidatePath('/dashboard');

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Error creating task:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create task",
      };
    }
  });
}

export async function getTasks(agentId?: number, limit = 50): Promise<Result> {
  return withAuthContext(async () => {
    try {
      await requirePermission("tasks:manage");
      const currentOrg = await requireCurrentOrganization();

      const taskApplicationService = getAgentTaskApplicationService();
      let tasks;

      if (agentId) {
        tasks = await taskApplicationService.getTasksForAgent(agentId);
      } else {
        tasks = await taskApplicationService.getRecentTasksForOrganization(currentOrg.id, limit);
      }

      // Service already returns DTOs, no conversion needed
      return {
        success: true,
        data: tasks,
      };
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return {
        success: false,
        error: "Failed to fetch tasks",
      };
    }
  });
}

export async function getTask(taskId: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      await requirePermission("tasks:manage");

      const taskApplicationService = getAgentTaskApplicationService();
      const task = await taskApplicationService.getTask(taskId);

      if (!task) {
        return {
          success: false,
          error: "Task not found",
        };
      }

      // Service already returns DTO, no conversion needed
      return {
        success: true,
        data: task,
      };
    } catch (error) {
      console.error("Error fetching task:", error);
      return {
        success: false,
        error: "Failed to fetch task",
      };
    }
  });
}

export async function updateTaskStatus(
  taskId: string, 
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout',
  result?: any,
  error?: string
): Promise<Result> {
  return withAuthContext(async () => {
    try {
      await requirePermission("tasks:manage");

    const taskApplicationService = getAgentTaskApplicationService();
    
    // For cancelled status, use the cancel method
    if (status === 'cancelled') {
      await taskApplicationService.cancelTask(taskId, error || 'Cancelled by user');
    } else {
      // For other status changes, we need to get the domain task entity and use domain methods
      // Note: Accessing repository directly is not ideal - better to add status update methods to application service
      const { TaskId } = await import('@/ddd/domain/shared/value-objects');
      const taskRepository = (taskApplicationService as any).taskRepository;
      const domainTask = await taskRepository.findById(TaskId.fromString(taskId));

      if (!domainTask) {
        return {
          success: false,
          error: "Task not found",
        };
      }

      // Apply domain transitions based on status
      try {
        switch (status) {
          case 'in_progress':
            domainTask.start();
            break;
          case 'completed':
            domainTask.complete(result);
            break;
          case 'failed':
            domainTask.fail(error || 'Task failed');
            break;
          case 'timeout':
            domainTask.timeout();
            break;
          default:
            return {
              success: false,
              error: `Cannot update task to status: ${status}`,
            };
        }

        // Save the updated task through the repository
        await taskRepository.save(domainTask);
      } catch (domainError) {
        return {
          success: false,
          error: domainError instanceof Error ? domainError.message : 'Invalid status transition',
        };
      }
    }

    // Get the updated task
    const updatedTask = await taskApplicationService.getTask(taskId);

    if (!updatedTask) {
      return {
        success: false,
        error: "Failed to retrieve updated task",
      };
    }

    // Audit log the status transition
    const auditService = getAuditApplicationService();
    const eventAction = status === 'in_progress' ? 'started' :
                        status === 'completed' ? 'completed' :
                        status === 'failed' ? 'failed' :
                        status === 'timeout' ? 'timeout' :
                        status === 'cancelled' ? 'cancelled' : status;

    // Cancelled is user-initiated, others are typically system
    const isUserAction = status === 'cancelled';
    const session = isUserAction ? await requirePermission("tasks:manage") : null;

    auditService.logEvent(
      OrganizationId.fromNumber(updatedTask.organizationId),
      {
        eventType: 'agent',
        eventCategory: 'task_lifecycle',
        eventAction,
        actorType: isUserAction ? 'user' : 'system',
        actorId: isUserAction && session ? session.user.id : 'system',
        actorName: isUserAction && session ? session.user.name || session.user.email || undefined : undefined,
        resourceType: 'task',
        resourceId: taskId,
        resourceName: updatedTask.name,
        parentResourceType: 'agent',
        parentResourceId: String(updatedTask.agentId),
        eventData: {
          newStatus: status,
          agentId: updatedTask.agentId,
          ...(error && { error }),
          ...(result && { hasResult: true }),
        },
        success: status !== 'failed' && status !== 'timeout',
      }
    );

    // Service already returns DTO, no conversion needed
    revalidatePath('/dashboard');

    return {
      success: true,
      data: updatedTask,
    };
  } catch (error) {
    console.error("Error updating task status:", error);
    return {
      success: false,
        error: error instanceof Error ? error.message : "Failed to update task status",
      };
    }
  });
}

export async function deleteTask(taskId: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("tasks:manage");

    if (!taskId) {
      return {
        success: false,
        error: "Task ID is required",
      };
    }

    const taskApplicationService = getAgentTaskApplicationService();

    // Verify task exists and capture details for audit
    const task = await taskApplicationService.getTask(taskId);
    if (!task) {
      return {
        success: false,
        error: "Task not found",
      };
    }

    // Capture task details before deletion for audit
    const taskName = task.name;
    const taskStatus = task.status;
    const agentId = task.agentId;
    const organizationId = task.organizationId;

    // Delete through the repository
    // Note: Ideally this would be a method on the application service
    await (taskApplicationService as any).taskRepository.delete(taskId);

    // Audit log the deletion
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(organizationId),
      {
        eventType: 'agent',
        eventCategory: 'task_crud',
        eventAction: 'delete',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || session.user.email || undefined,
        resourceType: 'task',
        resourceId: taskId,
        resourceName: taskName,
        parentResourceType: 'agent',
        parentResourceId: String(agentId),
        eventData: {
          agentId,
          finalStatus: taskStatus,
        },
        success: true,
      }
    );

    revalidatePath('/dashboard');

    return {
      success: true,
      data: { message: "Task deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting task:", error);
    return {
      success: false,
        error: error instanceof Error ? error.message : "Failed to delete task",
      };
    }
  });
}

export async function getTaskStats(agentId?: number): Promise<Result> {
  return withAuthContext(async () => {
    try {
      await requirePermission("tasks:manage");
      const currentOrg = await requireCurrentOrganization();

      const taskApplicationService = getAgentTaskApplicationService();
      let tasks;

      if (agentId) {
        tasks = await taskApplicationService.getTasksForAgent(agentId);
      } else {
        tasks = await taskApplicationService.getTasksForOrganization(currentOrg.id);
      }

      // Service returns DTOs where status is a string, not a Value Object
      const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
        timeout: tasks.filter(t => t.status === 'timeout').length,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("Error fetching task stats:", error);
      return {
        success: false,
        error: "Failed to fetch task stats",
      };
    }
  });
}

/**
 * Upload attachment for a task
 * Uploads file to S3 and returns the URL for inclusion in task instructions
 */
/**
 * Get all tasks awaiting human input for the current organization
 * Used in the "All Tasks" tab of /tasks page
 */
export async function getAwaitingHumanTasks(): Promise<Result> {
  return withAuthContext(async () => {
    try {
      await requirePermission("tasks:manage");
      const currentOrg = await requireCurrentOrganization();

      const taskApplicationService = getAgentTaskApplicationService();
      const tasks = await taskApplicationService.getAwaitingHumanTasks(currentOrg.id);

      return {
        success: true,
        data: tasks,
      };
    } catch (error) {
      console.error("Error fetching awaiting human tasks:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch awaiting human tasks",
      };
    }
  });
}

/**
 * Get tasks awaiting input from the current user
 * Used in the "My Tasks" tab of /tasks page
 */
export async function getMyAwaitingTasks(): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const currentOrg = await requireCurrentOrganization();
      const taskApplicationService = getAgentTaskApplicationService();

      // Get all awaiting human tasks and filter by current user assignment
      const allAwaitingTasks = await taskApplicationService.getAwaitingHumanTasks(currentOrg.id);

      // Filter tasks where current user is assigned
      const myTasks = allAwaitingTasks.filter(task => {
        if (!task.pendingHumanSteps || task.pendingHumanSteps.length === 0) {
          return false;
        }
        // Check if any pending step is assigned to current user
        return task.pendingHumanSteps.some(step =>
          !step.completedAt && step.assignedTo === session.user.id
        );
      });

      return {
        success: true,
        data: myTasks,
      };
    } catch (error) {
      console.error("Error fetching my awaiting tasks:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch my awaiting tasks",
      };
    }
  });
}

/**
 * Complete a human step on a task
 * This updates the pendingHumanSteps with outputs and sets task status back to pending
 * so the scheduler can pick it up and resume execution
 */
export async function completeHumanStep(
  taskId: string,
  stepId: string,
  outputs: Record<string, any>
): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const taskApplicationService = getAgentTaskApplicationService();

      // Get the task
      const task = await taskApplicationService.getTask(taskId);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Verify task is awaiting human input
      if (task.status !== 'awaiting_human') {
        return { success: false, error: 'Task is not awaiting human input' };
      }

      // Find the pending step
      const pendingStep = task.pendingHumanSteps?.find(
        (step: { stepId: string; completedAt?: string }) => step.stepId === stepId && !step.completedAt
      );
      if (!pendingStep) {
        return { success: false, error: 'Pending step not found or already completed' };
      }

      // Verify current user is assigned to this step
      if (pendingStep.assignedTo !== session.user.id) {
        // Also check for role-based assignment (e.g., "role:admin")
        // For now, we only support direct user assignment
        return { success: false, error: 'You are not assigned to this step' };
      }

      // Complete the human step via application service
      await taskApplicationService.completeHumanStep(taskId, stepId, outputs);

      // Audit log the human step completion
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(task.organizationId),
        {
          eventType: 'agent',
          eventCategory: 'task_lifecycle',
          eventAction: 'human_step_completed',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || session.user.email || undefined,
          resourceType: 'task',
          resourceId: taskId,
          resourceName: task.name,
          parentResourceType: task.agentId ? 'agent' : undefined,
          parentResourceId: task.agentId ? String(task.agentId) : undefined,
          eventData: {
            stepId,
            hasOutputs: Object.keys(outputs).length > 0,
          },
          success: true,
        }
      );

      // Get updated task
      const updatedTask = await taskApplicationService.getTask(taskId);

      revalidatePath('/tasks');
      revalidatePath('/dashboard');

      return {
        success: true,
        data: updatedTask,
      };
    } catch (error) {
      console.error("Error completing human step:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete human step",
      };
    }
  });
}

export async function uploadTaskAttachment(
  agentId: number,
  formData: FormData
): Promise<Result<{ url: string; s3Key: string; filename: string; mimeType: string; type: 'image' | 'document' }>> {
  return withAuthContext(async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const file = formData.get('file') as File;
      if (!file) {
        return { success: false, error: 'No file provided' };
      }

      // Get agent to retrieve organizationId
      const agentService = getAgentApplicationService();
      const agent = await agentService.getAgent(AgentId.fromNumber(agentId));
      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }

      // Determine file type
      const isImage = file.type.startsWith('image/');
      const attachmentType = isImage ? 'image' : 'document';

      // Generate S3 key using the shared path registry
      const fileId = uuidv4();
      const extension = file.name.split('.').pop() || 'bin';
      const sanitizedExt = extension.replace(/[^\w.-]/g, '_');
      const s3Key = getTaskAttachmentKey(agent.organizationId.value, agentId, fileId, sanitizedExt);

      // Upload to S3
      const buffer = Buffer.from(await file.arrayBuffer());
      const shouldUseEncryption = !process.env.S3_ENDPOINT_URL;

      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        ...(shouldUseEncryption && {
          ServerSideEncryption: 'AES256'
        })
      });

      await s3Client.send(putCommand);

      // Invalidate storage breakdown cache so recalculation picks up this upload
      invalidateOrgStorageCache(agent.organizationId.value);

      // Generate pre-signed URL
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      });

      const url = await getSignedUrl(s3Client, getCommand, {
        expiresIn: 3600 // 1 hour
      });

      // Audit log the attachment upload
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        agent.organizationId,
        {
          eventType: 'agent',
          eventCategory: 'task_attachment',
          eventAction: 'upload',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || session.user.email || undefined,
          resourceType: 'attachment',
          resourceId: s3Key,
          resourceName: file.name,
          parentResourceType: 'agent',
          parentResourceId: String(agentId),
          eventData: {
            agentId,
            filename: file.name,
            mimeType: file.type,
            attachmentType,
            s3Key,
          },
          success: true,
        }
      );

      return {
        success: true,
        data: {
          url,
          s3Key,
          filename: file.name,
          mimeType: file.type,
          type: attachmentType
        }
      };
    } catch (error) {
      console.error('[uploadTaskAttachment] error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload task attachment'
      };
    }
  });
}