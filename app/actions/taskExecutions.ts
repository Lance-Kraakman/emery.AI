'use server'

import { db } from "@/lib/db/client";
import { taskExecutions, stepExecutions, agents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission } from "./permissions";
import type { ActionResult } from "./types";

export async function getTaskExecutions(limit = 50): Promise<ActionResult> {
  try {
    await requirePermission("view_agents");

    const executions = await db
      .select()
      .from(taskExecutions)
      .orderBy(desc(taskExecutions.startedAt))
      .limit(limit);

    return {
      success: true,
      data: executions,
    };
  } catch (error) {
    console.error("Error fetching task executions:", error);
    return {
      success: false,
      error: "Failed to fetch task executions",
    };
  }
}

export async function getTaskExecutionsByAgent(agentId: number, limit = 50): Promise<ActionResult> {
  try {
    await requirePermission("view_agents");

    const executions = await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.agentId, agentId))
      .orderBy(desc(taskExecutions.startedAt))
      .limit(limit);

    return {
      success: true,
      data: executions,
    };
  } catch (error) {
    console.error("Error fetching agent task executions:", error);
    return {
      success: false,
      error: "Failed to fetch agent task executions",
    };
  }
}

export async function getTaskExecutionWithSteps(executionId: string): Promise<ActionResult> {
  try {
    await requirePermission("view_agents");

    // Get task execution
    const [execution] = await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.id, executionId))
      .limit(1);

    if (!execution) {
      return {
        success: false,
        error: "Task execution not found",
      };
    }

    // Get step executions
    const steps = await db
      .select()
      .from(stepExecutions)
      .where(eq(stepExecutions.taskExecutionId, executionId))
      .orderBy(stepExecutions.startedAt);

    return {
      success: true,
      data: {
        execution,
        steps,
      },
    };
  } catch (error) {
    console.error("Error fetching task execution details:", error);
    return {
      success: false,
      error: "Failed to fetch task execution details",
    };
  }
}

export async function getTaskExecutionStats(): Promise<ActionResult> {
  try {
    await requirePermission("view_agents");

    // Get execution counts by status
    const executions = await db.select().from(taskExecutions);
    
    const stats = {
      total: executions.length,
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      in_progress: executions.filter(e => e.status === 'in_progress').length,
      pending: executions.filter(e => e.status === 'pending').length,
    };

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("Error fetching task execution stats:", error);
    return {
      success: false,
      error: "Failed to fetch task execution stats",
    };
  }
}