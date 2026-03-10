import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  /**
   * GET /api/companies — list all companies with brands, brand voices, social accounts.
   */
  @Get()
  findAll() {
    return this.companyService.findAll();
  }

  /**
   * GET /api/companies/:slug — get company by slug with full include tree.
   */
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.companyService.findBySlug(slug);
  }

  /**
   * POST /api/companies — create a new company.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  /**
   * PUT /api/companies/:id — partially update a company.
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  /**
   * DELETE /api/companies/:id — delete a company (cascade deletes brands, voices, accounts).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.companyService.delete(id);
  }
}
