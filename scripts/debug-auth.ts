/**
 * Debug authentication system 
 */

import { db } from '../lib/db/client';
import { users, accounts } from '../lib/db/schema';

async function debugAuth() {
  try {
    console.log('🔍 AUTHENTICATION SYSTEM DEBUG');
    console.log('================================\n');
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`👥 Users (${allUsers.length}):`);
    allUsers.forEach((u, i) => {
      console.log(`  ${i+1}. ${u.id.substring(0, 8)}... | Email: ${u.email || 'NULL'} | Org: ${u.currentOrganizationId || 'NULL'} | Role: ${u.roleId || 'NULL'}`);
    });
    
    console.log('\n🔗 OAuth Accounts:');
    const allAccounts = await db.select().from(accounts);
    console.log(`   Found ${allAccounts.length} OAuth account(s)`);
    
    if (allAccounts.length > 0) {
      allAccounts.forEach((a, i) => {
        console.log(`  ${i+1}. User: ${a.userId.substring(0, 8)}... | Provider: ${a.provider} | Type: ${a.type}`);
      });
      
      // Find which users have OAuth accounts
      console.log('\n👤 Users WITH OAuth accounts:');
      const usersWithAccounts = allUsers.filter(u => 
        allAccounts.some(a => a.userId === u.id)
      );
      console.log(`   ${usersWithAccounts.length} users have OAuth accounts`);
      usersWithAccounts.forEach(u => {
        const userAccount = allAccounts.find(a => a.userId === u.id);
        console.log(`   ✅ ${u.email || 'No email'} (${u.id.substring(0, 8)}...) via ${userAccount?.provider}`);
      });
      
      console.log('\n🧪 Users WITHOUT OAuth accounts (likely test users):');
      const usersWithoutAccounts = allUsers.filter(u => 
        !allAccounts.some(a => a.userId === u.id)
      );
      console.log(`   ${usersWithoutAccounts.length} users are test/orphaned users`);
      usersWithoutAccounts.slice(0, 5).forEach(u => {
        console.log(`   ❌ ${u.email || 'No email'} (${u.id.substring(0, 8)}...) - NO OAuth`);
      });
      if (usersWithoutAccounts.length > 5) {
        console.log(`   ... and ${usersWithoutAccounts.length - 5} more`);
      }
    } else {
      console.log('   ❌ NO OAuth accounts found - authentication will fail!');
    }
    
    // Check NextAuth sessions
    console.log('\n🔐 Checking NextAuth sessions...');
    try {
      const sessions = await db.query.sessions.findMany();
      console.log(`   Found ${sessions.length} active session(s)`);
      if (sessions.length > 0) {
        sessions.forEach((s, i) => {
          console.log(`   ${i+1}. User: ${s.userId.substring(0, 8)}... | Expires: ${s.expires}`);
        });
      }
    } catch (e) {
      console.log('   Could not check sessions (may not be configured)');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAuth();