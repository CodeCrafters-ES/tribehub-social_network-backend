// src/observability/metrics/metrics-auth.middleware.ts
//
// Express middleware that enforces HTTP Basic Auth on the metrics endpoint.
//
// Two env vars drive the check:
//   METRICS_USER — username (required)
//   METRICS_PASS — password (required)
//
// When credentials are missing from the environment the middleware rejects
// every request with 503 to avoid accidentally exposing the endpoint.
//
// On failure the response includes:
//   401 Unauthorized
//   WWW-Authenticate: Basic realm="Metrics"

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class MetricsAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const expectedUser = process.env.METRICS_USER;
    const expectedPass = process.env.METRICS_PASS;

    // If the env vars are not configured refuse all access.
    if (!expectedUser || !expectedPass) {
      res.status(503).json({
        message: 'Metrics endpoint is not configured on this server.',
      });
      return;
    }

    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Decode the Base64-encoded "user:pass" credential string.
    const base64Credentials = authHeader.slice('Basic '.length);
    const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = decoded.slice(0, colonIndex);
    const pass = decoded.slice(colonIndex + 1);

    if (user !== expectedUser || pass !== expectedPass) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    next();
  }
}
