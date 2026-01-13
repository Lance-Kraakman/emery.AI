#!/usr/bin/env tsx

/**
 * System Role Assignments
 * 
 * Assigns the system user to the System Service role in all organizations.
 * This gives the scheduler access to perform operations across all organizations.
 */

import { db } from '@/ddd/infrastructure/db/client';
import { userRoles, organizations, roles } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';
import { SYSTEM_USER_ID_VALUE } from '@/ddd/infrastructure/db/system-context';

export async function seedSystemRoleAssignments() {
  console.log('🔐 Assigning system user to System Service role in all organizations...');

  try {
    // Get the System Service role
    const systemServiceRoles = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, SYSTEM_ROLES.SYSTEM_SERVICE));

    if (systemServiceRoles.length === 0) {
      throw new Error('System Service role not found. Please run RBAC seeding first.');
    }

    const systemServiceRoleId = systemServiceRoles[0].id;

    // Get all organizations
    const allOrganizations = await db
      .select({ id: organizations.id })
      .from(organizations);

    console.log(`Found ${allOrganizations.length} organizations`);

    if (allOrganizations.length === 0) {
      console.log('⚠️  No organizations found - system user will be assigned via database trigger when organizations are created');
      console.log('✅ System role assignments setup completed (no organizations to assign to yet)');
      return;
    }

    // Assign system user to System Service role in each organization
    let assigned = 0;
    for (const org of allOrganizations) {
      try {
        await db
          .insert(userRoles)
          .values({
            userId: SYSTEM_USER_ID_VALUE,
            roleId: systemServiceRoleId,
            organizationId: org.id
          })
          .onConflictDoNothing();
        assigned++;
        console.log(`   ✅ Assigned system user to organization ${org.id}`);
      } catch (error) {
        console.warn(`   ❌ Failed to assign system user to organization ${org.id}:`, error);
      }
    }

    console.log(`✅ Assigned system user to System Service role in ${assigned}/${allOrganizations.length} organizations`);
    console.log('✅ System role assignments completed successfully!');

  } catch (error) {
    console.error('❌ Failed to assign system roles:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedSystemRoleAssignments()
    .then(() => {
      console.log('🎉 System role assignments completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 System role assignments failed:', error);
      process.exit(1);
    });
}