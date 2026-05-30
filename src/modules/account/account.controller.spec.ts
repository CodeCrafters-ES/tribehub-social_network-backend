import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AccountController } from './account.controller';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';

describe('AccountController', () => {
  let controller: AccountController;
  let accountService: {
    createDeleteRequest: ReturnType<typeof vi.fn>;
    confirmDeleteRequest: ReturnType<typeof vi.fn>;
  };

  const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const REQUEST_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  function reqWith(sub?: string): AuthenticatedRequest {
    return { supabaseUser: { sub } } as unknown as AuthenticatedRequest;
  }

  beforeEach(() => {
    accountService = {
      createDeleteRequest: vi.fn(),
      confirmDeleteRequest: vi.fn(),
    };
    controller = new AccountController(accountService as never);
  });

  describe('requestDelete', () => {
    it('delegates to the service with the authenticated user id', async () => {
      accountService.createDeleteRequest.mockResolvedValue({
        deleteRequestId: REQUEST_ID,
        expiresIn: 900,
      });

      const result = await controller.requestDelete(reqWith(USER_ID));

      expect(result).toMatchObject({ deleteRequestId: REQUEST_ID });
      expect(accountService.createDeleteRequest).toHaveBeenCalledWith(USER_ID);
    });

    it('rejects a non-UUID user identifier', async () => {
      await expect(
        controller.requestDelete(reqWith('not-a-uuid')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmDelete', () => {
    const body = { deleteRequestId: REQUEST_ID, password: 'SecurePass123' };

    it('delegates to the service', async () => {
      accountService.confirmDeleteRequest.mockResolvedValue({ ok: true });

      const result = await controller.confirmDelete(reqWith(USER_ID), body);

      expect(result).toEqual({ ok: true });
      expect(accountService.confirmDeleteRequest).toHaveBeenCalledWith(
        body,
        USER_ID,
      );
    });

    it('rejects a missing user identifier', async () => {
      await expect(
        controller.confirmDelete(reqWith(undefined), body),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
