import { Module } from '@nestjs/common';
import { BrandVoiceService } from './brand-voice.service';
import { BrandVoiceController } from './brand-voice.controller';
import { CompanyModule } from '../company/company.module';
import { BrandModule } from '../brand/brand.module';

@Module({
  imports: [CompanyModule, BrandModule],
  providers: [BrandVoiceService],
  controllers: [BrandVoiceController],
  exports: [BrandVoiceService],
})
export class BrandVoiceModule {}
