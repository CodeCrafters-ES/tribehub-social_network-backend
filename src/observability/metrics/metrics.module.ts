// src/observability/metrics/metrics.module.ts
//
// Wires together MetricsService, MetricsController, and MetricsAuthMiddleware.
//
// The Basic Auth middleware is applied ONLY to the _internal/* path so that
// it does not interfere with any other routes.

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsAuthMiddleware } from './metrics-auth.middleware';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply Basic Auth only to the internal metrics path.
    consumer.apply(MetricsAuthMiddleware).forRoutes('_internal/*');
  }
}
