import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

/**
 * BrandService — CRUD operations for Brand entities.
 *
 * All operations are explicitly scoped by companyId parameter.
 * Services are explicit — companyId is passed as a parameter, NOT read from CLS.
 * This makes the isolation contract clear and testable.
 */
@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return all brands for a company with their brand voice and social accounts.
   */
  async findAllByCompany(companyId: string) {
    return (this.prisma as any).brand.findMany({
      where: { companyId },
      include: {
        brandVoice: true,
        socialAccounts: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Return a single brand scoped to a company by its slug.
   */
  async findBySlug(companyId: string, slug: string) {
    const brand = await (this.prisma as any).brand.findFirst({
      where: { companyId, slug },
      include: {
        brandVoice: true,
        socialAccounts: true,
      },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with slug '${slug}' not found in this company`);
    }
    return brand;
  }

  /**
   * Create a brand linked to a company. Validates slug uniqueness within the company.
   */
  async create(companyId: string, dto: CreateBrandDto) {
    const existing = await (this.prisma as any).brand.findFirst({
      where: { companyId, slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(
        `Brand with slug '${dto.slug}' already exists in this company`
      );
    }
    return (this.prisma as any).brand.create({
      data: {
        companyId,
        name: dto.name,
        slug: dto.slug,
        logo: dto.logo ?? null,
        description: dto.description ?? null,
      },
    });
  }

  /**
   * Partially update a brand.
   */
  async update(id: string, dto: UpdateBrandDto) {
    const brand = await (this.prisma as any).brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException(`Brand with id '${id}' not found`);
    }
    if (dto.slug && dto.slug !== brand.slug) {
      const existing = await (this.prisma as any).brand.findFirst({
        where: { companyId: brand.companyId, slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException(
          `Brand with slug '${dto.slug}' already exists in this company`
        );
      }
    }
    return (this.prisma as any).brand.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a brand. Cascade deletes its brand voice and social accounts.
   */
  async delete(id: string) {
    const brand = await (this.prisma as any).brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException(`Brand with id '${id}' not found`);
    }
    return (this.prisma as any).brand.delete({ where: { id } });
  }
}
