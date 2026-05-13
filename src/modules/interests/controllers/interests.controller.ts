// src/modules/interests/controllers/interests.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InterestsService } from '../services/interests.service';

@ApiTags('interests')
@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  @ApiOperation({ summary: 'List all validated interests' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'List of validated interests' })
  listInterests(@Query('category') category?: string) {
    return this.interestsService.listInterests(category);
  }
}
