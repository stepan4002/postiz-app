import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContentPostService } from './content-post.service';
import { ContentPostRepository } from './content-post.repository';
import type { CreatePostDto } from '../types/content.types';

/**
 * ContentPostController
 *
 * REST endpoints for content post creation and retrieval.
 * Routes are scoped under /companies/:companySlug/posts.
 *
 * Slug resolution: resolves companySlug to companyId via Prisma, then
 * delegates to ContentPostService or ContentPostRepository.
 *
 * Endpoints:
 *   POST   /companies/:companySlug/posts/generate   — trigger AI generation pipeline
 *   GET    /companies/:companySlug/posts             — list posts with optional filters
 *   GET    /companies/:companySlug/posts/:postId     — get single post with variants
 */
@Controller('companies/:companySlug/posts')
export class ContentPostController {
  constructor(
    private readonly contentPostService: ContentPostService,
    private readonly contentPostRepository: ContentPostRepository,
    private readonly prisma: any,
  ) {}

  /**
   * Trigger AI content generation pipeline for a company.
   *
   * POST /companies/:companySlug/posts/generate
   *
   * @param companySlug - URL-safe company identifier
   * @param dto - CreatePostDto with brandId, mediaId?, brief?, contentType, platforms
   * @returns Created ContentPost with generated PostVariants (HTTP 201)
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @Param('companySlug') companySlug: string,
    @Body() dto: CreatePostDto,
  ): Promise<{ post: any; variants: any[] }> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companySlug}' not found`);
    }

    return this.contentPostService.generate(company.id, dto);
  }

  /**
   * List ContentPosts for a company with optional status filter and pagination.
   *
   * GET /companies/:companySlug/posts?status=PENDING_REVIEW&page=1
   *
   * @param companySlug - URL-safe company identifier
   * @param status - Optional status filter (DRAFT, PENDING_REVIEW, APPROVED, SCHEDULED)
   * @param page - Page number (1-based, default 1)
   * @returns Paginated list of ContentPost records with variants
   */
  @Get()
  async listPosts(
    @Param('companySlug') companySlug: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ): Promise<{ posts: any[]; total: number }> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companySlug}' not found`);
    }

    return this.contentPostRepository.findByCompany(
      company.id,
      status,
      parseInt(page ?? '1', 10) || 1,
    );
  }

  /**
   * Get a single ContentPost by ID with all variants included.
   *
   * GET /companies/:companySlug/posts/:postId
   *
   * @param companySlug - URL-safe company identifier (used to validate ownership)
   * @param postId - ContentPost ID
   * @returns ContentPost with PostVariant relations
   */
  @Get(':postId')
  async getPost(
    @Param('companySlug') companySlug: string,
    @Param('postId') postId: string,
  ): Promise<any> {
    const company = await (this.prisma as any).company.findUnique({
      where: { slug: companySlug },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companySlug}' not found`);
    }

    const post = await this.contentPostRepository.findById(postId);
    if (!post) {
      throw new NotFoundException(`ContentPost '${postId}' not found`);
    }

    return post;
  }
}
