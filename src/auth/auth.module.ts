// src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../modules/users/users.module';
import { RedisModule } from '../redis/redis.module';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';

@Module({
  imports: [UsersModule, RedisModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenBlacklistService],
})
export class AuthModule {}
