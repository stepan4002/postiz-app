import { ReviewQueueService } from '../review/review-queue.service';
import { ContentPostRepository } from '../posts/content-post.repository';
import { ContentPostService } from '../posts/content-post.service';

// ============================================================================
// Mock factories
// ============================================================================

const mockRepository = {
  findByCompany: jest.fn(),
  findById: jest.fn(),
  updatePostStatus: jest.fn(),
  updateVariant: jest.fn(),
  deleteVariantsByPostId: jest.fn(),
  createPost: jest.fn(),
  createVariants: jest.fn(),
};

const mockContentPostService = {
  regenerateForPost: jest.fn(),
  generate: jest.fn(), // must NOT be called by regenerate action
};

const mockPrisma = {
  postVariant: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

// ============================================================================
// Fixtures
// ============================================================================

const COMPANY_ID = 'company-001';
const POST_ID = 'post-001';
const VARIANT_ID_1 = 'variant-001';
const VARIANT_ID_2 = 'variant-002';
const REVIEWED_BY = 'operator-alice';

const MOCK_VARIANT_1 = {
  id: VARIANT_ID_1,
  postId: POST_ID,
  platform: 'instagram',
  caption: 'Check out our new sneaker!',
  hashtags: ['#sneakers'],
  status: 'PENDING_REVIEW',
  confidenceScore: 0.65,
  generatedBy: 'gpt-4o-mini',
  reviewedBy: null,
  reviewAction: null,
  reviewedAt: null,
  originalCaption: null,
};

const MOCK_VARIANT_2 = {
  id: VARIANT_ID_2,
  postId: POST_ID,
  platform: 'facebook',
  caption: 'Our latest sneaker is here!',
  hashtags: ['#fashion'],
  status: 'PENDING_REVIEW',
  confidenceScore: 0.6,
  generatedBy: 'gpt-4o-mini',
  reviewedBy: null,
  reviewAction: null,
  reviewedAt: null,
  originalCaption: null,
};

const MOCK_POST_WITH_VARIANTS = {
  id: POST_ID,
  companyId: COMPANY_ID,
  brandId: 'brand-001',
  mediaId: 'media-001',
  brief: 'New sneaker launch',
  contentType: 'product',
  status: 'PENDING_REVIEW',
  variants: [MOCK_VARIANT_1, MOCK_VARIANT_2],
  createdAt: new Date('2026-03-10'),
};

// ============================================================================
// Tests
// ============================================================================

describe('ReviewQueueService', () => {
  let service: ReviewQueueService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ReviewQueueService(
      mockRepository as unknown as ContentPostRepository,
      mockContentPostService as unknown as ContentPostService,
      mockPrisma as any,
    );
  });

  // --------------------------------------------------------------------------
  // findPending
  // --------------------------------------------------------------------------

  describe('findPending()', () => {
    it('should return only posts with status=PENDING_REVIEW and include variants', async () => {
      mockRepository.findByCompany.mockResolvedValue({
        posts: [MOCK_POST_WITH_VARIANTS],
        total: 1,
      });

      const result = await service.findPending(COMPANY_ID);

      expect(mockRepository.findByCompany).toHaveBeenCalledWith(
        COMPANY_ID,
        'PENDING_REVIEW',
        1,
        20,
      );
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].variants).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('should paginate correctly — page 1 and page 2', async () => {
      mockRepository.findByCompany
        .mockResolvedValueOnce({ posts: [MOCK_POST_WITH_VARIANTS], total: 2 })
        .mockResolvedValueOnce({ posts: [{ ...MOCK_POST_WITH_VARIANTS, id: 'post-002' }], total: 2 });

      const page1 = await service.findPending(COMPANY_ID, 1, 1);
      const page2 = await service.findPending(COMPANY_ID, 2, 1);

      expect(mockRepository.findByCompany).toHaveBeenNthCalledWith(1, COMPANY_ID, 'PENDING_REVIEW', 1, 1);
      expect(mockRepository.findByCompany).toHaveBeenNthCalledWith(2, COMPANY_ID, 'PENDING_REVIEW', 2, 1);
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
      expect(page1.totalPages).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // approve
  // --------------------------------------------------------------------------

  describe('approve()', () => {
    it('should set all variant statuses to APPROVED', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockRepository.updateVariant.mockResolvedValue({});
      mockRepository.updatePostStatus.mockResolvedValue({});
      mockRepository.findById.mockResolvedValue({ ...MOCK_POST_WITH_VARIANTS, status: 'APPROVED' });

      await service.approve(POST_ID, REVIEWED_BY);

      // Called once per variant
      expect(mockRepository.updateVariant).toHaveBeenCalledTimes(2);
      expect(mockRepository.updateVariant).toHaveBeenCalledWith(
        VARIANT_ID_1,
        expect.objectContaining({ status: 'APPROVED' }),
      );
      expect(mockRepository.updateVariant).toHaveBeenCalledWith(
        VARIANT_ID_2,
        expect.objectContaining({ status: 'APPROVED' }),
      );
    });

    it('should set reviewedBy, reviewAction=approve, reviewedAt on each variant', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockRepository.updateVariant.mockResolvedValue({});
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.approve(POST_ID, REVIEWED_BY);

      for (const call of mockRepository.updateVariant.mock.calls) {
        const updateData = call[1];
        expect(updateData.reviewedBy).toBe(REVIEWED_BY);
        expect(updateData.reviewAction).toBe('approve');
        expect(updateData.reviewedAt).toBeInstanceOf(Date);
      }
    });

    it('should update post status to APPROVED', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockRepository.updateVariant.mockResolvedValue({});
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.approve(POST_ID, REVIEWED_BY);

      expect(mockRepository.updatePostStatus).toHaveBeenCalledWith(POST_ID, 'APPROVED');
    });
  });

  // --------------------------------------------------------------------------
  // reject
  // --------------------------------------------------------------------------

  describe('reject()', () => {
    it('should set all variant statuses to REJECTED', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockRepository.updateVariant.mockResolvedValue({});
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.reject(POST_ID, REVIEWED_BY);

      expect(mockRepository.updateVariant).toHaveBeenCalledTimes(2);
      expect(mockRepository.updateVariant).toHaveBeenCalledWith(
        VARIANT_ID_1,
        expect.objectContaining({ status: 'REJECTED' }),
      );
      expect(mockRepository.updateVariant).toHaveBeenCalledWith(
        VARIANT_ID_2,
        expect.objectContaining({ status: 'REJECTED' }),
      );
    });

    it('should set reviewedBy, reviewAction=reject, reviewedAt on each variant', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockRepository.updateVariant.mockResolvedValue({});
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.reject(POST_ID, REVIEWED_BY);

      for (const call of mockRepository.updateVariant.mock.calls) {
        const updateData = call[1];
        expect(updateData.reviewedBy).toBe(REVIEWED_BY);
        expect(updateData.reviewAction).toBe('reject');
        expect(updateData.reviewedAt).toBeInstanceOf(Date);
      }
    });

    it('should update post status to DRAFT (rejected goes back to draft)', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockRepository.updateVariant.mockResolvedValue({});
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.reject(POST_ID, REVIEWED_BY);

      expect(mockRepository.updatePostStatus).toHaveBeenCalledWith(POST_ID, 'DRAFT');
    });
  });

  // --------------------------------------------------------------------------
  // regenerate
  // --------------------------------------------------------------------------

  describe('regenerate()', () => {
    it('should call ContentPostService.regenerateForPost() with existing post and original inputs', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockContentPostService.regenerateForPost.mockResolvedValue({
        post: MOCK_POST_WITH_VARIANTS,
        variants: [MOCK_VARIANT_1, MOCK_VARIANT_2],
      });

      await service.regenerate(POST_ID);

      expect(mockContentPostService.regenerateForPost).toHaveBeenCalledWith(
        MOCK_POST_WITH_VARIANTS,
        expect.objectContaining({
          brandId: MOCK_POST_WITH_VARIANTS.brandId,
          mediaId: MOCK_POST_WITH_VARIANTS.mediaId,
          brief: MOCK_POST_WITH_VARIANTS.brief,
          contentType: MOCK_POST_WITH_VARIANTS.contentType,
          platforms: expect.arrayContaining(['instagram', 'facebook']),
        }),
      );
    });

    it('should NOT call ContentPostService.generate() — uses regenerateForPost instead', async () => {
      mockRepository.findById.mockResolvedValue(MOCK_POST_WITH_VARIANTS);
      mockContentPostService.regenerateForPost.mockResolvedValue({
        post: MOCK_POST_WITH_VARIANTS,
        variants: [MOCK_VARIANT_1],
      });

      await service.regenerate(POST_ID);

      expect(mockContentPostService.generate).not.toHaveBeenCalled();
      expect(mockContentPostService.regenerateForPost).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // editVariant
  // --------------------------------------------------------------------------

  describe('editVariant()', () => {
    it('should store originalCaption before overwriting caption', async () => {
      const originalCaption = MOCK_VARIANT_1.caption;
      mockPrisma.postVariant.findUnique.mockResolvedValue(MOCK_VARIANT_1);
      mockPrisma.postVariant.update.mockResolvedValue({
        ...MOCK_VARIANT_1,
        caption: 'Edited caption',
        originalCaption,
        status: 'APPROVED',
        reviewAction: 'edit_approve',
      });
      // For sibling check — all APPROVED
      mockPrisma.postVariant.findMany.mockResolvedValue([
        { ...MOCK_VARIANT_1, status: 'APPROVED' },
        { ...MOCK_VARIANT_2, status: 'APPROVED' },
      ]);
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.editVariant(VARIANT_ID_1, 'Edited caption', REVIEWED_BY);

      expect(mockPrisma.postVariant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalCaption,
          }),
        }),
      );
    });

    it('should set reviewAction=edit_approve and status=APPROVED on the variant', async () => {
      mockPrisma.postVariant.findUnique.mockResolvedValue(MOCK_VARIANT_1);
      mockPrisma.postVariant.update.mockResolvedValue({
        ...MOCK_VARIANT_1,
        caption: 'Edited caption',
        status: 'APPROVED',
        reviewAction: 'edit_approve',
      });
      mockPrisma.postVariant.findMany.mockResolvedValue([
        { ...MOCK_VARIANT_1, status: 'APPROVED' },
        { ...MOCK_VARIANT_2, status: 'APPROVED' },
      ]);
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.editVariant(VARIANT_ID_1, 'Edited caption', REVIEWED_BY);

      expect(mockPrisma.postVariant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewAction: 'edit_approve',
          }),
        }),
      );
    });

    it('should update parent post status to APPROVED when all siblings are APPROVED', async () => {
      mockPrisma.postVariant.findUnique.mockResolvedValue(MOCK_VARIANT_1);
      mockPrisma.postVariant.update.mockResolvedValue({
        ...MOCK_VARIANT_1,
        caption: 'Edited caption',
        status: 'APPROVED',
        reviewAction: 'edit_approve',
      });
      // All siblings are now APPROVED
      mockPrisma.postVariant.findMany.mockResolvedValue([
        { ...MOCK_VARIANT_1, status: 'APPROVED' },
        { ...MOCK_VARIANT_2, status: 'APPROVED' },
      ]);
      mockRepository.updatePostStatus.mockResolvedValue({});

      await service.editVariant(VARIANT_ID_1, 'Edited caption', REVIEWED_BY);

      expect(mockRepository.updatePostStatus).toHaveBeenCalledWith(POST_ID, 'APPROVED');
    });
  });
});
