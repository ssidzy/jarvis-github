#!/usr/bin/env npx tsx
/**
 * Password Migration Script
 * Run this once to migrate plaintext passwords to bcrypt hashes.
 * 
 * Usage: npx tsx scripts/migrate-passwords.ts
 */

import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const USERS_FILE = path.join(process.cwd(), 'users.json');

async function migrate() {
  console.log('🔐 Password Migration Script');
  console.log('============================\n');

  try {
    const data = JSON.parse(await fs.readFile(USERS_FILE, 'utf-8'));
    let migrated = 0;
    let skipped = 0;

    for (const user of data.users) {
      if (user.password && !user.passwordHash) {
        console.log(`  Migrating: ${user.username}`);
        user.passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
        delete user.password;
        migrated++;
      } else if (user.passwordHash) {
        console.log(`  Skipping: ${user.username} (already migrated)`);
        skipped++;
      }
    }

    // Backup old file
    await fs.writeFile(
      USERS_FILE.replace('.json', '.backup.json'),
      JSON.stringify(JSON.parse(await fs.readFile(USERS_FILE, 'utf-8')), null, 2)
    );

    // Write updated file
    await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));

    console.log('\n============================');
    console.log(`✅ Migrated: ${migrated} users`);
    console.log(`⏭️  Skipped:  ${skipped} users`);
    console.log(`\n📁 Backup saved to: users.backup.json`);
    console.log('\n⚠️  IMPORTANT: Delete users.backup.json after verifying the migration!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
