import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NoSpaces } from '../../common/decorators/no-spaces.decorator';

export class RegisterRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty({ message: 'Campo email no debe ir vacío' })
  email: string;

  @ApiProperty({
    description: 'Unique username (no spaces allowed)',
    example: 'testuser',
  })
  @IsNotEmpty({ message: 'Nombre de usuario no debe ir vacío' })
  @NoSpaces({ always: true, message: 'No debe tener espacio(s)' })
  username: string;

  @ApiProperty({
    description:
      'Password (min 8 chars, at least 1 lowercase, 1 number, 1 symbol)',
    example: 'Secure@123',
  })
  @IsNotEmpty({ always: true, message: 'La contraseña no debe ir vacía' })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}
