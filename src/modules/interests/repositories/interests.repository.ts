// src/modules/interests/repositories/interests.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Interest } from '@prisma/client';

export interface InterestItem {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  status: string;
}

@Injectable()
export class InterestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllValidated(category?: string): Promise<Interest[]> {
    return this.prisma.interest.findMany({
      where: {
        status: 'VALIDATED',
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findManyByIds(ids: string[]): Promise<Interest[]> {
    return this.prisma.interest.findMany({
      where: { id: { in: ids } },
    });
  }

  async getUserInterests(userId: string): Promise<InterestItem[]> {
    const rows = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
    });
    return rows.map((r) => ({
      id: r.interest.id,
      name: r.interest.name,
      slug: r.interest.slug,
      category: r.interest.category,
      status: r.interest.status,
    }));
  }

  async setUserInterests(userId: string, interestIds: string[]): Promise<void> {
    console.log('[setUserInterests] userId:', userId, 'interestIds:', interestIds);
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.userInterest.deleteMany({ where: { userId } });
      console.log('[setUserInterests] deleted:', deleted.count);
      for (const interestId of interestIds) {
        const created = await tx.userInterest.create({ data: { userId, interestId } });
        console.log('[setUserInterests] created:', created);
      }
    });
    const check = await this.prisma.userInterest.findMany({ where: { userId } });
    console.log('[setUserInterests] post-tx check count:', check.length);
  }
}
