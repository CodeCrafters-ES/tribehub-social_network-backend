// src/common/middleware/request-id.middleware.ts
//
// Global middleware that ensures every incoming request carries a unique
// requestId for log correlation. If the client already provides an
// X-Request-Id header it is reused; otherwise a new UUID v4 is generated.
// The value is:
//   1. Attached to the request object so guards/interceptors/services can read it.
//   2. Included in the X-Request-Id response header.

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// Extend Express Request so TypeScript knows about the custom property.
declare module 'express' {
  interface Request {
    requestId: string;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    // Use the client-supplied value if it is a non-empty string; otherwise
    // generate a fresh UUID v4 via the built-in Node.js crypto module.
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim()
        : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
