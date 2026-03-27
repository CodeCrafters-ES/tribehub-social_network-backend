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
}));

import { AuthService } from './auth.service';
import { getSupabaseClient } from '../config/supabase.config';
import * as argon2 from 'argon2';

const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();

const mockUsersRepository = {
  findByEmail: vi.fn(),
  findByUsername: vi.fn(),
  create: vi.fn(),
};

function buildService(): AuthService {
  return new AuthService(mockUsersRepository as never);
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getSupabaseClient).mockReturnValue({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
    },
  } as never);
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
    expect(result).toEqual(sessionData);
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
