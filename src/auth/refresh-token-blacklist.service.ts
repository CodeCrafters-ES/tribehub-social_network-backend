import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { decode, type JwtPayload } from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

type BlacklistKeyInfo = {
  key: string;
  ttlSeconds: number;
};

@Injectable()
export class RefreshTokenBlacklistService {
  private static readonly KEY_PREFIX = 'blacklist:refresh';

  constructor(private readonly redisService: RedisService) {}

  async revoke(refreshToken: string): Promise<void> {
    const keyInfo = this.buildBlacklistKeyInfo(refreshToken);
    if (!keyInfo) {
      return;
    }

    try {
      await this.redisService.setWithTtl(keyInfo.key, '1', keyInfo.ttlSeconds);
    } catch {
      throw new ServiceUnavailableException(
        'Token revocation service unavailable',
      );
    }
  }

  async assertNotRevoked(refreshToken: string): Promise<void> {
    const keyInfo = this.buildBlacklistKeyInfo(refreshToken);
    if (!keyInfo) {
      return;
    }

    try {
      const isRevoked = await this.redisService.exists(keyInfo.key);
      if (isRevoked) {
        throw new UnauthorizedException('Invalid refresh token');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Token validation service unavailable',
      );
    }
  }

  private buildBlacklistKeyInfo(refreshToken: string): BlacklistKeyInfo | null {
    const payload = decode(refreshToken);
    if (!payload || typeof payload === 'string') {
      return null;
    }

    const tokenPayload = payload as JwtPayload;
    if (typeof tokenPayload.exp !== 'number') {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = tokenPayload.exp - nowSeconds;
    if (ttlSeconds <= 0) {
      return null;
    }

    const jti = this.sanitizeJti(tokenPayload.jti);
    if (jti) {
      return {
        key: `${RefreshTokenBlacklistService.KEY_PREFIX}:jti:${jti}`,
        ttlSeconds,
      };
    }

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    return {
      key: `${RefreshTokenBlacklistService.KEY_PREFIX}:hash:${tokenHash}`,
      ttlSeconds,
    };
  }

  private sanitizeJti(jti: JwtPayload['jti']): string | null {
    if (typeof jti !== 'string') {
      return null;
    }

    const cleanedJti = jti.trim();
    return cleanedJti.length > 0 ? cleanedJti : null;
  }
}
