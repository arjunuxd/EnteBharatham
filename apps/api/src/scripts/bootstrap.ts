import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';
import { loadEnv } from '../config/env.js';
import { bootstrapAdminAccount } from './bootstrapAdmin.js';

/**
 * One-time admin/moderator bootstrap command:
 * `npm run bootstrap:admin -w @entebharatham/api`
 *
 * Configuration comes from ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_DISPLAY_NAME,
 * and optionally ADMIN_ROLE (moderator | admin, default admin). The password
 * is required to be at least 12 characters for privileged accounts. Nothing
 * secret is ever printed; output is limited to the email, role, and whether
 * the account was created or updated.
 *
 * This is the only path to privileged accounts — no HTTP endpoint can
 * elevate roles.
 */
async function main(): Promise<void> {
  const env = loadEnv();

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim();
  const role = process.env.ADMIN_ROLE?.trim() ?? 'admin';

  if (email === undefined || email === '' || password === undefined || password === '') {
    console.error('[bootstrap-admin] ADMIN_EMAIL and ADMIN_PASSWORD are required');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('[bootstrap-admin] ADMIN_PASSWORD must be at least 12 characters');
    process.exit(1);
  }
  if (role !== 'moderator' && role !== 'admin') {
    console.error('[bootstrap-admin] ADMIN_ROLE must be "moderator" or "admin"');
    process.exit(1);
  }

  try {
    await connectToDatabase(env.MONGODB_URI);
  } catch {
    console.error('[bootstrap-admin] could not connect to the database');
    process.exit(1);
  }

  try {
    const result = await bootstrapAdminAccount({
      email,
      password,
      displayName: displayName !== undefined && displayName !== '' ? displayName : 'Administrator',
      role,
    });
    console.log(
      `[bootstrap-admin] ${result.created ? 'created' : 'updated'} ${result.role} account ${result.email}`,
    );
  } catch {
    console.error('[bootstrap-admin] bootstrap failed');
    process.exit(1);
  }

  await disconnectFromDatabase();
}

void main().catch(() => {
  console.error('[bootstrap-admin] unexpected failure');
  process.exit(1);
});
