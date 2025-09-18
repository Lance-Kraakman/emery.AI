#!/usr/bin/env npx tsx

// AIDEV-NOTE: Fix script to ensure all users in userOrganizations have corresponding user_roles entries
// This is needed after the RBAC migration where user_roles creation was missing

import { db } from '../src/lib/db/client';
import { userOrganizations, roles, userRoles } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function fixUserRoles() {
  console.log('🔧 Fixing missing user_roles entries...');
  
  try {
    // Get all userOrganization entries
    const userOrgEntries = await db.select().from(userOrganizations);
    console.log(`Found ${userOrgEntries.length} user-organization relationships`);
    
    // Get the Member system role (default role)
    const memberRole = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.name, 'Member'),
        eq(roles.isSystem, true)
      ))
      .limit(1);
    
    if (memberRole.length === 0) {
      console.error('❌ System role "Member" not found. Please run RBAC seed first.');
      process.exit(1);
    }
    
    const memberRoleId = memberRole[0].id;
    console.log(`Using Member role (ID: ${memberRoleId}) as default`);
    
    let created = 0;
    let skipped = 0;
    
    // For each userOrganization, ensure there's a corresponding user_role
    for (const userOrg of userOrgEntries) {
      // Check if user_role already exists
      const existingRole = await db
        .select()
        .from(userRoles)
        .where(and(
          eq(userRoles.userId, userOrg.userId),
          eq(userRoles.organizationId, userOrg.organizationId)
        ))
        .limit(1);
      
      if (existingRole.length === 0) {
        // Create missing user_role entry
        await db
          .insert(userRoles)
          .values({
            userId: userOrg.userId,
            roleId: memberRoleId,
            organizationId: userOrg.organizationId,
            assignedAt: new Date()
          });
        
        console.log(`✅ Created role for user ${userOrg.userId} in org ${userOrg.organizationId}`);
        created++;
      } else {
        skipped++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`- Created: ${created} new user_roles entries`);
    console.log(`- Skipped: ${skipped} (already had roles)`);
    console.log(`- Total: ${userOrgEntries.length} user-organization relationships`);
    
    console.log('\n✅ User roles fix completed successfully!');
  } catch (error) {
    console.error('❌ Error fixing user roles:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if this is the main module
if (require.main === module) {
  fixUserRoles();
}