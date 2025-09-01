// src/auth/auth.service.ts

import { Injectable } from '@nestjs/common';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable()
export class AuthService {
  async register(data: RegisterDto) {
    const supabase = getSupabaseClient();
    const { email, password, username } = data;
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });
    if (error) {
      throw new Error(error.message);
    }
    return signUpData;
  }

  async login(data: LoginDto) {
    const supabase = getSupabaseClient();
    const { email, password } = data;
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw new Error(error.message);
    }
    return signInData;
  }
}
