// src/auth/dto/login.response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDataDto {
  @ApiProperty({
    description: 'Internal user UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'johndoe',
  })
  username!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'johndoe@example.com',
  })
  email!: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Indicates whether the operation succeeded',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Public user data — no tokens or sensitive fields',
    type: LoginUserDataDto,
  })
  data!: LoginUserDataDto;

  @ApiProperty({
    description: 'Human-readable result message',
    example: 'Login successful',
  })
  message!: string;
}
