// prisma/seed.ts
//
// Development seed data for system_configs (feature flags).
//
// Run with:
//   npx prisma db seed
//
// Key naming convention:
//   feature.<domain>.<flag>  — boolean feature toggles
//   config.<domain>.<param>  — configuration parameters
//
// All upsert calls are idempotent — safe to run multiple times.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const flags = [
    {
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
    },
    {
      key: 'feature.search.enabled',
      value: true,
      valueType: 'boolean',
    },
    {
      key: 'feature.reactions.enabled',
      value: true,
      valueType: 'boolean',
    },
    {
      key: 'config.search.rateLimit',
      value: 30,
      valueType: 'number',
    },
  ];

  for (const flag of flags) {
    await prisma.systemConfig.upsert({
      where: { key: flag.key },
      update: { value: flag.value, valueType: flag.valueType },
      create: { key: flag.key, value: flag.value, valueType: flag.valueType },
    });
    console.log(`Seeded: ${flag.key} = ${JSON.stringify(flag.value)}`);
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
