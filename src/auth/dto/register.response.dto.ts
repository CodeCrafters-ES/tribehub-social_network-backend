import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserDataDto {
  @ApiProperty({
    description: 'Unique identifier of the created user (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Email address of the created user',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Username of the created user',
    example: 'testuser',
  })
  username!: string;

  @ApiProperty({
    description: 'Timestamp when the user was created',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: Date;
}

export class RegisterResponseDto {
  @ApiProperty({
    description: 'Indicates whether the operation succeeded',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Created user data (public fields only)',
    type: RegisterUserDataDto,
  })
  data!: RegisterUserDataDto;

  @ApiProperty({
    description: 'Human-readable result message',
    example: 'User registered successfully',
  })
  message!: string;
}
