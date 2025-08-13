import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function deleteDuplicateAgents() {
  try {
    console.log("Fetching agents from the database...");
    const allAgents = await db.select().from(agents);
    const agentsToDelete = allAgents.slice(1);
    if (agentsToDelete.length > 0) {
      console.log("Deleting duplicate agents...");
      for (const agent of agentsToDelete) {
        await db.delete(agents).where(eq(agents.id, agent.id));
      }
      console.log("Duplicate agents deleted successfully.");
    } else {
      console.log("No duplicate agents found.");
    }
  } catch (error) {
    console.error("Error deleting duplicate agents:", error);
  }
}

deleteDuplicateAgents();
