import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { DeleteAccountConfirmDto } from './dto/delete-account-confirm.dto';
import {
  SupabaseAuthGuard,
  AuthenticatedRequest,
} from '../../auth/guards/supabase-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { isUUID } from 'class-validator';
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('delete/request')
  @HttpCode(HttpStatus.OK)
  async requestDelete(@Req() req: AuthenticatedRequest) {
    const userId = req.supabaseUser.sub;

    if (!isUUID(userId)) {
      throw new BadRequestException('Invalid user identifier');
    }
    return await this.accountService.createDeleteRequest(userId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @Post('delete/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDelete(
    @Req() req: AuthenticatedRequest,
    @Body() body: DeleteAccountConfirmDto,
  ) {
    const userId = req.supabaseUser.sub;
    if (!isUUID(userId)) {
      throw new BadRequestException('Invalid user identifier');
    }
    return await this.accountService.confirmDeleteRequest(body, userId);
  }
}
