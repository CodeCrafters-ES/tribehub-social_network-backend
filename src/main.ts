import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { AppModule } from './app.module';
import {
  BullboardModule,
  BULLBOARD_ADAPTER,
} from './admin/queues/bullboard.module';
import type { ExpressAdapter } from '@bull-board/express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const nodeEnv = process.env.NODE_ENV || 'development';

  // Trust the reverse proxy (Railway/Netlify) so that `req.ip` reflects the
  // real client IP taken from X-Forwarded-For — essential for correct per-IP
  // rate limiting. We trust a FIXED number of proxy hops (not `true`): trusting
  // every X-Forwarded-For entry would let a client spoof its IP and evade the
  // limits. Defaults to 0 in development (no proxy) and 1 in staging/production
  // (single Railway edge proxy); override with TRUST_PROXY_HOPS if the infra
  // adds more hops.
  const trustProxyHops = Number(
    process.env.TRUST_PROXY_HOPS ?? (nodeEnv === 'development' ? 0 : 1),
  );
  app.set('trust proxy', Number.isNaN(trustProxyHops) ? 1 : trustProxyHops);

  app.use(cookieParser());

  app.setGlobalPrefix('/api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = errors.map((error) => {
          const constraintsMap: Record<string, string> = (error.constraints ??
            {}) as Record<string, string>;
          const constraints: string[] = Object.values(constraintsMap);
          return {
            field: error.property,
            errors: constraints,
          };
        });
        return new BadRequestException({
          message: 'Errores de validación',
          errors: messages,
        });
      },
    }),
  );

  const corsOriginsByEnv: Record<string, string[]> = {
    development: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ],
    staging: process.env.CORS_ORIGINS_STAGING
      ? process.env.CORS_ORIGINS_STAGING.split(',').map((o) => o.trim())
      : [],
    production: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : [],
  };

  const origins = corsOriginsByEnv[nodeEnv] ?? corsOriginsByEnv.development;

  app.enableCors({
    origin: origins,
    credentials: true, // Permitir cookies y headers de auth
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Request-Id',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: ['Authorization', 'X-Request-Id'], // Exponer headers para el frontend
    maxAge: 86400, // Cache preflight por 24 horas
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TribeHub API')
    .setDescription('TribeHub social network REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const bullboardAdapter = app
    .select(BullboardModule)
    .get<ExpressAdapter>(BULLBOARD_ADAPTER);

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  app.use(
    '/admin/queues',
    (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers['authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
        return;
      }

      const token = authHeader.replace('Bearer ', '');

      if (!jwtSecret) {
        res
          .status(401)
          .json({ statusCode: 401, message: 'JWT secret not configured' });
        return;
      }

      try {
        // jsonwebtoken's verify() return type is a union that includes string,
        // but with a secret (not RequestHandler) it always returns a JwtPayload object.

        const decoded = verify(token, jwtSecret) as unknown as {
          app_metadata?: { role?: string };
        };

        if (decoded.app_metadata?.role !== 'admin') {
          res.status(403).json({ statusCode: 403, message: 'Forbidden' });
          return;
        }

        next();
      } catch {
        res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      }
    },
    bullboardAdapter.getRouter(),
  );

  // Enable graceful shutdown so that NestJS calls onModuleDestroy() on every
  // provider when the process receives SIGTERM or SIGINT. Without this, BullMQ
  // workers, IORedis connections (AppMonitorService, SystemConfigService,
  // QueueMonitorService), and the Prisma pool are never closed — the event loop
  // stays alive and V8 cannot reclaim the associated heap memory.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`🌍 CORS enabled for environment: ${nodeEnv}`);
  console.log(`📝 Allowed origins: ${origins.join(', ')}`);
}
void bootstrap();
