import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ObservabilityModule } from './observability/observability.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { HttpMetricsInterceptor } from './observability/http-metrics.interceptor';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { InterestsModule } from './modules/interests/interests.module';
import { FeedModule } from './modules/feed/feed.module';
import { SearchModule } from './modules/search/search.module';
import { QueuesModule } from './queues/queues.module';
import { BullboardModule } from './admin/queues/bullboard.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AccountModule } from './modules/account/account.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { buildRedisClient } from './queues/redis.connection';

@Module({
  imports: [
    // Shared Redis store so rate limits stay consistent across replicas.
    // Reuses the existing Redis connection helper (the app already requires
    // REDIS_URL via QueuesModule, so this adds no new infrastructure need).
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60000, limit: 20 }],
        storage: new ThrottlerStorageRedisService(buildRedisClient()),
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the env file that matches the current NODE_ENV.
      // Fallback to .env.development so local dev works without setting NODE_ENV.
      // In Railway (production/staging), the platform injects env vars directly
      // into process.env before the process starts, so the file may not exist —
      // ignoreEnvFile: false is intentional: if the file is missing ConfigModule
      // simply finds nothing and defers to whatever is already in process.env.
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
    }),
    PrismaModule, // Global: PrismaService queda disponible en toda la app
    AuthModule,
    HealthModule,
    ObservabilityModule,
    SystemConfigModule,
    InterestsModule,
    FeedModule,
    SearchModule,
    QueuesModule,
    BullboardModule,
    ProfileModule,
    AccountModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
