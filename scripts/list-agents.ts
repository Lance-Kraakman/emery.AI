import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";

async function listAgents() {
  try {
    console.log("Fetching agents from the database...");
    const allAgents = await db.select().from(agents);
    console.log("Agents found:", allAgents);
  } catch (error) {
    console.error("Error fetching agents:", error);
  }
}

listAgents();
