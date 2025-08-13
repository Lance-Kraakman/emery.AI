import { db } from "../lib/db/client";
import { users, roles, organizations } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function checkUsers() {
  try {
    console.log('👥 Checking users and their role assignments...\n');
    
    // Get all users with their roles and organizations
    const allUsers = await db.select({
      user: users,
      role: roles,
      organization: organizations
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(organizations, eq(users.currentOrganizationId, organizations.id));

    console.log('Found users:');
    allUsers.forEach((record, index) => {
      console.log(`${index + 1}. User: ${record.user.name || 'No name'} (${record.user.email})`);
      console.log(`   ID: ${record.user.id}`);
      console.log(`   Organization: ${record.organization?.name || 'None assigned'} (ID: ${record.user.currentOrganizationId || 'null'})`);
      console.log(`   Role: ${record.role?.name || 'None assigned'} (ID: ${record.user.roleId || 'null'})`);
      console.log(`   Role Permissions: ${record.role?.permissions?.join(', ') || 'None'}\n`);
    });

    // Get all available roles
    console.log('Available roles:');
    const allRoles = await db.select().from(roles);
    allRoles.forEach((role, index) => {
      console.log(`${index + 1}. ${role.name} (ID: ${role.id})`);
      console.log(`   Permissions: ${role.permissions?.join(', ')}`);
      console.log(`   Organization ID: ${role.organizationId}\n`);
    });

    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
    process.exit(1);
  }
}

checkUsers();