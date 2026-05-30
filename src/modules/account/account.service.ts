import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountRepository } from './repositories/account.repository';
import { PasswordHashService } from '../../auth/password-hash.service';
import { DeleteAccountConfirmDto } from './dto/delete-account-confirm.dto';

@Injectable()
export class AccountService {
  /** Default TTL for a delete-account challenge (15 minutes). */
  private static readonly DEFAULT_EXPIRES_IN_SECONDS = 900;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly configService: ConfigService,
  ) {}

  private getExpiresInSeconds(): number {
    return this.configService.get<number>(
      'ACCOUNT_DELETE_REQUEST_TTL_SECONDS',
      AccountService.DEFAULT_EXPIRES_IN_SECONDS,
    );
  }

  async createDeleteRequest(userId: string) {
    const expiresInSeconds = this.getExpiresInSeconds();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    const request = await this.accountRepository.createRequest(
      userId,
      expiresAt,
    );

    return {
      deleteRequestId: request.id,
      expiresIn: expiresInSeconds,
    };
  }

  async confirmDeleteRequest(data: DeleteAccountConfirmDto, userId: string) {
    const deleteRequest = await this.accountRepository.findById(
      data.deleteRequestId,
    );

    // A non-existent request and a request owned by another user must be
    // indistinguishable to avoid leaking the existence of other users'
    // requests (enumeration oracle). Both return 404.
    if (!deleteRequest || deleteRequest.userId !== userId) {
      throw new NotFoundException('Delete request not found');
    }

    if (deleteRequest.expiresAt < new Date()) {
      throw new BadRequestException(
        'Request has expired. Please request a new one',
      );
    }

    if (deleteRequest.usedAt !== null) {
      throw new BadRequestException(
        'This request has already been processed or invalidated',
      );
    }

    const user = deleteRequest.user;
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordHashService.verify(
      user.passwordHash,
      data.password,
    );

    if (!isPasswordValid) {
      // The request is intentionally NOT consumed on a wrong password.
      throw new UnauthorizedException('Invalid password');
    }

    await this.accountRepository.consumeRequestAndSoftDeleteUser(
      deleteRequest.id,
      userId,
    );

    return { ok: true };
  }
}
