import { Controller, Post, Body, Param } from '@nestjs/common';
import { BatchGenerationService, BatchGenerateParams } from './batch-generation.service';

/**
 * BatchGenerationController — REST endpoint for batch AI content generation.
 */
@Controller()
export class BatchGenerationController {
  private prisma: any;

  constructor(
    private readonly batchService: BatchGenerationService,
  ) {}

  /** Called by useFactory in AIServiceModule to inject PrismaService */
  setPrisma(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * POST /companies/:companySlug/ai/batch-generate
   */
  @Post('companies/:companySlug/ai/batch-generate')
  async batchGenerate(
    @Param('companySlug') companySlug: string,
    @Body()
    body: {
      brandIds: string[];
      platforms: string[];
      topic?: string;
      contentType?: string;
      count?: number;
    },
  ) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: companySlug }, { name: companySlug }] },
      select: { id: true },
    });
    if (!company) throw new Error(`Company not found: ${companySlug}`);

    const params: BatchGenerateParams = {
      companyId: company.id,
      brandIds: body.brandIds,
      platforms: body.platforms,
      topic: body.topic,
      contentType: body.contentType,
      count: body.count,
    };

    return this.batchService.batchGenerate(params);
  }
}
