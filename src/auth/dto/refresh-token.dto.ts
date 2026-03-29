import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsOptional()
  @IsString({ message: 'refreshToken debe ser texto' })
  refreshToken?: string;
}
