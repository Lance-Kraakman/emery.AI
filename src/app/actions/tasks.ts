'use server'

import { revalidatePath } from "next/cache";
import { requirePermission, requireResourcePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import type { Result, CreateTaskData } from "./types";
import { getAgentTaskApplicationService, getAgentApplicationService } from "@/ddd/application/di/container";
import type { CreateTaskDTO } from "@/app/dtos/task.dto";
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
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
        organizationId: currentOrg.id
      };

      const result = await taskApplicationService.createTask(createDTO);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to create task"
        };
      }

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
      await requirePermission("tasks:manage");

    if (!taskId) {
      return {
        success: false,
        error: "Task ID is required",
      };
    }

    const taskApplicationService = getAgentTaskApplicationService();
    
    // Verify task exists
    const task = await taskApplicationService.getTask(taskId);
    if (!task) {
      return {
        success: false,
        error: "Task not found",
      };
    }

    // Delete through the repository
    // Note: Ideally this would be a method on the application service
    await (taskApplicationService as any).taskRepository.delete(taskId);

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
export async function uploadTaskAttachment(
  agentId: number,
  formData: FormData
): Promise<Result<{ url: string; s3Key: string; filename: string; mimeType: string; type: 'image' | 'document' }>> {
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

    // Generate S3 key: task-attachments/{org_id}/{agent_id}/{uuid}.{ext}
    const fileId = uuidv4();
    const extension = file.name.split('.').pop() || 'bin';
    const sanitizedExt = extension.replace(/[^\w.-]/g, '_');
    const s3Key = `task-attachments/${agent.organizationId.value}/${agentId}/${fileId}.${sanitizedExt}`;

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const shouldUseEncryption = !process.env.AWS_ENDPOINT_URL;

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

    // Generate pre-signed URL
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    });

    const url = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 3600 // 1 hour
    });

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
}