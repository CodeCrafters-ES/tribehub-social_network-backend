// prisma/seed.ts
//
// Development seed data for system_configs (feature flags) and interests catalog.
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

  const interests = [
    { name: 'Technology', slug: 'technology', category: 'Tech' },
    { name: 'Programming', slug: 'programming', category: 'Tech' },
    { name: 'Web Development', slug: 'web-development', category: 'Tech' },
    { name: 'Mobile Development', slug: 'mobile-development', category: 'Tech' },
    { name: 'Artificial Intelligence', slug: 'artificial-intelligence', category: 'Tech' },
    { name: 'Data Science', slug: 'data-science', category: 'Tech' },
    { name: 'Cybersecurity', slug: 'cybersecurity', category: 'Tech' },
    { name: 'Open Source', slug: 'open-source', category: 'Tech' },
    { name: 'Music', slug: 'music', category: 'Arts' },
    { name: 'Photography', slug: 'photography', category: 'Arts' },
    { name: 'Film & Cinema', slug: 'film-cinema', category: 'Arts' },
    { name: 'Visual Arts', slug: 'visual-arts', category: 'Arts' },
    { name: 'Writing', slug: 'writing', category: 'Arts' },
    { name: 'Design', slug: 'design', category: 'Arts' },
    { name: 'Gaming', slug: 'gaming', category: 'Entertainment' },
    { name: 'Esports', slug: 'esports', category: 'Entertainment' },
    { name: 'Podcasts', slug: 'podcasts', category: 'Entertainment' },
    { name: 'Comedy', slug: 'comedy', category: 'Entertainment' },
    { name: 'Fitness', slug: 'fitness', category: 'Health' },
    { name: 'Mental Health', slug: 'mental-health', category: 'Health' },
    { name: 'Nutrition', slug: 'nutrition', category: 'Health' },
    { name: 'Yoga', slug: 'yoga', category: 'Health' },
    { name: 'Running', slug: 'running', category: 'Sports' },
    { name: 'Football', slug: 'football', category: 'Sports' },
    { name: 'Basketball', slug: 'basketball', category: 'Sports' },
    { name: 'Cycling', slug: 'cycling', category: 'Sports' },
    { name: 'Climbing', slug: 'climbing', category: 'Sports' },
    { name: 'Travel', slug: 'travel', category: 'Lifestyle' },
    { name: 'Food & Cooking', slug: 'food-cooking', category: 'Lifestyle' },
    { name: 'Fashion', slug: 'fashion', category: 'Lifestyle' },
    { name: 'Sustainability', slug: 'sustainability', category: 'Lifestyle' },
    { name: 'Entrepreneurship', slug: 'entrepreneurship', category: 'Business' },
    { name: 'Finance & Investing', slug: 'finance-investing', category: 'Business' },
    { name: 'Marketing', slug: 'marketing', category: 'Business' },
    { name: 'Science', slug: 'science', category: 'Education' },
    { name: 'History', slug: 'history', category: 'Education' },
    { name: 'Philosophy', slug: 'philosophy', category: 'Education' },
    { name: 'Languages', slug: 'languages', category: 'Education' },
    { name: 'Pets & Animals', slug: 'pets-animals', category: 'Lifestyle' },
    { name: 'Volunteering', slug: 'volunteering', category: 'Community' },
  ];

  for (const interest of interests) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: { name: interest.name, category: interest.category, status: 'VALIDATED' },
      create: { name: interest.name, slug: interest.slug, category: interest.category, status: 'VALIDATED' },
    });
    console.log(`Seeded interest: ${interest.name}`);
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
