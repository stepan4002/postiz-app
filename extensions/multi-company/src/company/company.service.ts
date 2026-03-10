import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

/**
 * CompanyService — CRUD operations for Company entities.
 *
 * Companies are top-level, non-scoped resources (not filtered by companyId CLS).
 * Uses the raw PrismaService for full cross-company access.
 */
@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return all companies with their brands, brand voices, and social accounts.
   * Companies are top-level — no company scoping applied.
   */
  async findAll() {
    return this.prisma.$transaction(async (tx) => {
      return (tx as any).company.findMany({
        include: {
          brands: {
            include: {
              brandVoice: true,
              socialAccounts: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  }

  /**
   * Return a single company by its unique slug, with full include tree.
   */
  async findBySlug(slug: string) {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug },
      include: {
        brands: {
          include: {
            brandVoice: true,
            socialAccounts: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException(`Company with slug '${slug}' not found`);
    }
    return company;
  }

  /**
   * Return a single company by its ID.
   */
  async findById(id: string) {
    const company = await (this.prisma as any).company.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException(`Company with id '${id}' not found`);
    }
    return company;
  }

  /**
   * Create a new company. Validates slug uniqueness.
   */
  async create(dto: CreateCompanyDto) {
    const existing = await (this.prisma as any).company.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Company with slug '${dto.slug}' already exists`);
    }
    return (this.prisma as any).company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        timezone: dto.timezone ?? 'UTC',
        defaultLanguage: dto.defaultLanguage ?? 'en',
        industry: dto.industry ?? null,
        website: dto.website ?? null,
        logo: dto.logo ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  /**
   * Partially update a company by ID.
   */
  async update(id: string, dto: UpdateCompanyDto) {
    await this.findById(id);
    if (dto.slug) {
      const existing = await (this.prisma as any).company.findUnique({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Company with slug '${dto.slug}' already exists`);
      }
    }
    return (this.prisma as any).company.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a company by ID. Cascade deletes brands, brand voices, and social accounts.
   */
  async delete(id: string) {
    await this.findById(id);
    return (this.prisma as any).company.delete({
      where: { id },
    });
  }
}
