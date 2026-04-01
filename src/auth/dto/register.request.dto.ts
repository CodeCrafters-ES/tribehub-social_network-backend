import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  MinLength,
} from 'class-validator';
import { NoSpaces } from '../../common/decorators/no-spaces.decorator';

export class RegisterRequestDto {
  @IsEmail()
  @IsNotEmpty({ message: 'Campo email no debe ir vacío' })
  email: string;

  @IsNotEmpty({ message: 'Nombre de usuario no debe ir vacío' })
  @NoSpaces({ always: true, message: 'No debe tener espacio(s)' })
  username: string;

  @IsNotEmpty({ always: true, message: 'La contraseña no debe ir vacía' })
  @MinLength(8, {
    message: 'La contraseña debe contener al menos ocho caracteres',
  })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}
