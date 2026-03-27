// prisma.config.ts
//
// Archivo de configuración de Prisma 7+.
//
// Por qué existe este archivo:
//   A partir de Prisma 7, la URL de conexión a la base de datos se separó
//   del schema.prisma y se movió aquí. Esto desacopla la configuración de
//   conexión del modelo de datos y permite leer variables de entorno con
//   lógica TypeScript normal.
//
// Responsabilidad de cada sección:
//   schema   — dónde está el archivo de modelos
//   datasource.url — URL que usan los comandos de la CLI (migrate, studio,
//                    introspect). En runtime (NestJS) el adapter toma este
//                    rol directamente en PrismaService.
//
// Por qué usamos defineConfig:
//   defineConfig es la función de Prisma 7 que valida la configuración
//   en compilación, detectando errores antes de que la app arranque.
//
// Nota: Este archivo lo usa SOLO la CLI de Prisma.
//       El runtime (NestJS) conecta a través del adapter en PrismaService.

import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Cargamos dotenv manualmente porque este archivo se ejecuta fuera de NestJS.
// En producción (Railway) las variables ya están en process.env.
import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
