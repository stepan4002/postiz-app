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
  UsePipes,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { CompanyService } from '../company/company.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

/**
 * BrandController — REST API for Brand CRUD operations.
 *
 * All routes are nested under /api/companies/:companySlug/brands.
 * The companySlug is resolved to a companyId for each handler so that
 * brand operations are always scoped to the correct company.
 */
@Controller('companies/:companySlug/brands')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly companyService: CompanyService,
  ) {}

  /**
   * GET /api/companies/:companySlug/brands
   * List all brands for a company.
   */
  @Get()
  async findAll(@Param('companySlug') companySlug: string) {
    const company = await this.companyService.findBySlug(companySlug);
    return this.brandService.findAllByCompany(company.id);
  }

  /**
   * POST /api/companies/:companySlug/brands
   * Create a new brand within the company. Returns 201 Created.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('companySlug') companySlug: string,
    @Body() dto: CreateBrandDto,
  ) {
    const company = await this.companyService.findBySlug(companySlug);
    return this.brandService.create(company.id, dto);
  }

  /**
   * PUT /api/companies/:companySlug/brands/:id
   * Partially update a brand by ID.
   */
  @Put(':id')
  async update(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    // Validate company exists (throws NotFoundException if not)
    await this.companyService.findBySlug(companySlug);
    return this.brandService.update(id, dto);
  }

  /**
   * DELETE /api/companies/:companySlug/brands/:id
   * Delete a brand by ID. Cascades to brand voice and social accounts.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('companySlug') companySlug: string,
    @Param('id') id: string,
  ) {
    // Validate company exists (throws NotFoundException if not)
    await this.companyService.findBySlug(companySlug);
    return this.brandService.delete(id);
  }
}
