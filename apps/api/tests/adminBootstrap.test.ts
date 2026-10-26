import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectToDatabase, disconnectFromDatabase } from '../src/config/database.js';
import { AuditEventModel } from '../src/models/AuditEvent.js';
import { UserModel } from '../src/models/User.js';
import { bootstrapAdminAccount } from '../src/scripts/bootstrapAdmin.js';
import { authenticateUser } from '../src/services/auth.service.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri('entebharatham-bootstrap'));
  await UserModel.syncIndexes();
}, 180_000);

afterAll(async () => {
  await disconnectFromDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
  await AuditEventModel.deleteMany({});
});

describe('bootstrapAdminAccount', () => {
  it('creates an active admin account that can log in', async () => {
    const result = await bootstrapAdminAccount({
      email: 'Admin@Example.com',
      password: 'a-very-long-admin-password',
      displayName: 'Site Admin',
      role: 'admin',
    });

    expect(result.created).toBe(true);
    expect(result.email).toBe('admin@example.com');
    expect(result.role).toBe('admin');

    const user = await UserModel.findOne({ email: 'admin@example.com' }).exec();
    expect(user?.role).toBe('admin');
    expect(user?.accountStatus).toBe('active');

    // The account can authenticate through the normal login path.
    const auth = await authenticateUser({
      email: 'admin@example.com',
      password: 'a-very-long-admin-password',
    });
    expect(auth.role).toBe('admin');
  });

  it('is idempotent: rerunning updates in place without duplicating', async () => {
    await bootstrapAdminAccount({
      email: 'admin@example.com',
      password: 'first-admin-password-x',
      displayName: 'First Name',
      role: 'moderator',
    });
    const second = await bootstrapAdminAccount({
      email: 'admin@example.com',
      password: 'second-admin-password-y',
      displayName: 'Second Name',
      role: 'admin',
    });

    expect(second.created).toBe(false);
    expect(second.role).toBe('admin');

    const count = await UserModel.countDocuments({ email: 'admin@example.com' }).exec();
    expect(count).toBe(1);

    const user = await UserModel.findOne({ email: 'admin@example.com' }).exec();
    expect(user?.displayName).toBe('Second Name');
    expect(user?.role).toBe('admin');

    // The new password works; the old one does not.
    await expect(
      authenticateUser({ email: 'admin@example.com', password: 'second-admin-password-y' }),
    ).resolves.toMatchObject({ role: 'admin' });
    await expect(
      authenticateUser({ email: 'admin@example.com', password: 'first-admin-password-x' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('records a role_changed audit event without the password', async () => {
    await bootstrapAdminAccount({
      email: 'admin@example.com',
      password: 'a-very-long-admin-password',
      displayName: 'Site Admin',
      role: 'admin',
    });

    const events = await AuditEventModel.find({ action: 'user.role_changed' }).lean().exec();
    expect(events).toHaveLength(1);
    const serialized = JSON.stringify(events[0]);
    expect(serialized).not.toContain('a-very-long-admin-password');
    expect(serialized).toContain('admin@example.com');
  });

  it('reactivates a suspended account', async () => {
    const first = await bootstrapAdminAccount({
      email: 'admin@example.com',
      password: 'a-very-long-admin-password',
      displayName: 'Site Admin',
      role: 'admin',
    });
    expect(first.created).toBe(true);

    await UserModel.updateOne(
      { email: 'admin@example.com' },
      { $set: { accountStatus: 'suspended' } },
    );

    await bootstrapAdminAccount({
      email: 'admin@example.com',
      password: 'a-very-long-admin-password',
      displayName: 'Site Admin',
      role: 'admin',
    });

    const user = await UserModel.findOne({ email: 'admin@example.com' }).exec();
    expect(user?.accountStatus).toBe('active');
  });
});
