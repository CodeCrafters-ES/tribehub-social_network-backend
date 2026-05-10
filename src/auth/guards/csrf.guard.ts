import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
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

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
