// src/modules/interests/dto/interest-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class InterestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ nullable: true })
  category: string | null;

  @ApiProperty({ enum: ['VALIDATED', 'PENDING', 'INACTIVE'] })
  status: string;
}
