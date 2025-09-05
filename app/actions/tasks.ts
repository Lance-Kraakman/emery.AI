'use server'

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import type { Result, CreateTaskData } from "./types";
import { getAgentTaskApplicationService, getAgentApplicationService } from "@/ddd/application/di/container";
import type { CreateTaskRequest } from "@/ddd/application/services/agents/agent-task-application-service";
import { AgentId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export async function createTask(data: CreateTaskData): Promise<Result> {
  try {
    const session = await requirePermission("manage_agents");
    const currentOrg = await requireCurrentOrganization();
    const { agentId, name, capabilityName, instructions, createdBy } = data;

    if (!name || !instructions?.instructions) {
      return {
        success: false,
        error: "Task name and instructions are required",
      };
    }

    // Agent permissions are now enforced at database level via RLS policies
    // No need for application-level ownership checks

    // Create task using application service
    const taskApplicationService = getAgentTaskApplicationService();
    const createRequest: CreateTaskRequest = {
      agentId,
      name,
      instructions,
      capabilityName,
      createdBy: createdBy || session.user.id,
      organizationId: currentOrg.id.value
    };

    const task = await taskApplicationService.createTask(createRequest);

    // Convert domain entity to database schema type for frontend compatibility
    const convertedTask = {
      id: task.id,
      agentId: task.agentId,
      organizationId: task.organizationId,
      name: task.name,
      capabilityName: task.capabilityName,
      instructions: task.instructions,
      status: task.status,
      result: task.result,
      error: task.error,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      createdBy: task.createdBy,
      createdAt: task.createdAt
    };

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: convertedTask,
    };
  } catch (error) {
    console.error("Error creating task:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}

export async function getTasks(agentId?: number, limit = 50): Promise<Result> {
  try {
    await requirePermission("manage_agents");
    const currentOrg = await requireCurrentOrganization();

    const taskApplicationService = getAgentTaskApplicationService();
    let domainTasks;

    if (agentId) {
      domainTasks = await taskApplicationService.getTasksForAgent(agentId);
    } else {
      domainTasks = await taskApplicationService.getRecentTasksForOrganization(currentOrg.id.value, limit);
    }

    // Convert domain entities to database schema types for frontend compatibility
    const convertedTasks = domainTasks.map(task => ({
      id: task.id,
      agentId: task.agentId,
      organizationId: task.organizationId,
      name: task.name,
      capabilityName: task.capabilityName,
      instructions: task.instructions,
      status: task.status,
      result: task.result,
      error: task.error,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      createdBy: task.createdBy,
      createdAt: task.createdAt
    }));

    return {
      success: true,
      data: convertedTasks,
    };
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return {
      success: false,
      error: "Failed to fetch tasks",
    };
  }
}

export async function getTask(taskId: string): Promise<Result> {
  try {
    await requirePermission("manage_agents");

    const taskApplicationService = getAgentTaskApplicationService();
    const domainTask = await taskApplicationService.getTask(taskId);

    if (!domainTask) {
      return {
        success: false,
        error: "Task not found",
      };
    }

    // Convert domain entity to database schema type for frontend compatibility
    const convertedTask = {
      id: domainTask.id,
      agentId: domainTask.agentId,
      organizationId: domainTask.organizationId,
      name: domainTask.name,
      capabilityName: domainTask.capabilityName,
      instructions: domainTask.instructions,
      status: domainTask.status,
      result: domainTask.result,
      error: domainTask.error,
      startedAt: domainTask.startedAt,
      completedAt: domainTask.completedAt,
      createdBy: domainTask.createdBy,
      createdAt: domainTask.createdAt
    };

    return {
      success: true,
      data: convertedTask,
    };
  } catch (error) {
    console.error("Error fetching task:", error);
    return {
      success: false,
      error: "Failed to fetch task",
    };
  }
}

export async function updateTaskStatus(
  taskId: string, 
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout',
  result?: any,
  error?: string
): Promise<Result> {
  try {
    await requirePermission("manage_agents");

    const taskApplicationService = getAgentTaskApplicationService();
    
    // For cancelled status, use the cancel method
    if (status === 'cancelled') {
      await taskApplicationService.cancelTask(taskId, error || 'Cancelled by user');
    } else {
      // For other status changes, we need to get the task and use domain methods
      // Note: This is a simplified approach - in a real scenario, you might want 
      // to add status update methods to the application service
      const domainTask = await taskApplicationService.getTask(taskId);
      
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
        // Note: Accessing repository directly from application service would be cleaner
        // but this approach works for now
        await (taskApplicationService as any).taskRepository.save(domainTask);
      } catch (domainError) {
        return {
          success: false,
          error: domainError instanceof Error ? domainError.message : 'Invalid status transition',
        };
      }
    }

    // Get the updated task
    const updatedDomainTask = await taskApplicationService.getTask(taskId);
    
    if (!updatedDomainTask) {
      return {
        success: false,
        error: "Failed to retrieve updated task",
      };
    }

    // Convert domain entity to database schema type for frontend compatibility
    const convertedTask = {
      id: updatedDomainTask.id,
      agentId: updatedDomainTask.agentId,
      organizationId: updatedDomainTask.organizationId,
      name: updatedDomainTask.name,
      capabilityName: updatedDomainTask.capabilityName,
      instructions: updatedDomainTask.instructions,
      status: updatedDomainTask.status,
      result: updatedDomainTask.result,
      error: updatedDomainTask.error,
      startedAt: updatedDomainTask.startedAt,
      completedAt: updatedDomainTask.completedAt,
      createdBy: updatedDomainTask.createdBy,
      createdAt: updatedDomainTask.createdAt
    };

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: convertedTask,
    };
  } catch (error) {
    console.error("Error updating task status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update task status",
    };
  }
}

export async function deleteTask(taskId: string): Promise<Result> {
  try {
    await requirePermission("manage_agents");

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
}

export async function getTaskStats(agentId?: number): Promise<Result> {
  try {
    await requirePermission("manage_agents");
    const currentOrg = await requireCurrentOrganization();

    const taskApplicationService = getAgentTaskApplicationService();
    let domainTasks;

    if (agentId) {
      domainTasks = await taskApplicationService.getTasksForAgent(agentId);
    } else {
      domainTasks = await taskApplicationService.getTasksForOrganization(currentOrg.id.value);
    }
    
    const stats = {
      total: domainTasks.length,
      pending: domainTasks.filter(t => t.status.value === 'pending').length,
      in_progress: domainTasks.filter(t => t.status.value === 'in_progress').length,
      completed: domainTasks.filter(t => t.status.value === 'completed').length,
      failed: domainTasks.filter(t => t.status.value === 'failed').length,
      cancelled: domainTasks.filter(t => t.status.value === 'cancelled').length,
      timeout: domainTasks.filter(t => t.status.value === 'timeout').length,
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
}