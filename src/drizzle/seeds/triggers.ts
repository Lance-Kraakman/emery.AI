#!/usr/bin/env tsx

/**
 * Seed Trigger Tools
 *
 * This script populates the tools table with trigger (event source) tools
 * for common OAuth apps. These are identified by isTrigger = true.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tools, type OAuthToolDefinitionData } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { parseConnectionString } from '@/ddd/infrastructure/db/client-parser';

// Database connection
const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const connectionString = parseConnectionString(rawConnectionString);
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

interface TriggerToolData {
  id: string;
  displayName: string;
  description: string;
  appId: string;
  icon: string;
}

// Known trigger tools for OAuth apps
const triggerTools: TriggerToolData[] = [
  // Gmail triggers
  {
    id: 'gmail-new-email',
    displayName: 'New Email',
    description: 'Triggers when a new email is received in Gmail',
    appId: 'gmail',
    icon: '📧',
  },
  {
    id: 'gmail-new-labeled-email',
    displayName: 'New Labeled Email',
    description: 'Triggers when an email receives a specific label',
    appId: 'gmail',
    icon: '🏷️',
  },

  // Slack triggers
  {
    id: 'slack-new-message',
    displayName: 'New Message in Channel',
    description: 'Triggers when a new message is posted in a Slack channel',
    appId: 'slack',
    icon: '💬',
  },
  {
    id: 'slack-new-direct-message',
    displayName: 'New Direct Message',
    description: 'Triggers when a new direct message is received',
    appId: 'slack',
    icon: '✉️',
  },
  {
    id: 'slack-new-reaction',
    displayName: 'New Reaction Added',
    description: 'Triggers when a reaction is added to a message',
    appId: 'slack',
    icon: '👍',
  },

  // Google Calendar triggers
  {
    id: 'google_calendar-new-event',
    displayName: 'New Calendar Event',
    description: 'Triggers when a new event is created in Google Calendar',
    appId: 'google_calendar',
    icon: '📅',
  },
  {
    id: 'google_calendar-event-start',
    displayName: 'Event Starting Soon',
    description: 'Triggers before a calendar event starts',
    appId: 'google_calendar',
    icon: '⏰',
  },

  // Google Sheets triggers
  {
    id: 'google_sheets-new-row',
    displayName: 'New Row Added',
    description: 'Triggers when a new row is added to a Google Sheet',
    appId: 'google_sheets',
    icon: '📊',
  },
  {
    id: 'google_sheets-row-updated',
    displayName: 'Row Updated',
    description: 'Triggers when a row is updated in a Google Sheet',
    appId: 'google_sheets',
    icon: '✏️',
  },

  // GitHub triggers
  {
    id: 'github-new-issue',
    displayName: 'New Issue',
    description: 'Triggers when a new issue is created in a repository',
    appId: 'github',
    icon: '🐛',
  },
  {
    id: 'github-new-pull-request',
    displayName: 'New Pull Request',
    description: 'Triggers when a new pull request is opened',
    appId: 'github',
    icon: '🔀',
  },
  {
    id: 'github-push',
    displayName: 'New Push',
    description: 'Triggers when code is pushed to a repository',
    appId: 'github',
    icon: '📤',
  },

  // Notion triggers
  {
    id: 'notion-new-page',
    displayName: 'New Page Created',
    description: 'Triggers when a new page is created in Notion',
    appId: 'notion',
    icon: '📝',
  },
  {
    id: 'notion-page-updated',
    displayName: 'Page Updated',
    description: 'Triggers when a page is updated in Notion',
    appId: 'notion',
    icon: '🔄',
  },

  // Linear triggers
  {
    id: 'linear-new-issue',
    displayName: 'New Issue',
    description: 'Triggers when a new issue is created in Linear',
    appId: 'linear',
    icon: '📋',
  },
  {
    id: 'linear-issue-updated',
    displayName: 'Issue Updated',
    description: 'Triggers when an issue is updated in Linear',
    appId: 'linear',
    icon: '🔄',
  },
];

async function seedTriggers() {
  console.log('Seeding trigger tools...');

  for (const trigger of triggerTools) {
    const config: OAuthToolDefinitionData = {
      type: 'oauth',
      implementation: {
        pipedream_key: trigger.id,
        requires_auth: true,
      },
      ui_config: {
        insert_text: trigger.displayName,
        icon: trigger.icon,
      },
      parameters: {},
    };

    try {
      // Check if already exists
      const existing = await db.select().from(tools).where(eq(tools.id, trigger.id));

      if (existing.length > 0) {
        // Update to ensure isTrigger is true
        await db.update(tools)
          .set({ isTrigger: true })
          .where(eq(tools.id, trigger.id));
        console.log(`  Updated: ${trigger.id} (set isTrigger=true)`);
      } else {
        // Insert new trigger
        await db.insert(tools).values({
          id: trigger.id,
          displayName: trigger.displayName,
          description: trigger.description,
          category: 'triggers',
          appId: trigger.appId,
          icon: trigger.icon,
          config,
          isTrigger: true,
        });
        console.log(`  Created: ${trigger.id}`);
      }
    } catch (error) {
      // Skip if app doesn't exist (foreign key constraint)
      console.log(`  Skipped: ${trigger.id} (app ${trigger.appId} may not exist)`);
    }
  }

  console.log('Done seeding triggers.');
}

// Run if called directly
seedTriggers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding triggers:', error);
    process.exit(1);
  });
