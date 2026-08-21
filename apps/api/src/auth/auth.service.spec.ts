import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

const { transaction, query } = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn() }));

vi.mock('../common/db', () => ({
  dbUser: vi.fn(),
  query,
  transaction,
}));

describe('AuthService V0 validation', () => {
  it('rejects a weak password before opening a database transaction', async () => {
    const service = new AuthService();
    await expect(service.register({ email: 'a@example.com', password: 'short', phoneNumber: '+966500000000', displayName: 'A' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a non-E.164 phone before hashing or persistence', async () => {
    const service = new AuthService();
    await expect(service.register({ email: 'a@example.com', password: 'ChangeMe123!', phoneNumber: '0500000000', displayName: 'A' }))
      .rejects.toThrow('Phone number must use E.164 format');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an empty display name', async () => {
    const service = new AuthService();
    await expect(service.register({ email: 'a@example.com', password: 'ChangeMe123!', phoneNumber: '+966500000000', displayName: '   ' }))
      .rejects.toThrow('Display name is required');
  });

  it('rejects weak replacement passwords before looking up reset tokens', async () => {
    const service = new AuthService();
    await expect(service.resetPassword('token', 'short')).rejects.toThrow('Password must be at least 10 characters');
    expect(query).not.toHaveBeenCalled();
  });

  it('returns no user for a missing session token', async () => {
    const service = new AuthService();
    await expect(service.getUserBySession(undefined)).resolves.toBeNull();
  });
});
