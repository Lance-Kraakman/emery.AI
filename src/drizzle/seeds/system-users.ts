#!/usr/bin/env tsx

/**
 * System Users Seeding
 * 
 * Creates system users required for scheduler and other system services.
 * These users operate with elevated permissions across organizations.
 */

import { db } from '@/ddd/infrastructure/db/client';
import { users } from '@/ddd/infrastructure/db/schema';
import { SYSTEM_USER_ID_VALUE } from '@/ddd/infrastructure/db/system-context';

export async function seedSystemUsers() {
  console.log('🤖 Seeding system users...');

  try {
    // Create system scheduler user
    await db.insert(users).values({
      id: SYSTEM_USER_ID_VALUE,
      name: 'System Scheduler',
      email: 'scheduler@system.emery',
      emailVerified: new Date(),
      image: null
    }).onConflictDoNothing();

    console.log('✅ System scheduler user created');
    console.log('✅ System users seeding completed successfully!');

  } catch (error) {
    console.error('❌ Failed to seed system users:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedSystemUsers()
    .then(() => {
      console.log('🎉 System users seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 System users seeding failed:', error);
      process.exit(1);
    });
}