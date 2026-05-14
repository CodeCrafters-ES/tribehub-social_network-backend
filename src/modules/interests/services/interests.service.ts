// src/modules/interests/services/interests.service.ts

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InterestsRepository,
  InterestItem,
} from '../repositories/interests.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { SetUserInterestsDto } from '../dto/set-user-interests.dto';

@Injectable()
export class InterestsService {
  private readonly logger = new Logger(InterestsService.name);

  constructor(
    private readonly interestsRepository: InterestsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async listInterests(category?: string): Promise<{ items: InterestItem[] }> {
    const interests = await this.interestsRepository.findAllValidated(category);
    const items: InterestItem[] = interests.map((i) => ({
      id: i.id,
      name: i.name,
      slug: i.slug,
      category: i.category,
      status: i.status,
    }));
    this.logger.log({
      action: 'interests.list',
      count: items.length,
      category,
    });
    return { items };
  }

  async getUserInterests(
    supabaseId: string,
  ): Promise<{ items: InterestItem[] }> {
    const user = await this.usersRepository.findBySupabaseId(supabaseId);
    if (!user) throw new UnauthorizedException();
    const items = await this.interestsRepository.getUserInterests(user.id);
    this.logger.log({ action: 'userInterests.get', userId: user.id });
    return { items };
  }

  async setUserInterests(
    supabaseId: string,
    dto: SetUserInterestsDto,
  ): Promise<{ items: InterestItem[] }> {
    const user = await this.usersRepository.findBySupabaseId(supabaseId);
    if (!user) throw new UnauthorizedException();

    const uniqueIds = [...new Set(dto.interestIds)];

    if (uniqueIds.length > 0) {
      const found = await this.interestsRepository.findManyByIds(uniqueIds);

      if (found.length !== uniqueIds.length) {
        throw new BadRequestException(
          'One or more interest IDs do not exist or are invalid.',
        );
      }

      const hasPending = found.some((i) => i.status !== 'VALIDATED');
      if (hasPending) {
        throw new BadRequestException(
          'Cannot assign interests with pending status.',
        );
      }
    }

    await this.interestsRepository.setUserInterests(user.id, uniqueIds);
    this.logger.log({
      action: 'userInterests.set',
      userId: user.id,
      count: uniqueIds.length,
    });

    const items = await this.interestsRepository.getUserInterests(user.id);
    return { items };
  }
}
