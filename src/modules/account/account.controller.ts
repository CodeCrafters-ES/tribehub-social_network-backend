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
import { ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { isUUID } from 'class-validator';
import { AccountService } from './account.service';
import { DeleteAccountRequestDto } from './dto/delete-account-request.dto';
import { DeleteAccountConfirmDto } from './dto/delete-account-confirm.dto';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // UserThrottlerGuard runs after SupabaseAuthGuard so it can key the rate
  // limit by the authenticated user id (resistant to IP rotation).
  @UseGuards(SupabaseAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('delete/request')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: DeleteAccountRequestDto })
  async requestDelete(
    @Req() req: AuthenticatedRequest,
    @Body() _body: DeleteAccountRequestDto,
  ) {
    const userId = req.supabaseUser.sub;

    if (!userId || !isUUID(userId)) {
      throw new BadRequestException('Invalid user identifier');
    }
    return this.accountService.createDeleteRequest(userId);
  }

  @UseGuards(SupabaseAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @Post('delete/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDelete(
    @Req() req: AuthenticatedRequest,
    @Body() body: DeleteAccountConfirmDto,
  ) {
    const userId = req.supabaseUser.sub;

    if (!userId || !isUUID(userId)) {
      throw new BadRequestException('Invalid user identifier');
    }
    return this.accountService.confirmDeleteRequest(body, userId);
  }
}
