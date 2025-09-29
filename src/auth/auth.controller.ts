// src/auth/auth.controller.ts

import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    console.log('Register request:', { email: dto.email, username: dto.username });
    try {
      const result = await this.authService.register(dto);
      return {
        success: true,
        data: result,
        message: 'User registered successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        code: 'REGISTER_ERROR',
        message: error.message
      });
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    // Enhanced logging for debugging
    console.log('🔐 === LOGIN REQUEST DEBUG ===');
    console.log('🔐 Raw DTO received:', JSON.stringify(dto, null, 2));
    console.log('🔐 DTO properties:', Object.keys(dto));
    console.log('🔐 DTO values:', Object.values(dto));

    const { email, password } = dto;
    console.log('🔐 Parsed data:', {
      email,
      password: password ? '***PROVIDED***' : 'MISSING',
      passwordType: typeof password,
      emailType: typeof email
    });

    try {
      const result = await this.authService.login(dto);
      return {
        success: true,
        data: result,
        message: 'Login successful'
      };
    } catch (error) {
      console.log('🔐 Login error:', error.message);
      throw new BadRequestException({
        code: 'LOGIN_ERROR',
        message: error.message
      });
    }
  }
}
