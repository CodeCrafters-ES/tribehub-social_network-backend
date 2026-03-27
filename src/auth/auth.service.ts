// src/auth/auth.service.ts

import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { getSupabaseClient } from '../config/supabase.config';
import { UsersRepository } from '../modules/users/repositories/users.repository';

@Injectable()
export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async register(data: RegisterDto) {
    const { email, password, username } = data;

    // Check for duplicate email
    const existingByEmail = await this.usersRepository.findByEmail(email);
    if (existingByEmail) {
      throw new ConflictException('Email already in use');
    }

    // Check for duplicate username
    const existingByUsername =
      await this.usersRepository.findByUsername(username);
    if (existingByUsername) {
      throw new ConflictException('Username already in use');
    }

    // Register in Supabase Auth
    const supabase = getSupabaseClient();
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });
    if (error) {
      throw new Error(error.message);
    }

    const supabaseUserId = signUpData.user?.id;

    // Hash password with Argon2
    const passwordHash = await argon2.hash(password);

    // Persist user in local database
    try {
      const user = await this.usersRepository.create({
        email,
        username,
        passwordHash,
        supabaseId: supabaseUserId,
      });

      // Return only public fields — never include passwordHash
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      };
    } catch (err: unknown) {
      // Map Prisma unique constraint violation to ConflictException
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email or username already in use');
      }
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async login(data: LoginDto) {
    const supabase = getSupabaseClient();
    const { email, password } = data;
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    return signInData;
  }
}
