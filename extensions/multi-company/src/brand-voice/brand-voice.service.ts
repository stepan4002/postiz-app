import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { UpsertBrandVoiceDto } from './dto/upsert-brand-voice.dto';

/**
 * BrandVoiceService — get and upsert brand voice settings for a Brand.
 *
 * BrandVoice is a 1-to-1 relation with Brand (brandId is unique).
 * Upsert creates if none exists, or replaces entirely if one does.
 */
@Injectable()
export class BrandVoiceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the brand voice for a brand. Returns null if none set.
   */
  async findByBrand(brandId: string) {
    return (this.prisma as any).brandVoice.findUnique({
      where: { brandId },
    });
  }

  /**
   * Create or replace the brand voice for a brand.
   * Uses Prisma upsert on the unique brandId constraint.
   */
  async upsert(brandId: string, dto: UpsertBrandVoiceDto) {
    const data = {
      tone: dto.tone,
      targetAudience: dto.targetAudience ?? null,
      preferredHashtags: dto.preferredHashtags ?? [],
      blacklistedWords: dto.blacklistedWords ?? [],
      samplePosts: dto.samplePosts ?? [],
      language: dto.language ?? 'en',
      notes: dto.notes ?? null,
    };

    return (this.prisma as any).brandVoice.upsert({
      where: { brandId },
      create: { brandId, ...data },
      update: data,
    });
  }
}
