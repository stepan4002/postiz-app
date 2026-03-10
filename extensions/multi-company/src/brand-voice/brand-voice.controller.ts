import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { BrandVoiceService } from './brand-voice.service';
import { CompanyService } from '../company/company.service';
import { BrandService } from '../brand/brand.service';
import { UpsertBrandVoiceDto } from './dto/upsert-brand-voice.dto';

/**
 * BrandVoiceController — REST API for BrandVoice upsert.
 *
 * Routes are nested under /api/companies/:companySlug/brands/:brandSlug/voice.
 * Both companySlug and brandSlug are resolved before delegating to BrandVoiceService.
 */
@Controller('companies/:companySlug/brands/:brandSlug/voice')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BrandVoiceController {
  constructor(
    private readonly brandVoiceService: BrandVoiceService,
    private readonly companyService: CompanyService,
    private readonly brandService: BrandService,
  ) {}

  /**
   * GET /api/companies/:companySlug/brands/:brandSlug/voice
   * Get the brand voice for a specific brand.
   */
  @Get()
  async findByBrand(
    @Param('companySlug') companySlug: string,
    @Param('brandSlug') brandSlug: string,
  ) {
    const company = await this.companyService.findBySlug(companySlug);
    const brand = await this.brandService.findBySlug(company.id, brandSlug);
    return this.brandVoiceService.findByBrand(brand.id);
  }

  /**
   * PUT /api/companies/:companySlug/brands/:brandSlug/voice
   * Upsert the brand voice for a specific brand (create or replace).
   */
  @Put()
  async upsert(
    @Param('companySlug') companySlug: string,
    @Param('brandSlug') brandSlug: string,
    @Body() dto: UpsertBrandVoiceDto,
  ) {
    const company = await this.companyService.findBySlug(companySlug);
    const brand = await this.brandService.findBySlug(company.id, brandSlug);
    return this.brandVoiceService.upsert(brand.id, dto);
  }
}
