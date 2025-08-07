/**
 * Clean up test users - with proper deletion
 */

import { db } from '../lib/db/client';
import { users, accounts } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function cleanupTestUsers() {
  try {
    console.log('🧹 CLEANING UP TEST USERS V2');
    console.log('=============================\n');
    
    // Get all users and accounts
    const allUsers = await db.select().from(users);
    const allAccounts = await db.select().from(accounts);
    
    console.log(`📊 Current state:`);
    console.log(`   Users: ${allUsers.length}`);
    console.log(`   OAuth accounts: ${allAccounts.length}\n`);
    
    // Find users without OAuth accounts
    const usersWithoutOAuth = allUsers.filter(u => 
      !allAccounts.some(a => a.userId === u.id)
    );
    
    console.log(`🎯 Found ${usersWithoutOAuth.length} users without OAuth accounts:\n`);
    
    if (usersWithoutOAuth.length === 0) {
      console.log('✅ No test users to clean up!');
      return;
    }
    
    // Show what will be deleted
    usersWithoutOAuth.forEach((u, i) => {
      console.log(`   ${i+1}. ${u.email || 'No email'} (${u.id.substring(0, 8)}...)`);
    });
    
    console.log(`\n🗑️  Deleting test users...\n`);
    
    // Delete users without OAuth accounts using proper drizzle syntax
    for (const user of usersWithoutOAuth) {
      console.log(`   Deleting user: ${user.email || user.id.substring(0, 8) + '...'}`);
      
      try {
        await db.delete(users).where(eq(users.id, user.id));
        console.log(`   ✅ Deleted successfully`);
      } catch (deleteError) {
        console.log(`   ❌ Delete failed:`, deleteError);
      }
    }
    
    console.log(`\n📊 Checking final state...\n`);
    
    // Show final state
    const remainingUsers = await db.select().from(users);
    console.log(`✅ Final state:`);
    console.log(`   Users remaining: ${remainingUsers.length}`);
    
    if (remainingUsers.length > 0) {
      remainingUsers.forEach((u, i) => {
        const account = allAccounts.find(a => a.userId === u.id);
        console.log(`   ${i+1}. ${u.email || 'No email'} (${u.id.substring(0, 8)}...) via ${account?.provider || 'NO_OAUTH'}`);
      });
    }
    
    console.log(`\n🎉 Cleanup complete! Removed ${allUsers.length - remainingUsers.length} test users.`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

if (require.main === module) {
  cleanupTestUsers();
}