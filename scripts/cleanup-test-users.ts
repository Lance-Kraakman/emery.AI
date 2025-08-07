/**
 * Clean up test users that don't have OAuth accounts
 * These users can't authenticate via NextAuth and are polluting the database
 */

import { db } from '../lib/db/client';
import { users, accounts } from '../lib/db/schema';

async function cleanupTestUsers() {
  try {
    console.log('🧹 CLEANING UP TEST USERS');
    console.log('==========================\n');
    
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
    
    console.log(`\n⚠️  These users will be DELETED because they can't authenticate via NextAuth.\n`);
    
    // Delete users without OAuth accounts
    console.log('🗑️  Deleting test users...');
    
    for (const user of usersWithoutOAuth) {
      await db.delete(users).where({ id: user.id });
      console.log(`   ❌ Deleted: ${user.email || user.id.substring(0, 8) + '...'}`);
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${usersWithoutOAuth.length} test users`);
    console.log(`   Remaining: ${allUsers.length - usersWithoutOAuth.length} real users with OAuth\n`);
    
    // Show final state
    const remainingUsers = await db.select().from(users);
    console.log(`📊 Final state:`);
    console.log(`   Users: ${remainingUsers.length}`);
    remainingUsers.forEach((u, i) => {
      const account = allAccounts.find(a => a.userId === u.id);
      console.log(`   ${i+1}. ${u.email || 'No email'} (${u.id.substring(0, 8)}...) via ${account?.provider || 'UNKNOWN'}`);
    });
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

if (require.main === module) {
  cleanupTestUsers();
}