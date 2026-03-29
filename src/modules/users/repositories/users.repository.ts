// src/modules/users/repositories/users.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
  supabaseId?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string | null;
  supabaseId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserData): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        supabaseId: data.supabaseId ?? null,
      },
    });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  findByUsername(username: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });
  }
}
