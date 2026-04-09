import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { DeleteAccountConfirmDto } from './dto/delete-account-confirm.dto';

@Controller('account')
export class AccountController {
  
  @Post('delete/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDelete(@Body() body: DeleteAccountConfirmDto) {
    console.log('Datos limpios recibidos en el backend:', body);
    return { ok: true }; 
  }
}