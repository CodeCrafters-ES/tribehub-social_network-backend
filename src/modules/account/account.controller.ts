import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AccountService } from './account.service';
import { DeleteAccountConfirmDto } from './dto/delete-account-confirm.dto';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';

@Controller('account')
export class AccountController {
  
  constructor(private readonly accountService: AccountService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('delete/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDelete(@Req() req: any, @Body() body: DeleteAccountConfirmDto) {
    const userId = req.supabaseUser.sub; 
    await this.accountService.confirmDeleteRequest(body, userId);
    
    return { ok: true }; 
  }
}