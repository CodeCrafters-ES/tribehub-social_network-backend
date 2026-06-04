// src/common/guards/login-throttler.guard.ts

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerOptions,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { SecurityMonitorService } from '../../observability/alerts/security-monitor.service';

/** Login rate-limit policy: 5 attempts per 5-minute sliding window. */
export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_TTL_MS = 5 * 60 * 1000;

function clientIp(req: Record<string, unknown>): string {
  const ip = (req as { ip?: unknown }).ip;
  return typeof ip === 'string' && ip.length > 0 ? ip : 'unknown';
}

function normalisedEmail(req: Record<string, unknown>): string | undefined {
  const body = (req as { body?: unknown }).body;
  const email =
    body && typeof body === 'object'
      ? (body as { email?: unknown }).email
      : undefined;
  return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
}

/** Tracker keyed by client IP only (caps total attempts from one address). */
export function loginIpTracker(req: Record<string, unknown>): string {
  return `login:ip:${clientIp(req)}`;
}

/** Tracker keyed by client IP + normalised email (caps attempts per account). */
export function loginIpEmailTracker(req: Record<string, unknown>): string {
  const email = normalisedEmail(req);
  return email
    ? `login:ip:${clientIp(req)}:email:${email}`
    : `login:ip:${clientIp(req)}`;
}

/**
 * Rate-limit guard for the unauthenticated login endpoint.
 *
 * The login route is governed SOLELY by this guard: it carries `@SkipThrottle()`
 * so the global IP-based ThrottlerGuard (APP_GUARD) does not also police it.
 * Were the global guard left active it would run first and answer with the
 * default ThrottlerException body, never reaching this guard's contract-shaped
 * 429 nor its security logging.
 *
 * Two independent dimensions are enforced (both 5 attempts / 5 min):
 *   - `login-ip`       — caps total attempts from a single IP (brute-force).
 *   - `login-ip-email` — caps attempts against a single account, so an attacker
 *                        cannot evade by changing the targeted email.
 *
 * On breach it logs a non-sensitive event (ip, endpoint, timestamp — never the
 * email in clear nor any password), feeds the existing brute-force detector and
 * returns a 429 whose body matches the API contract.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(LoginThrottlerGuard.name);

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly securityMonitor: SecurityMonitorService,
  ) {
    super(options, storageService, reflector);
  }

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    // Replace the inherited module throttler with login-specific ones, so this
    // guard enforces its own limits independently of the global 'default'
    // throttler (which the route disables via @SkipThrottle()). Each throttler
    // carries its own tracker, sharing the same Redis storage as the rest of
    // the app for multi-instance consistency.
    this.throttlers = [
      {
        name: 'login-ip',
        ttl: LOGIN_RATE_TTL_MS,
        limit: LOGIN_RATE_LIMIT,
        getTracker: (req: Record<string, unknown>) => loginIpTracker(req),
      },
      {
        name: 'login-ip-email',
        ttl: LOGIN_RATE_TTL_MS,
        limit: LOGIN_RATE_LIMIT,
        getTracker: (req: Record<string, unknown>) => loginIpEmailTracker(req),
      },
    ] as ThrottlerOptions[];
  }

  protected throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    // Minimal, non-sensitive context only — no email in clear, no password.
    this.logger.warn({
      event: 'auth.login.rate_limited',
      ip: request.ip ?? 'unknown',
      endpoint: `${request.method} ${request.originalUrl}`,
      timestamp: new Date().toISOString(),
    });
    this.securityMonitor.recordFailedLogin();

    // Include statusCode in the body so the 429 contract is self-contained and
    // does not rely on a downstream exception filter to inject it.
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
