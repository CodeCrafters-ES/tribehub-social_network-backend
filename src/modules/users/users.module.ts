// src/modules/users/users.module.ts

import { Module } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';

// PrismaModule is global — no need to import it here.
@Module({
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
