#!/usr/bin/env npx tsx

// AIDEV-NOTE: Seeds RBAC system with permissions and system roles
// Run this after database migration to set up the basic permission system

import { db } from '../../lib/db/client';
import { permissions, roles, rolePermissions } from '../../lib/db/schema';
import { Permission } from '../../ddd/domain/shared/value-objects/permission';
import { SYSTEM_ROLES } from '../../ddd/domain/rbac/entities/role';
import { eq, and, sql } from 'drizzle-orm';

async function seedPermissions() {
  console.log('🌱 Seeding permissions...');
  
  const allPermissions = Permission.getAll();
  let created = 0;
  
  for (const permission of allPermissions) {
    try {
      await db
        .insert(permissions)
        .values({
          resource: permission.resource,
          action: permission.action,
          description: `${permission.action} ${permission.resource}`
        })
        .onConflictDoNothing();
      created++;
    } catch (error) {
      console.warn(`Failed to create permission ${permission.toString()}:`, error);
    }
  }
  
  console.log(`✅ Created ${created} permissions`);
}

async function seedSystemRoles() {
  console.log('🌱 Seeding system roles...');

  // First, dedupe any duplicate system roles (keeps the lowest ID for each name)
  // This is a one-time cleanup that can be removed after the next deployment
  console.log('  🧹 Cleaning up duplicate system roles...');
  const dedupeResult = await db.execute(sql`
    DELETE FROM roles r1
    USING roles r2
    WHERE r1.id > r2.id
      AND r1.name = r2.name
      AND r1.is_system = true
      AND r2.is_system = true
  `);
  console.log(`  🧹 Removed ${dedupeResult.rowCount ?? 0} duplicate system roles`);

  let created = 0;
  let skipped = 0;

  // Define system role permissions
  const systemRolePermissions = {
    [SYSTEM_ROLES.ORGANIZATION_OWNER]: [
      // Full access to everything
      Permission.ORGANIZATIONS_VIEW, Permission.ORGANIZATIONS_MANAGE,
      Permission.USERS_VIEW, Permission.USERS_MANAGE, Permission.USERS_INVITE,
      Permission.TEAMS_VIEW, Permission.TEAMS_MANAGE, Permission.TEAMS_CREATE,
      Permission.AGENTS_VIEW, Permission.AGENTS_MANAGE, Permission.AGENTS_CREATE, Permission.AGENTS_EXECUTE,
      Permission.TASKS_VIEW, Permission.TASKS_MANAGE, Permission.TASKS_CREATE, Permission.TASKS_EXECUTE,
      Permission.DATABASE_VIEW, Permission.DATABASE_MANAGE, Permission.DATABASE_CREATE,
      Permission.TABLE_VIEW, Permission.TABLE_MANAGE, Permission.TABLE_CREATE,
      Permission.VIEW_VIEW, Permission.VIEW_MANAGE, Permission.VIEW_CREATE,
      Permission.SKILLS_VIEW, Permission.SKILLS_MANAGE, Permission.SKILLS_CREATE, Permission.SKILLS_EXECUTE,
      Permission.APPS_VIEW, Permission.APPS_CREATE, Permission.APPS_MANAGE, Permission.APPS_PUBLISH,
      Permission.TEMPLATES_VIEW, Permission.TEMPLATES_MANAGE, Permission.TEMPLATES_CREATE
    ],
    
    [SYSTEM_ROLES.ORGANIZATION_ADMIN]: [
      // All except organization management
      Permission.ORGANIZATIONS_VIEW,
      Permission.USERS_VIEW, Permission.USERS_MANAGE, Permission.USERS_INVITE,
      Permission.TEAMS_VIEW, Permission.TEAMS_MANAGE, Permission.TEAMS_CREATE,
      Permission.AGENTS_VIEW, Permission.AGENTS_MANAGE, Permission.AGENTS_CREATE, Permission.AGENTS_EXECUTE,
      Permission.TASKS_VIEW, Permission.TASKS_MANAGE, Permission.TASKS_CREATE, Permission.TASKS_EXECUTE,
      Permission.DATABASE_VIEW, Permission.DATABASE_MANAGE, Permission.DATABASE_CREATE,
      Permission.TABLE_VIEW, Permission.TABLE_MANAGE, Permission.TABLE_CREATE,
      Permission.VIEW_VIEW, Permission.VIEW_MANAGE, Permission.VIEW_CREATE,
      Permission.SKILLS_VIEW, Permission.SKILLS_MANAGE, Permission.SKILLS_CREATE, Permission.SKILLS_EXECUTE,
      Permission.APPS_VIEW, Permission.APPS_CREATE, Permission.APPS_MANAGE, Permission.APPS_PUBLISH,
      Permission.TEMPLATES_VIEW, Permission.TEMPLATES_MANAGE, Permission.TEMPLATES_CREATE
    ],
    
    [SYSTEM_ROLES.TEAM_LEAD]: [
      // Team management + execution
      Permission.ORGANIZATIONS_VIEW, Permission.USERS_VIEW,
      Permission.TEAMS_VIEW, Permission.TEAMS_MANAGE,
      Permission.AGENTS_VIEW, Permission.AGENTS_MANAGE, Permission.AGENTS_CREATE, Permission.AGENTS_EXECUTE,
      Permission.TASKS_VIEW, Permission.TASKS_MANAGE, Permission.TASKS_CREATE, Permission.TASKS_EXECUTE,
      Permission.DATABASE_VIEW, Permission.DATABASE_MANAGE, Permission.DATABASE_CREATE,
      Permission.TABLE_VIEW, Permission.TABLE_MANAGE, Permission.TABLE_CREATE,
      Permission.VIEW_VIEW, Permission.VIEW_MANAGE, Permission.VIEW_CREATE,
      Permission.SKILLS_VIEW, Permission.SKILLS_MANAGE, Permission.SKILLS_CREATE, Permission.SKILLS_EXECUTE,
      Permission.APPS_VIEW, Permission.APPS_CREATE, Permission.APPS_MANAGE, Permission.APPS_PUBLISH,
      Permission.TEMPLATES_VIEW, Permission.TEMPLATES_MANAGE, Permission.TEMPLATES_CREATE
    ],
    
    [SYSTEM_ROLES.MEMBER]: [
      // View + execute + create own resources
      Permission.ORGANIZATIONS_VIEW, Permission.USERS_VIEW, Permission.TEAMS_VIEW,
      Permission.AGENTS_VIEW, Permission.AGENTS_CREATE, Permission.AGENTS_EXECUTE,
      Permission.TASKS_VIEW, Permission.TASKS_CREATE, Permission.TASKS_EXECUTE,
      Permission.DATABASE_VIEW, Permission.DATABASE_CREATE,
      Permission.TABLE_VIEW, Permission.TABLE_CREATE,
      Permission.VIEW_VIEW, Permission.VIEW_CREATE,
      Permission.SKILLS_VIEW, Permission.SKILLS_EXECUTE,
      Permission.APPS_VIEW, Permission.APPS_CREATE,
      Permission.TEMPLATES_VIEW, Permission.TEMPLATES_CREATE
    ],
    
    [SYSTEM_ROLES.VIEWER]: [
      // Read-only access
      Permission.ORGANIZATIONS_VIEW, Permission.USERS_VIEW, Permission.TEAMS_VIEW,
      Permission.AGENTS_VIEW, Permission.TASKS_VIEW,
      Permission.DATABASE_VIEW, Permission.TABLE_VIEW, Permission.VIEW_VIEW,
      Permission.SKILLS_VIEW, Permission.APPS_VIEW, Permission.TEMPLATES_VIEW
    ],
    
    [SYSTEM_ROLES.SYSTEM_SERVICE]: [
      // System service permissions for scheduler and other system processes
      Permission.ORGANIZATIONS_VIEW,
      Permission.AGENTS_VIEW, Permission.AGENTS_MANAGE, 
      Permission.TEAMS_VIEW, Permission.TEAMS_MANAGE,
      Permission.TASKS_VIEW, Permission.TASKS_MANAGE, Permission.TASKS_EXECUTE,
      Permission.DATABASE_VIEW, Permission.DATABASE_MANAGE,
      Permission.TABLE_VIEW, Permission.TABLE_MANAGE,
      Permission.VIEW_VIEW, Permission.VIEW_MANAGE,
      Permission.USERS_VIEW // For indexing user data
    ]
  };

  for (const [roleName, systemRolePerms] of Object.entries(systemRolePermissions)) {
    try {
      // Check if system role already exists by name
      const existing = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.name, roleName), eq(roles.isSystem, true)))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ⏭️  Skipping "${roleName}" (already exists with id=${existing[0].id})`);
        skipped++;
        continue;
      }

      // Create the role
      const [role] = await db
        .insert(roles)
        .values({
          name: roleName,
          description: `System role: ${roleName}`,
          organizationId: null, // System roles are global
          isSystem: true,
          type: 'system'
        })
        .returning();

      if (role) {
        // Get permission IDs
        const permissionIds = await Promise.all(
          systemRolePerms.map(async (permission) => {
            const result = await db
              .select({ id: permissions.id })
              .from(permissions)
              .where(and(
                eq(permissions.resource, permission.resource),
                eq(permissions.action, permission.action)
              ))
              .limit(1);

            return result[0]?.id;
          })
        );

        // Filter out any null IDs and assign permissions to role
        const validPermissionIds = permissionIds.filter(id => id !== undefined);
        if (validPermissionIds.length > 0) {
          await db
            .insert(rolePermissions)
            .values(validPermissionIds.map(permissionId => ({
              roleId: role.id,
              permissionId: permissionId!
            })))
            .onConflictDoNothing();
        }

        console.log(`  ✅ Created system role: ${roleName} with ${validPermissionIds.length} permissions`);
        created++;
      }
    } catch (error) {
      console.warn(`Failed to create system role ${roleName}:`, error);
    }
  }

  console.log(`\n✅ System roles seeding complete: ${created} created, ${skipped} skipped`);
}

async function main() {
  try {
    console.log('🚀 Starting RBAC seeding...');
    
    await seedPermissions();
    await seedSystemRoles();
    
    console.log('✅ RBAC seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ RBAC seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedPermissions, seedSystemRoles };