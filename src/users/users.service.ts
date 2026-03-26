// src/users/users.service.ts

import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  private users: User[] = []; // En memoria para demo; en prod usar DB

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(user => user.email === email) || null;
  }

  async createUser(email: string, username: string, password: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new UnauthorizedException('User already exists');
    }
    const passwordHash = await argon2.hash(password);
    const user: User = {
      id: Date.now().toString(), // Simple ID
      email,
      username,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return await argon2.verify(user.passwordHash, password);
  }
}