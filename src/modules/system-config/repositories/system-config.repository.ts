// src/modules/system-config/repositories/system-config.repository.ts
//
// Only place in SystemConfigModule that calls PrismaService.
// No other module may access the system_configs table directly.

import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SystemConfigRecord {
  id: string;
  key: string;
  value: unknown;
  valueType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SystemConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the config record for the given key, or null if not found.
   */
  async findByKey(key: string): Promise<SystemConfigRecord | null> {
    const client = this.prisma as unknown as PrismaClient;
    return client.systemConfig.findUnique({
      where: { key },
    }) as Promise<SystemConfigRecord | null>;
  }

  /**
   * Returns all config records. Used for warming the cache on startup.
   */
  async findAll(): Promise<SystemConfigRecord[]> {
    const client = this.prisma as unknown as PrismaClient;
    return client.systemConfig.findMany() as Promise<SystemConfigRecord[]>;
  }
}
