// src/modules/profile/dto/update-profile.dto.ts

import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

/**
 * DTO for updating the user's profile (base/onboarding).
 *
 * Validation rules:
 * - displayName: required, 2-50 chars, permite letras (incluyendo tildes/unicode), espacios y guiones
 * - bio: optional, max 160 chars
 * - avatarUrl: optional, valid URL
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, {
    message: 'Display name must be at least 2 characters',
  })
  @MaxLength(50, {
    message: 'Display name must be at most 50 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, {
    message: 'Bio must be at most 160 characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  bio?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['https', 'http'],
    require_tld: true,
  })
  avatarUrl?: string;
}
