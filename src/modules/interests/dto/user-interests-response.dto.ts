// src/modules/interests/dto/user-interests-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { InterestResponseDto } from './interest-response.dto';

export class UserInterestsResponseDto {
  @ApiProperty({ type: [InterestResponseDto] })
  items: InterestResponseDto[];
}
