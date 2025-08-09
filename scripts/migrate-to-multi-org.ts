import { db } from "@/lib/db/client";
import { users, organizations, userOrganizations } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

/**
 * Migration script to convert single-organization model to multi-organization model
 * This script:
 * 1. Creates the user_organizations table
 * 2. Renames organization_id to current_organization_id in users table  
 * 3. Populates user_organizations with existing user-org relationships
 * 4. Sets all existing users as "owner" of their organizations
 */

async function migrateToMultiOrg() {
  console.log("🚀 Starting migration to multi-organization model...");

  try {
    // Step 1: Create user_organizations table if it doesn't exist
    console.log("📋 Creating user_organizations table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_organizations" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" uuid NOT NULL,
        "organization_id" integer NOT NULL,
        "role" text DEFAULT 'member' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);

    // Step 2: Add constraints
    await db.execute(sql`
      ALTER TABLE "user_organizations" 
      ADD CONSTRAINT "user_organizations_user_id_users_id_fk" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
    `);

    await db.execute(sql`
      ALTER TABLE "user_organizations" 
      ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
    `);

    console.log("✅ user_organizations table created successfully");

    // Step 3: Rename organization_id to current_organization_id in users table
    console.log("🔄 Renaming organization_id to current_organization_id in users table...");
    await db.execute(sql`
      ALTER TABLE "users" 
      RENAME COLUMN "organization_id" TO "current_organization_id";
    `);
    console.log("✅ Column renamed successfully");

    // Step 4: Migrate existing data
    console.log("📊 Migrating existing user-organization relationships...");
    
    // Get all users with their current organization
    const existingUsers = await db.execute(sql`
      SELECT id, current_organization_id 
      FROM users 
      WHERE current_organization_id IS NOT NULL
    `);

    console.log(`📈 Found ${existingUsers.rowCount} users with organization assignments`);

    // Insert into user_organizations with "owner" role (since these are existing users)
    for (const user of existingUsers.rows) {
      await db.execute(sql`
        INSERT INTO user_organizations (user_id, organization_id, role)
        VALUES (${user.id}, ${user.current_organization_id}, 'owner')
        ON CONFLICT DO NOTHING
      `);
    }

    console.log("✅ User-organization relationships migrated successfully");

    // Step 5: Verify migration
    const userOrgCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM user_organizations
    `);
    
    console.log(`📊 Migration Summary:`);
    console.log(`   - user_organizations records created: ${userOrgCount.rows[0].count}`);
    console.log(`   - Users migrated: ${existingUsers.rowCount}`);
    
    console.log("🎉 Migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrateToMultiOrg()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateToMultiOrg };