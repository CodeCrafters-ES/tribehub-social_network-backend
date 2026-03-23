import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ VALIDATION PIPE GLOBAL - MÁS PERMISSIVO PARA DEBUGGING
  app.useGlobalPipes(new ValidationPipe({
    whitelist: false,                   // ❌ TEMPORAL: Permitir propiedades extras para debugging
    forbidNonWhitelisted: false,       // ❌ TEMPORAL: No rechazar propiedades extras
    transform: true,                   // Transformar payloads a DTOs
    stopAtFirstError: false,           // ❌ TEMPORAL: Mostrar todos los errores
    exceptionFactory: (errors: ValidationError[]) => {
      console.log('🚨 ValidationPipe Errors:', errors.map(error => ({
        property: error.property,
        constraints: error.constraints,
        value: error.value
      })));
      const messages = errors.map(error => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const constraints: string[] = error.constraints ? Object.values(error.constraints) as string[] : [];
        return {
          field: error.property,
          errors: constraints
        };
      });
      return {
        statusCode: 400,
        message: 'Errores de validación',
        errors: messages
      };
    }
  }));

  // ✅ CONFIGURACIÓN CORS MULTI-ENTORNO
  const allowedOrigins = {
    development: [
      'http://localhost:3000',    // Backend mismo dominio
      'http://localhost:5173',    // Vite dev server (puerto por defecto)
      'http://localhost:4173',    // Vite preview
      'http://127.0.0.1:5173',   // Alternativa localhost
      'http://127.0.0.1:3000',   // Backend mismo dominio
    ],
    staging: [
      'https://tu-frontend-staging.vercel.app',
      'https://tu-frontend-staging.netlify.app',
      // Agregar otros dominios de staging según necesites
    ],
    production: [
      'https://tu-frontend-produccion.com',
      'https://www.tu-frontend-produccion.com',
      // Agregar otros dominios de producción según necesites
    ]
  };

  // Determinar el entorno actual
  const nodeEnv = process.env.NODE_ENV || 'development';
  const origins = allowedOrigins[nodeEnv as keyof typeof allowedOrigins] || allowedOrigins.development;

  app.enableCors({
    origin: origins,
    credentials: true,             // Permitir cookies y headers de auth
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers'
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
