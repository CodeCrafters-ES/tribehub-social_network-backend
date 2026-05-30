import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let accountRepository: {
    createRequest: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    consumeRequestAndSoftDeleteUser: ReturnType<typeof vi.fn>;
  };
  let passwordHashService: { verify: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };

  const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const OTHER_USER_ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const REQUEST_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  beforeEach(() => {
    accountRepository = {
      createRequest: vi.fn(),
      findById: vi.fn(),
      consumeRequestAndSoftDeleteUser: vi.fn(),
    };
    passwordHashService = { verify: vi.fn() };
    configService = { get: vi.fn().mockReturnValue(900) };

    service = new AccountService(
      accountRepository as never,
      passwordHashService as never,
      configService as never,
    );
  });

  describe('createDeleteRequest', () => {
    it('creates a request and returns id + expiresIn', async () => {
      accountRepository.createRequest.mockResolvedValue({ id: REQUEST_ID });

      const result = await service.createDeleteRequest(USER_ID);

      expect(result).toEqual({ deleteRequestId: REQUEST_ID, expiresIn: 900 });
      expect(accountRepository.createRequest).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Date),
      );
    });
  });

  describe('confirmDeleteRequest', () => {
    const dto = { deleteRequestId: REQUEST_ID, password: 'SecurePass123' };

    function buildRequest(overrides: Record<string, unknown> = {}) {
      return {
        id: REQUEST_ID,
        userId: USER_ID,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: USER_ID, passwordHash: 'hash' },
        ...overrides,
      };
    }

    it('throws NotFound when the request does not exist', async () => {
      accountRepository.findById.mockResolvedValue(null);

      await expect(service.confirmDeleteRequest(dto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound (no enumeration) when the request belongs to another user', async () => {
      accountRepository.findById.mockResolvedValue(
        buildRequest({ userId: OTHER_USER_ID }),
      );

      await expect(service.confirmDeleteRequest(dto, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequest when the request has expired', async () => {
      accountRepository.findById.mockResolvedValue(
        buildRequest({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      await expect(service.confirmDeleteRequest(dto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest when the request was already used', async () => {
      accountRepository.findById.mockResolvedValue(
        buildRequest({ usedAt: new Date() }),
      );

      await expect(service.confirmDeleteRequest(dto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws Unauthorized and does NOT consume the token on a wrong password', async () => {
      accountRepository.findById.mockResolvedValue(buildRequest());
      passwordHashService.verify.mockResolvedValue(false);

      await expect(service.confirmDeleteRequest(dto, USER_ID)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(
        accountRepository.consumeRequestAndSoftDeleteUser,
      ).not.toHaveBeenCalled();
    });

    it('consumes the token and soft-deletes the user on a valid password', async () => {
      accountRepository.findById.mockResolvedValue(buildRequest());
      passwordHashService.verify.mockResolvedValue(true);
      accountRepository.consumeRequestAndSoftDeleteUser.mockResolvedValue(
        undefined,
      );

      const result = await service.confirmDeleteRequest(dto, USER_ID);

      expect(result).toEqual({ ok: true });
      expect(
        accountRepository.consumeRequestAndSoftDeleteUser,
      ).toHaveBeenCalledWith(REQUEST_ID, USER_ID);
    });
  });
});
