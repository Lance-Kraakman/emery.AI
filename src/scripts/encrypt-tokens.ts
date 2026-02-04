#!/usr/bin/env tsx

/**
 * One-time migration script: encrypt existing plaintext OAuth tokens.
 *
 * Reads all accounts with non-null tokens, encrypts any that aren't
 * already encrypted, and writes them back. Safe to run multiple times
 * (idempotent via isEncrypted() check).
 *
 * Usage: ENCRYPTION_KEY=<base64_key> DATABASE_URL=<url> pnpm db:encrypt-tokens
 */

import postgres from 'postgres';
import { parseConnectionString } from '@/ddd/infrastructure/db/client-parser';
import { encrypt, isEncrypted } from '@/lib/security/encryption';

const TOKEN_COLUMNS = ['access_token', 'refresh_token', 'id_token'] as const;

async function encryptExistingTokens() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL environment variable is required');
  if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY environment variable is required');

  const connStr = parseConnectionString(raw);
  const sql = postgres(connStr, { max: 1, connect_timeout: 30 });

  try {
    const rows = await sql`
      SELECT provider, provider_account_id, access_token, refresh_token, id_token
      FROM accounts
      WHERE access_token IS NOT NULL
         OR refresh_token IS NOT NULL
         OR id_token IS NOT NULL
    `;

    console.log(`Found ${rows.length} account rows with tokens to process`);
    let encryptedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const updates: Record<string, string> = {};
      let needsUpdate = false;

      for (const col of TOKEN_COLUMNS) {
        const value = row[col];
        if (value && !isEncrypted(value)) {
          updates[col] = encrypt(value)!;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await sql`
          UPDATE accounts
          SET ${sql(updates)}
          WHERE provider = ${row.provider}
            AND provider_account_id = ${row.provider_account_id}
        `;
        encryptedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`Done. Encrypted: ${encryptedCount}, Skipped (already encrypted or null): ${skippedCount}`);
  } finally {
    await sql.end();
  }
}

encryptExistingTokens()
  .then(() => process.exit(0))
  .catch((e) => { console.error('Failed:', e); process.exit(1); });
