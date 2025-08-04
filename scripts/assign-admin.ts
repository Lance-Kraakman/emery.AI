import { db } from "../lib/db/client";
import { users, roles } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function assignAdminRole() {
  try {
    console.log('👤 Assigning admin role to user...');
    
    // Find your user (Lance)
    const [user] = await db.select().from(users).where(eq(users.name, 'Lance')).limit(1);
    
    if (!user) {
      console.log('❌ User "Lance" not found');
      process.exit(1);
    }
    
    console.log(`📋 Found user: ${user.name} (${user.email})`);
    
    // Find the Admin role
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'Admin')).limit(1);
    
    if (!adminRole) {
      console.log('❌ Admin role not found');
      process.exit(1);
    }
    
    console.log(`📋 Found admin role: ${adminRole.name} (ID: ${adminRole.id})`);
    console.log(`📋 Admin permissions: ${adminRole.permissions?.join(', ')}`);
    
    // Update the user with organization and role
    const [updatedUser] = await db.update(users)
      .set({ 
        organizationId: adminRole.organizationId,
        roleId: adminRole.id 
      })
      .where(eq(users.id, user.id))
      .returning();
      
    console.log('✅ Successfully updated user:');
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Organization ID: ${updatedUser.organizationId}`);
    console.log(`   Role ID: ${updatedUser.roleId}`);
    
    console.log('\n🎉 You now have admin permissions!');
    console.log('You can now create tables and manage other users.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error assigning admin role:', error);
    process.exit(1);
  }
}

assignAdminRole();