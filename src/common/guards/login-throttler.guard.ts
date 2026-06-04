// src/common/guards/login-throttler.guard.ts

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { SecurityMonitorService } from '../../observability/alerts/security-monitor.service';

/**
 * Rate-limit guard for the unauthenticated login endpoint.
 *
 * The default ThrottlerGuard buckets by IP only, which an attacker can evade by
 * rotating IPs (to brute-force a single account) and which can also lock out a
 * whole shared NAT. This guard buckets by IP **and** the normalised email from
 * the request body, so the limit follows both dimensions. Combined with the
 * global IP-based ThrottlerGuard, this enforces "per IP AND per (IP+email)" —
 * an attacker cannot evade one dimension by rotating the other.
 *
 * Apply together with the per-route limit:
 *   @UseGuards(LoginThrottlerGuard)
 *   @Throttle({ default: { limit: 5, ttl: 300000 } })
 *
 * On limit breach it logs the event with minimal context (ip, endpoint,
 * timestamp) — never the email in clear nor any password — feeds the existing
 * brute-force detector and returns a 429 whose body matches the API contract.
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

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const ip = request.ip ?? 'unknown';
    const body = (request.body ?? {}) as { email?: unknown };
    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : undefined;
    return Promise.resolve(
      email ? `login:ip:${ip}:email:${email}` : `login:ip:${ip}`,
    );
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

    throw new HttpException(
      { message: 'Too many requests', error: 'Too Many Requests' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
