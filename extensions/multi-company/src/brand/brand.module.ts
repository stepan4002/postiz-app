import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [CompanyModule],
  providers: [BrandService],
  controllers: [BrandController],
  exports: [BrandService],
})
export class BrandModule {}
