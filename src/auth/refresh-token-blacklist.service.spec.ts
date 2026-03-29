import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';

const redisServiceMock = {
  setWithTtl: vi.fn(),
  exists: vi.fn(),
};

function buildService() {
  return new RefreshTokenBlacklistService(redisServiceMock as never);
}

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('RefreshTokenBlacklistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores blacklist key using jti with remaining TTL', async () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = createJwt({ exp, jti: 'refresh-jti-1' });

    const service = buildService();
    await service.revoke(token);

    expect(redisServiceMock.setWithTtl).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = redisServiceMock.setWithTtl.mock.calls[0];

    expect(key).toBe('blacklist:refresh:jti:refresh-jti-1');
    expect(value).toBe('1');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('stores blacklist key using token hash when jti is missing', async () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = createJwt({ exp });
    const expectedHash = createHash('sha256').update(token).digest('hex');

    const service = buildService();
    await service.revoke(token);

    expect(redisServiceMock.setWithTtl).toHaveBeenCalledWith(
      `blacklist:refresh:hash:${expectedHash}`,
      '1',
      expect.any(Number),
    );
  });

  it('is idempotent for already expired tokens', async () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    const token = createJwt({ exp, jti: 'expired-jti' });

    const service = buildService();
    await service.revoke(token);

    expect(redisServiceMock.setWithTtl).not.toHaveBeenCalled();
  });

  it('rejects revoked tokens during validation', async () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = createJwt({ exp, jti: 'revoked-jti' });
    redisServiceMock.exists.mockResolvedValue(true);

    const service = buildService();

    await expect(service.assertNotRevoked(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
