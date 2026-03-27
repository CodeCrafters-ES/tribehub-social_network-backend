// src/modules/users/users.module.ts

import { Module } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';

// PrismaModule is global — no need to import it here.
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
