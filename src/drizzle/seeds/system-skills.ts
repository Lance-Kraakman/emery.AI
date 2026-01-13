#!/usr/bin/env npx tsx

// AIDEV-NOTE: Seeds system skills into the database
// System skills are created for each organization (isSystem = true, agentId = null)
// They cannot be deleted by users but can be duplicated to create custom versions

import { db } from '@/ddd/infrastructure/db/client';
import { skills, organizations } from '@/ddd/infrastructure/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

// System skill definitions
// These skills are always available and provide common operations for agent delegation
const SYSTEM_SKILLS = [
  {
    name: "Table Operations",
    description: "Fetch, filter, and aggregate data from tables. Use this skill to retrieve and query table data.",
    instructions: `You are a data retrieval specialist. Given a query about table data:

1. First, use emery-list-tables() to find available tables
2. Identify which table(s) contain the requested data
3. Use emery-get-rows(table_id=X) with appropriate filters to fetch the data
4. Format and return the results clearly

Always verify the table exists before attempting to fetch rows.
If the requested data is not found, report what you searched and suggest alternatives.

**Output:** Set {data} to the retrieved results:
{data} = [your formatted results here]`,
    tools: [
      { name: "emery-list-tables", config: {} },
      { name: "emery-get-rows", config: {} },
      { name: "emery-read-table", config: {} }
    ],
    inputs: [
      { name: "query", required: true, type: "text" as const }
    ],
    outputs: [
      { name: "data", type: "text" as const }
    ],
    executionType: 'agentic' as const
  },
  {
    name: "Document Operations",
    description: "Create, read, and update TipTap documents. Use this skill for document management tasks.",
    instructions: `You are a document specialist. Given a document-related request:

1. For reading: Use emery-list-documents() to find documents, then emery-read-document(document_id=X, table_id=Y, field_id=Z) to get content
2. For creating: Use emery-create-document(table_id=X, field_id=Y, title="...") with the provided content
3. For updating: First read the existing document, then use emery-update-document(document_id=X, table_id=Y, field_id=Z, data={...})

Always return the document ID and confirmation of the action taken.
Format document content appropriately for TipTap editor.

**Output:** Set {result} to confirmation of what was done:
{result} = "Document [ID] successfully [action taken]"`,
    tools: [
      { name: "emery-list-documents", config: {} },
      { name: "emery-read-document", config: {} },
      { name: "emery-create-document", config: {} },
      { name: "emery-update-document", config: {} }
    ],
    inputs: [
      { name: "request", required: true, type: "text" as const }
    ],
    outputs: [
      { name: "result", type: "text" as const }
    ],
    executionType: 'agentic' as const
  },
  {
    name: "Data Lookup",
    description: "Find specific records and resolve references across tables. Use for ID lookups and cross-referencing.",
    instructions: `You help find specific records by description. Given a lookup request:

1. Parse what the user is looking for (table name, record characteristics)
2. Use emery-list-tables() to find relevant tables
3. Search tables using emery-get-rows(table_id=X) with filters
4. Return matching IDs and key identifying information

Be specific about which table and row you found. Include the numeric ID in your response.
If multiple matches exist, list them all with distinguishing details.

**Output:** Set {found} to the matching records:
{found} = "Found [description] with ID [X] in table [name]"`,
    tools: [
      { name: "emery-list-tables", config: {} },
      { name: "emery-get-rows", config: {} }
    ],
    inputs: [
      { name: "description", required: true, type: "text" as const }
    ],
    outputs: [
      { name: "found", type: "text" as const }
    ],
    executionType: 'agentic' as const
  }
];

// This should likely be an update-or-insert operation in the future
export async function seedSystemSkills() {
  console.log('🌱 Seeding system skills...');

  // First, dedupe any duplicate system skills (keeps the lowest ID for each org+name combo)
  // This is a one-time cleanup that can be removed after the next deployment
  console.log('  🧹 Cleaning up duplicate system skills...');
  const dedupeResult = await db.execute(sql`
    DELETE FROM skills s1
    USING skills s2
    WHERE s1.id > s2.id
      AND s1.organization_id = s2.organization_id
      AND s1.name = s2.name
      AND s1.is_system = true
      AND s2.is_system = true
      AND s1.agent_id IS NULL
      AND s2.agent_id IS NULL
  `);
  console.log(`  🧹 Removed ${dedupeResult.rowCount ?? 0} duplicate system skills`);

  // Data migration: rename execution_type 'agent' → 'agentic'
  // This is idempotent - safe to run multiple times
  console.log('  🔄 Migrating execution_type: agent → agentic...');
  const migrateResult = await db.execute(sql`
    UPDATE skills
    SET execution_type = 'agentic'
    WHERE execution_type = 'agent'
  `);
  console.log(`  ✅ Migrated ${migrateResult.rowCount ?? 0} skills`);

  // Get all organizations
  const allOrgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  console.log(`📦 Found ${allOrgs.length} organizations`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const org of allOrgs) {
    console.log(`\n📁 Processing organization: ${org.name} (${org.id})`);

    let created = 0;
    let skipped = 0;

    for (const skillDef of SYSTEM_SKILLS) {
      try {
        // Check if this system skill already exists for this organization
        const existing = await db
          .select({ id: skills.id })
          .from(skills)
          .where(
            and(
              eq(skills.organizationId, org.id),
              eq(skills.name, skillDef.name),
              eq(skills.isSystem, true),
              isNull(skills.agentId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          console.log(`  ⏭️  Skipping "${skillDef.name}" (already exists)`);
          skipped++;
          continue;
        }

        await db.insert(skills).values({
          organizationId: org.id,
          agentId: null, // Organization-level skill
          ownerId: null, // System skills have no owner
          name: skillDef.name,
          description: skillDef.description,
          instructions: skillDef.instructions,
          tools: skillDef.tools,
          inputs: skillDef.inputs,
          outputs: skillDef.outputs,
          executionType: skillDef.executionType,
          isSystem: true,
        });

        console.log(`  ✅ Created "${skillDef.name}"`);
        created++;
      } catch (error) {
        console.error(`  ❌ Failed to create "${skillDef.name}":`, error);
      }
    }

    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log(`\n✅ Seeding complete: ${totalCreated} created, ${totalSkipped} skipped across ${allOrgs.length} organizations`);
}

// Run if called directly
if (require.main === module) {
  seedSystemSkills()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}