import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { XSRF_TOKEN_COOKIE } from '../../common/utils/cookies';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies?.[XSRF_TOKEN_COOKIE] as string | undefined;

    const headerToken =
      typeof csrfHeader === 'string' ? csrfHeader.trim() : undefined;
    const cookieToken = csrfCookie?.trim();

    if (
      !headerToken ||
      !cookieToken ||
      !this.safeEqual(headerToken, cookieToken)
    ) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
