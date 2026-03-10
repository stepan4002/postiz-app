/**
 * @social/multi-company — public API barrel export
 *
 * Consumers should import from '@social/multi-company'.
 * The MultiCompanyModule is the primary import for AppModule.
 */

// Top-level module (import this in AppModule)
export { MultiCompanyModule } from './multi-company.module';

// Feature modules (for fine-grained imports if needed)
export { CompanyModule } from './company/company.module';
export { BrandModule } from './brand/brand.module';
export { BrandVoiceModule } from './brand-voice/brand-voice.module';

// Services (for injection in other modules)
export { CompanyService } from './company/company.service';
export { BrandService } from './brand/brand.service';
export { BrandVoiceService } from './brand-voice/brand-voice.service';

// DTOs (for use in other modules and API documentation)
export { CreateCompanyDto } from './company/dto/create-company.dto';
export { UpdateCompanyDto } from './company/dto/update-company.dto';
export { CreateBrandDto } from './brand/dto/create-brand.dto';
export { UpdateBrandDto } from './brand/dto/update-brand.dto';
export { UpsertBrandVoiceDto } from './brand-voice/dto/upsert-brand-voice.dto';
