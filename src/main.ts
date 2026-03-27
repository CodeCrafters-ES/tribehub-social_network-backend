import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
        return {
          statusCode: 400,
          message: 'Errores de validación',
          errors: messages,
        };
      },
    }),
  );

  const nodeEnv = process.env.NODE_ENV || 'development';

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
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: ['Authorization'], // Exponer headers para el frontend
    maxAge: 86400, // Cache preflight por 24 horas
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`🌍 CORS enabled for environment: ${nodeEnv}`);
  console.log(`📝 Allowed origins: ${origins.join(', ')}`);
}
void bootstrap();
