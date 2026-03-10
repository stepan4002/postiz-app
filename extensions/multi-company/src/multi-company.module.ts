import { Module } from '@nestjs/common';
import { CompanyModule } from './company/company.module';
import { BrandModule } from './brand/brand.module';
import { BrandVoiceModule } from './brand-voice/brand-voice.module';

/**
 * MultiCompanyModule — top-level NestJS module that aggregates all company
 * management modules: Company, Brand, and BrandVoice.
 *
 * Import this module in AppModule to register all CRUD endpoints:
 * - GET/POST/PUT/DELETE /api/companies
 * - GET/POST/PUT/DELETE /api/companies/:companySlug/brands
 * - GET/PUT /api/companies/:companySlug/brands/:brandSlug/voice
 *
 * This module is the single import point — consumers should not import
 * CompanyModule, BrandModule, or BrandVoiceModule individually.
 */
@Module({
  imports: [CompanyModule, BrandModule, BrandVoiceModule],
  exports: [CompanyModule, BrandModule, BrandVoiceModule],
})
export class MultiCompanyModule {}
