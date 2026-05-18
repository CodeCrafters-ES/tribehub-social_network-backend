import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeleteAccountConfirmDto } from './dto/delete-account-confirm.dto';
import * as argon2 from 'argon2';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async createDeleteRequest(userId: string) {
    const EXPIRES_IN_SECONDS = 900; //15 minutes
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + EXPIRES_IN_SECONDS);

    return await this.prisma.$transaction(async (tx) => {
      // Invalidate prior requests to prevent token accumulation
      await tx.deleteAccountRequest.updateMany({
        where: {
          userId: userId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      const newRequest = await tx.deleteAccountRequest.create({
        data: {
          userId: userId,
          expiresAt: expiresAt,
        },
      });

      return {
        deleteRequestId: newRequest.id,
        expiresIn: EXPIRES_IN_SECONDS,
      };
    });
  }

  async confirmDeleteRequest(data: DeleteAccountConfirmDto, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const deleteRequest = await tx.deleteAccountRequest.findUnique({
        where: { id: data.deleteRequestId },
        include: { user: true },
      });

      if (!deleteRequest) {
        throw new NotFoundException('Delete request not found');
      }

      const now = new Date();

      if (deleteRequest.userId !== userId) {
        throw new UnauthorizedException(
          'You do not have permission to confirm this request',
        );
      }

      if (deleteRequest.usedAt !== null) {
        throw new BadRequestException(
          'This request has already been processed or invalidated',
        );
      }

      if (deleteRequest.expiresAt < now) {
        throw new BadRequestException(
          'Request has expired. Please request a new one',
        );
      }

      const user = deleteRequest.user;

      if (!user || !user.passwordHash) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await argon2.verify(
        user.passwordHash,
        data.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }

      // Mark the delete request as used to prevent reuse
      await tx.deleteAccountRequest.update({
        where: { id: data.deleteRequestId },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      return { ok: true };
    });
  }
}
