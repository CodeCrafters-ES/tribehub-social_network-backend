import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeleteAccountConfirmDto } from './dto/delete-account-confirm.dto';
import * as argon2 from 'argon2';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async confirmDeleteRequest(data: DeleteAccountConfirmDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      data.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    return true;
  }
}