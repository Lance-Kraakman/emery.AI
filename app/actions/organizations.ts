"use server";

import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateOrganizationViewConfig(organizationId: number, viewConfig: any) {
  try {
    await db
      .update(organizations)
      .set({ viewConfig })
      .where(eq(organizations.id, organizationId));

    revalidatePath(`/organization`);
    
    return { success: true };
  } catch (error) {
    console.error("Failed to update organization view config:", error);
    return { success: false, error: "Failed to update view configuration." };
  }
}
