'use server'

import { db } from "@/lib/db/client";
import { tasks, agents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import type { ActionResult, CreateTaskData } from "./types";

export async function createTask(data: CreateTaskData): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_agents");
    const { agentId, name, capabilityName, instructions, createdBy } = data;

    if (!name || !instructions?.instructions) {
      return {
        success: false,
        error: "Task name and instructions are required",
      };
    }

    // Verify the agent exists and user has access
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return {
        success: false,
        error: "Agent not found",
      };
    }

    if (agent.ownerId !== session.user.id) {
      return {
        success: false,
        error: "Access denied: You can only create tasks for agents you own",
      };
    }

    const [newTask] = await db.insert(tasks).values({
      agentId,
      name,
      capabilityName: capabilityName || null, // Allow null for auto-routing
      instructions,
      status: "pending",
      createdBy: createdBy || session.user.id,
    }).returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newTask,
    };
  } catch (error) {
    console.error("Error creating task:", error);
    return {
      success: false,
      error: "Failed to create task",
    };
  }
}

export async function getTasks(agentId?: number, limit = 50): Promise<ActionResult> {
  try {
    await requirePermission("manage_agents");

    const query = db.select().from(tasks);
    
    if (agentId) {
      query.where(eq(tasks.agentId, agentId));
    }
    
    const allTasks = await query
      .orderBy(desc(tasks.createdAt))
      .limit(limit);

    return {
      success: true,
      data: allTasks,
    };
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return {
      success: false,
      error: "Failed to fetch tasks",
    };
  }
}

export async function getTask(taskId: string): Promise<ActionResult> {
  try {
    await requirePermission("manage_agents");

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      return {
        success: false,
        error: "Task not found",
      };
    }

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
}

export async function updateTaskStatus(
  taskId: string, 
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout',
  result?: any,
  error?: string
): Promise<ActionResult> {
  try {
    await requirePermission("manage_agents");

    const updateData: any = { status };
    
    if (status === 'in_progress') {
      updateData.startedAt = new Date();
    }
    
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(status)) {
      updateData.completedAt = new Date();
    }
    
    if (result) {
      updateData.result = result;
    }
    
    if (error) {
      updateData.error = error;
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedTask,
    };
  } catch (error) {
    console.error("Error updating task status:", error);
    return {
      success: false,
      error: "Failed to update task status",
    };
  }
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  try {
    await requirePermission("manage_agents");

    if (!taskId) {
      return {
        success: false,
        error: "Task ID is required",
      };
    }

    
    // Delete the task
    await db.delete(tasks).where(eq(tasks.id, taskId));

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Task deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting task:", error);
    return {
      success: false,
      error: "Failed to delete task",
    };
  }
}

export async function getTaskStats(agentId?: number): Promise<ActionResult> {
  try {
    await requirePermission("manage_agents");

    const query = db.select().from(tasks);
    
    if (agentId) {
      query.where(eq(tasks.agentId, agentId));
    }
    
    const allTasks = await query;
    
    const stats = {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      in_progress: allTasks.filter(t => t.status === 'in_progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length,
      timeout: allTasks.filter(t => t.status === 'timeout').length,
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