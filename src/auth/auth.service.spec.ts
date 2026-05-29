// src/auth/auth.service.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';

// Mock argon2 before importing AuthService
vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('$argon2id$mocked_hash'),
}));

// Mock Supabase config
vi.mock('../config/supabase.config', () => ({
  getSupabaseClient: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
}));

import { AuthService } from './auth.service';
import { RefreshTokenRotationConflictError } from './repositories/auth.repository';
import { getSupabaseClient } from '../config/supabase.config';
import * as argon2 from 'argon2';

const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockRefreshSession = vi.fn();

const mockUsersRepository = {
  findByEmail: vi.fn(),
  findByUsername: vi.fn(),
  findBySupabaseId: vi.fn(),
  create: vi.fn(),
};

const mockAuthRepository = {
  findActiveRefreshToken: vi.fn(),
  findRefreshTokenByHash: vi.fn(),
  createRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeAllActiveUserTokens: vi.fn(),
  revokeRefreshToken: vi.fn(),
};

const mockSecurityMonitor = {
  recordFailedLogin: vi.fn(),
  recordInvalidToken: vi.fn(),
};

function buildService(): AuthService {
  return new AuthService(
    mockUsersRepository as never,
    mockAuthRepository as never,
    mockSecurityMonitor as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getSupabaseClient).mockReturnValue({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      refreshSession: mockRefreshSession,
    },
  } as never);

  mockAuthRepository.findActiveRefreshToken.mockResolvedValue(null);
  mockAuthRepository.findRefreshTokenByHash.mockResolvedValue(null);
  mockAuthRepository.createRefreshToken.mockResolvedValue(undefined);
  mockAuthRepository.rotateRefreshToken.mockResolvedValue(undefined);
  mockAuthRepository.revokeAllActiveUserTokens.mockResolvedValue(undefined);
  mockAuthRepository.revokeRefreshToken.mockResolvedValue(undefined);
  mockUsersRepository.findBySupabaseId.mockResolvedValue(null);
  mockRefreshSession.mockReset();
});

describe('AuthService.register', () => {
  const dto = {
    email: 'user@example.com',
    username: 'newuser',
    password: 'secret123',
  };

  it('creates a user in the database and returns public fields without passwordHash', async () => {
    mockUsersRepository.findByEmail.mockResolvedValue(null);
    mockUsersRepository.findByUsername.mockResolvedValue(null);

    mockSignUp.mockResolvedValue({
      data: { user: { id: 'supabase-uuid-42' } },
      error: null,
    });

    const createdUser = {
      id: 'local-uuid-1',
      email: dto.email,
      username: dto.username,
      passwordHash: '$argon2id$mocked_hash',
      supabaseId: 'supabase-uuid-42',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    mockUsersRepository.create.mockResolvedValue(createdUser);

    const service = buildService();
    const result = await service.register(dto);

    // Argon2 should have been called with the raw password
    expect(argon2.hash).toHaveBeenCalledWith(dto.password);

    // Repository create should have been called
    expect(mockUsersRepository.create).toHaveBeenCalledWith({
      email: dto.email,
      username: dto.username,
      passwordHash: '$argon2id$mocked_hash',
      supabaseId: 'supabase-uuid-42',
    });

    // Response must contain public fields
    expect(result).toEqual({
      id: createdUser.id,
      email: createdUser.email,
      username: createdUser.username,
      createdAt: createdUser.createdAt,
    });

    // Response must NOT contain passwordHash
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('password');
  });

  it('throws ConflictException (409) when email already exists', async () => {
    const existingUser = { id: 'existing-id', email: dto.email };
    mockUsersRepository.findByEmail.mockResolvedValue(existingUser);
    mockUsersRepository.findByUsername.mockResolvedValue(null);

    const service = buildService();

    await expect(service.register(dto)).rejects.toThrow(ConflictException);
    await expect(service.register(dto)).rejects.toThrow('Email already in use');

    // Should not reach Supabase or repository create
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockUsersRepository.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException (409) when username already exists', async () => {
    mockUsersRepository.findByEmail.mockResolvedValue(null);
    const existingUser = { id: 'existing-id', username: dto.username };
    mockUsersRepository.findByUsername.mockResolvedValue(existingUser);

    const service = buildService();

    await expect(service.register(dto)).rejects.toThrow(ConflictException);
    await expect(service.register(dto)).rejects.toThrow(
      'Username already in use',
    );

    // Should not reach Supabase or repository create
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockUsersRepository.create).not.toHaveBeenCalled();
  });

  it('maps Prisma P2002 constraint error to ConflictException', async () => {
    mockUsersRepository.findByEmail.mockResolvedValue(null);
    mockUsersRepository.findByUsername.mockResolvedValue(null);

    mockSignUp.mockResolvedValue({
      data: { user: { id: 'supabase-uuid-99' } },
      error: null,
    });

    const prismaConflictError = Object.assign(
      new Error('Unique constraint failed'),
      {
        code: 'P2002',
      },
    );
    mockUsersRepository.create.mockRejectedValue(prismaConflictError);

    const service = buildService();

    await expect(service.register(dto)).rejects.toThrow(ConflictException);
  });
});

describe('AuthService.login', () => {
  it('calls Supabase signInWithPassword and returns session data', async () => {
    const dto = { email: 'user@example.com', password: 'secret123' };
    const sessionData = { session: { access_token: 'jwt-token' }, user: {} };

    mockSignInWithPassword.mockResolvedValue({
      data: sessionData,
      error: null,
    });

    const service = buildService();
    const result = await service.login(dto);

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: dto.email,
      password: dto.password,
    });
    expect(result).toEqual({
      session: sessionData.session,
      user: sessionData.user,
      csrfToken: expect.any(String) as unknown,
    });
  });

  it('persists hashed refresh token on successful login when local user exists', async () => {
    const dto = { email: 'user@example.com', password: 'secret123' };
    const sessionData = {
      session: { access_token: 'jwt-token', refresh_token: 'refresh-token' },
      user: { id: 'supabase-id-1' },
    };

    mockSignInWithPassword.mockResolvedValue({
      data: sessionData,
      error: null,
    });
    mockUsersRepository.findBySupabaseId.mockResolvedValue({
      id: 'local-user-1',
    });

    const service = buildService();
    await service.login(dto, { ipAddress: '127.0.0.1', userAgent: 'vitest' });

    expect(mockAuthRepository.createRefreshToken).toHaveBeenCalledOnce();
    const arg = mockAuthRepository.createRefreshToken.mock.calls[0][0] as {
      tokenHash: string;
      userId: string;
    };
    expect(arg.userId).toBe('local-user-1');
    expect(arg.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('throws when Supabase returns an error', async () => {
    const dto = { email: 'user@example.com', password: 'wrong' };
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    const service = buildService();

    await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
  });
});

describe('AuthService.logout', () => {
  it('returns without calling repository when rawToken is undefined', async () => {
    const service = buildService();

    await expect(service.logout(undefined)).resolves.toBeUndefined();

    expect(mockAuthRepository.findActiveRefreshToken).not.toHaveBeenCalled();
    expect(mockAuthRepository.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('returns without revoking when no active token is found in the DB', async () => {
    mockAuthRepository.findActiveRefreshToken.mockResolvedValue(null);

    const service = buildService();

    await expect(service.logout('some-raw-token')).resolves.toBeUndefined();

    expect(mockAuthRepository.findActiveRefreshToken).toHaveBeenCalledOnce();
    expect(mockAuthRepository.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('revokes the token with reason "logout" when an active token exists', async () => {
    const tokenRecord = {
      id: 'token-uuid',
      userId: 'user-uuid',
      tokenHash: 'hashed-value',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      revocationReason: null,
      replacedByTokenId: null,
      ipAddress: null,
      userAgent: null,
    };
    mockAuthRepository.findActiveRefreshToken.mockResolvedValue(tokenRecord);
    mockAuthRepository.revokeRefreshToken.mockResolvedValue(undefined);

    const service = buildService();

    await expect(service.logout('some-raw-token')).resolves.toBeUndefined();

    expect(mockAuthRepository.findActiveRefreshToken).toHaveBeenCalledOnce();
    // The hash passed to findActiveRefreshToken must be a hex SHA-256 string
    const passedHash = mockAuthRepository.findActiveRefreshToken.mock
      .calls[0][0] as string;
    expect(passedHash).toMatch(/^[0-9a-f]{64}$/);

    expect(mockAuthRepository.revokeRefreshToken).toHaveBeenCalledOnce();
    expect(mockAuthRepository.revokeRefreshToken).toHaveBeenCalledWith(
      passedHash,
      'logout',
    );
  });

  it('hashes two different raw tokens to different values', async () => {
    mockAuthRepository.findActiveRefreshToken.mockResolvedValue(null);
    const service = buildService();

    await service.logout('token-alpha');
    await service.logout('token-beta');

    const hashAlpha = mockAuthRepository.findActiveRefreshToken.mock
      .calls[0][0] as string;
    const hashBeta = mockAuthRepository.findActiveRefreshToken.mock
      .calls[1][0] as string;

    expect(hashAlpha).not.toBe(hashBeta);
  });

  it('resolves without throwing when the DB throws during findActiveRefreshToken', async () => {
    mockAuthRepository.findActiveRefreshToken.mockRejectedValue(
      new Error('DB connection lost'),
    );

    const service = buildService();

    // Must not throw — DB errors are absorbed to keep logout best-effort.
    await expect(service.logout('some-raw-token')).resolves.toBeUndefined();

    expect(mockAuthRepository.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('resolves without throwing when the DB throws during revokeRefreshToken', async () => {
    const tokenRecord = {
      id: 'token-uuid',
      userId: 'user-uuid',
      tokenHash: 'hashed-value',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      revocationReason: null,
      replacedByTokenId: null,
      ipAddress: null,
      userAgent: null,
    };
    mockAuthRepository.findActiveRefreshToken.mockResolvedValue(tokenRecord);
    mockAuthRepository.revokeRefreshToken.mockRejectedValue(
      new Error('DB write failed'),
    );

    const service = buildService();

    // Must not throw — DB errors are absorbed.
    await expect(service.logout('some-raw-token')).resolves.toBeUndefined();
  });
});

describe('AuthService.refreshSession', () => {
  it('throws UnauthorizedException when token does not exist', async () => {
    mockAuthRepository.findRefreshTokenByHash.mockResolvedValue(null);
    const service = buildService();
    await expect(
      service.refreshSession({ rawRefreshToken: 'missing-token' }),
    ).rejects.toThrow('Unauthorized');
  });

  it('rotates refresh token and returns new access token when refresh is valid', async () => {
    mockAuthRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'token-id-1',
      userId: 'user-id-1',
      tokenHash: 'hash-1',
      revokedAt: null,
      revocationReason: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: null,
      userAgent: null,
    });
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        },
      },
      error: null,
    });

    const service = buildService();
    const result = await service.refreshSession({
      rawRefreshToken: 'valid-raw-refresh',
    });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(mockAuthRepository.rotateRefreshToken).toHaveBeenCalledOnce();
  });

  it('returns Unauthorized when rotation loses the single-use race', async () => {
    mockAuthRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'token-id-1',
      userId: 'user-id-1',
      tokenHash: 'hash-1',
      revokedAt: null,
      revocationReason: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: null,
      userAgent: null,
    });
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        },
      },
      error: null,
    });
    mockAuthRepository.rotateRefreshToken.mockRejectedValue(
      new RefreshTokenRotationConflictError(),
    );

    const service = buildService();
    await expect(
      service.refreshSession({ rawRefreshToken: 'valid-raw-refresh' }),
    ).rejects.toThrow('Unauthorized');
  });

  it('revokes all user tokens and throws Unauthorized when token is already revoked', async () => {
    mockAuthRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'token-id-1',
      userId: 'user-id-1',
      tokenHash: 'hash-1',
      revokedAt: new Date(Date.now() - 1000),
      revocationReason: 'logout',
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: null,
      userAgent: null,
    });

    const service = buildService();
    await expect(
      service.refreshSession({ rawRefreshToken: 'revoked-token' }),
    ).rejects.toThrow('Unauthorized');

    expect(mockAuthRepository.revokeAllActiveUserTokens).toHaveBeenCalledOnce();
    expect(mockAuthRepository.revokeAllActiveUserTokens).toHaveBeenCalledWith(
      'user-id-1',
      'reuse_detected',
    );
  });

  it('revokes all user tokens and throws Unauthorized when token is expired', async () => {
    mockAuthRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'token-id-1',
      userId: 'user-id-1',
      tokenHash: 'hash-1',
      revokedAt: null,
      revocationReason: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() - 1000),
      ipAddress: null,
      userAgent: null,
    });

    const service = buildService();
    await expect(
      service.refreshSession({ rawRefreshToken: 'expired-token' }),
    ).rejects.toThrow('Unauthorized');

    expect(mockAuthRepository.revokeAllActiveUserTokens).toHaveBeenCalledOnce();
    expect(mockAuthRepository.revokeAllActiveUserTokens).toHaveBeenCalledWith(
      'user-id-1',
      'reuse_detected',
    );
  });

  it('throws Unauthorized when Supabase refreshSession returns an error', async () => {
    mockAuthRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'token-id-1',
      userId: 'user-id-1',
      tokenHash: 'hash-1',
      revokedAt: null,
      revocationReason: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: null,
      userAgent: null,
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Supabase session expired' },
    });

    const service = buildService();
    await expect(
      service.refreshSession({ rawRefreshToken: 'valid-raw-refresh' }),
    ).rejects.toThrow('Unauthorized');

    expect(mockAuthRepository.rotateRefreshToken).not.toHaveBeenCalled();
  });
});
