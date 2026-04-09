import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
export class DeleteAccountConfirmDto {
  @IsNotEmpty()
  @IsUUID()
  deleteRequestId!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}