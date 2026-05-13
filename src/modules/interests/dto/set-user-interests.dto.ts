// src/modules/interests/dto/set-user-interests.dto.ts

import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetUserInterestsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'List of interest IDs to assign. Empty array resets all interests.',
    example: ['11111111-1111-1111-1111-111111111111'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  interestIds: string[];
}
