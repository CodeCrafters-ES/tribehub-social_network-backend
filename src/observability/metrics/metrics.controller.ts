// src/observability/metrics/metrics.controller.ts
//
// Exposes the Prometheus scrape endpoint at a secret, unpredictable path:
//
//   GET /api/v1/_internal/<METRICS_PATH_SECRET>-metrics
//
// The route is built at runtime from the METRICS_PATH_SECRET environment
// variable so the path is not hardcoded and is not the standard /metrics.
//
// Authentication is handled by MetricsAuthMiddleware (Basic Auth) which is
// applied to this route in MetricsModule.configure().
//
// On success the response body is raw Prometheus text (no JSON wrapper)
// with Content-Type: text/plain; version=0.0.4.

import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('_internal/:secret-metrics')
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const expectedSecret = process.env.METRICS_PATH_SECRET;

    // Validate the secret segment from the URL at the controller level as a
    // second line of defence (the middleware handles auth; this handles path).
    const providedSecret = req.params['secret'];
    if (!expectedSecret || providedSecret !== expectedSecret) {
      res.status(404).end();
      return;
    }

    const metrics = await this.metricsService.getMetrics();
    res
      .status(200)
      .setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(metrics);
  }
}
