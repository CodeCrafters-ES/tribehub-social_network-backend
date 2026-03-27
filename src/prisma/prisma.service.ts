// src/prisma/prisma.service.ts
//
// PrismaService es el wrapper de NestJS sobre PrismaClient.
//
// Por qué extiende PrismaClient en lugar de encapsularlo:
//   Extender PrismaClient expone directamente toda la API tipada de Prisma
//   (prisma.user, prisma.post, etc.) en el servicio. Si lo encapsuláramos
//   habría que reexportar cada propiedad manualmente.
//
// Por qué implementa OnModuleInit y OnModuleDestroy:
//   NestJS llama onModuleInit() cuando el módulo arranca y onModuleDestroy()
//   cuando la aplicación se cierra (SIGTERM, SIGINT). Esto garantiza que la
//   conexión al pool de PostgreSQL se abra y se cierre de forma controlada.
//   Sin esto, la app podría cerrarse dejando conexiones abiertas en Supabase.
//
// Por qué usamos el adapter PrismaPg en Prisma 7:
//   Prisma 7 adoptó el modelo de "driver adapters" para el runtime.
//   En lugar de que PrismaClient gestione su propia conexión TCP interna,
//   le pasamos un pool de conexiones de `pg` (el driver nativo de Node.js
//   para PostgreSQL). Esto nos da control explícito sobre el pool y es
//   compatible con entornos serverless/edge.

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      // log determina qué eventos de Prisma se emiten.
      // No se loguean 'query' porque expondrían valores de parámetros
      // en los logs (potencial filtrado de datos sensibles).
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Guardamos la referencia al pool para poder cerrarlo en onModuleDestroy
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Prisma disconnected from database');
  }
}
