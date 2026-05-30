import { IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';

export class DeleteAccountConfirmDto {
  @IsNotEmpty()
  @IsUUID()
  deleteRequestId!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;
}
