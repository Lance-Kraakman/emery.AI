'use server'

import { db } from "@/lib/db/client";
import { workers, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import type { ActionResult, CreateWorkerData } from "./types";

// Simple API key generator
function generateApiKey(): string {
  return 'wk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function createWorker(data: CreateWorkerData): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_workers");
    const { name, type, capabilities, status, roleId } = data;

    if (!name || !type) {
      return {
        success: false,
        error: "Worker name and type are required",
      };
    }

    const [newWorker] = await db.insert(workers).values({
      name,
      type,
      capabilities,
      status: status || "active",
      organizationId: session.user.organizationId,
      roleId: roleId || null,
      apiKey: generateApiKey(),
    }).returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newWorker,
    };
  } catch (error) {
    console.error("Error creating worker:", error);
    return {
      success: false,
      error: "Failed to create worker",
    };
  }
}

export async function createWorkerAction(formData: FormData) {
  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const status = formData.get('status') as string;
  const capabilitiesStr = formData.get('capabilities') as string;
  
  const capabilities = capabilitiesStr ? capabilitiesStr.split(',').map(c => c.trim()) : undefined;

  const result = await createWorker({ name, type, capabilities, status });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getWorkers() {
  try {
    const allWorkers = await db
      .select()
      .from(workers);

    return allWorkers;
  } catch (error) {
    console.error("Error fetching workers:", error);
    throw new Error("Failed to fetch workers");
  }
}

export async function getWorker(workerId: number) {
  try {
    if (!workerId) {
      throw new Error("workerId is required");
    }

    const [worker] = await db
      .select()
      .from(workers)
      .where(eq(workers.id, workerId));

    return worker;
  } catch (error) {
    console.error("Error fetching worker:", error);
    throw new Error("Failed to fetch worker");
  }
}

export async function updateWorker(workerId: number, data: Partial<CreateWorkerData>): Promise<ActionResult> {
  try {
    if (!workerId) {
      return {
        success: false,
        error: "workerId is required",
      };
    }

    const [updatedWorker] = await db
      .update(workers)
      .set(data)
      .where(eq(workers.id, workerId))
      .returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedWorker,
    };
  } catch (error) {
    console.error("Error updating worker:", error);
    return {
      success: false,
      error: "Failed to update worker",
    };
  }
}

export async function deleteWorker(workerId: number): Promise<ActionResult> {
  try {
    if (!workerId) {
      return {
        success: false,
        error: "workerId is required",
      };
    }

    await db.delete(workers).where(eq(workers.id, workerId));

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Worker deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting worker:", error);
    return {
      success: false,
      error: "Failed to delete worker",
    };
  }
}