// src/modules/interests/interests.module.ts

import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { InterestsController } from './controllers/interests.controller';
import { UserInterestsController } from './controllers/user-interests.controller';
import { InterestsService } from './services/interests.service';
import { InterestsRepository } from './repositories/interests.repository';

// PrismaModule is global — no need to import it here.
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [InterestsController, UserInterestsController],
  providers: [InterestsService, InterestsRepository],
})
export class InterestsModule {}
