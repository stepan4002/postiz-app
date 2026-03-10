import { ContentPostService } from '../posts/content-post.service';
import { ContentPostRepository } from '../posts/content-post.repository';

// ============================================================================
// Mock factories
// ============================================================================

const mockAiRouter = {
  execute: jest.fn(),
  executeImageAnalysis: jest.fn(),
};

const mockRepository = {
  createPost: jest.fn(),
  createVariants: jest.fn(),
  updatePostStatus: jest.fn(),
  updateVariant: jest.fn(),
  deleteVariantsByPostId: jest.fn(),
  findByCompany: jest.fn(),
  findById: jest.fn(),
};

const mockAiConfigService = {
  findByCompany: jest.fn(),
};

const mockMediaProcessingService = {
  generateVariants: jest.fn(),
};

const mockPrisma = {
  companyMedia: {
    findUnique: jest.fn(),
  },
};

// ============================================================================
// Fixtures
// ============================================================================

const COMPANY_ID = 'company-001';
const BRAND_ID = 'brand-001';
const MEDIA_ID = 'media-001';
const POST_ID = 'post-001';

const BASE_DTO = {
  brandId: BRAND_ID,
  contentType: 'product' as const,
  platforms: ['instagram', 'facebook'],
};

const MEDIA_DTO = {
  ...BASE_DTO,
  mediaId: MEDIA_ID,
  brief: 'Show off our new product',
};

const TEXT_DTO = {
  ...BASE_DTO,
  brief: 'Write a brand story',
};

const MOCK_POST = {
  id: POST_ID,
  companyId: COMPANY_ID,
  brandId: BRAND_ID,
  status: 'DRAFT',
  contentType: 'product',
};

const MOCK_IMAGE_ANALYSIS_RESULT = {
  output: {
    description: 'A red sneaker on white background',
    objects: ['sneaker', 'shoe'],
    mood: 'clean',
    suggestedTone: 'energetic',
  },
  usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
  model: 'gpt-4o',
  provider: 'openai',
};

const MOCK_CAPTION_RESULT = {
  output: { caption: 'Check out our new sneaker!', hashtags: ['#sneakers', '#fashion'] },
  usage: { inputTokens: 200, outputTokens: 80, estimatedCostUsd: 0.002 },
  model: 'gpt-4o-mini',
  provider: 'openai',
};

const MOCK_ADAPTATION_RESULT = {
  output: { caption: 'Platform adapted caption', hashtags: ['#adapted'] },
  usage: { inputTokens: 150, outputTokens: 60, estimatedCostUsd: 0.0015 },
  model: 'gpt-4o-mini',
  provider: 'openai',
};

const MOCK_SCORE_RESULT = {
  output: { score: 0.85 },
  usage: { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.001 },
  model: 'gpt-4o-mini',
  provider: 'openai',
};

const MOCK_AI_CONFIG = {
  confidenceThreshold: 0.7,
  requireAllReview: false,
  defaultProvider: 'openai',
  preferredModels: {},
  weeklyBudgetUsd: null,
};

// ============================================================================
// Setup helpers
// ============================================================================

function setupHappyPath() {
  mockRepository.createPost.mockResolvedValue(MOCK_POST);
  mockRepository.createVariants.mockResolvedValue([
    { id: 'variant-1', platform: 'instagram', status: 'APPROVED', confidenceScore: 0.85 },
    { id: 'variant-2', platform: 'facebook', status: 'APPROVED', confidenceScore: 0.85 },
  ]);
  mockRepository.updatePostStatus.mockResolvedValue({ ...MOCK_POST, status: 'APPROVED' });
  mockAiConfigService.findByCompany.mockResolvedValue(MOCK_AI_CONFIG);
  mockPrisma.companyMedia.findUnique.mockResolvedValue({ id: MEDIA_ID, path: 'media/sneaker.jpg' });
  mockAiRouter.executeImageAnalysis.mockResolvedValue(MOCK_IMAGE_ANALYSIS_RESULT);
  mockAiRouter.execute
    .mockResolvedValueOnce(MOCK_CAPTION_RESULT)      // generateCaption
    .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)   // adaptForPlatform instagram
    .mockResolvedValueOnce(MOCK_SCORE_RESULT)         // scoreContent instagram
    .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)   // adaptForPlatform facebook
    .mockResolvedValueOnce(MOCK_SCORE_RESULT);        // scoreContent facebook
  mockMediaProcessingService.generateVariants.mockResolvedValue(undefined);
}

// ============================================================================
// Tests
// ============================================================================

describe('ContentPostService', () => {
  let service: ContentPostService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentPostService(
      mockRepository as unknown as ContentPostRepository,
      mockAiRouter as any,
      mockAiConfigService as any,
      mockMediaProcessingService as any,
      mockPrisma as any,
    );
  });

  describe('generate() - image analysis', () => {
    it('should call executeImageAnalysis when mediaId is provided', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      expect(mockAiRouter.executeImageAnalysis).toHaveBeenCalledTimes(1);
      expect(mockAiRouter.executeImageAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_ID, brandId: BRAND_ID, taskType: 'analyzeImage' }),
        expect.any(String),
        expect.any(String),
        expect.anything(),
      );
    });

    it('should skip image analysis when mediaId is null (text-only post)', async () => {
      setupHappyPath();
      mockAiRouter.execute
        .mockReset()
        .mockResolvedValueOnce(MOCK_CAPTION_RESULT)
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)
        .mockResolvedValueOnce(MOCK_SCORE_RESULT)
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)
        .mockResolvedValueOnce(MOCK_SCORE_RESULT);

      await service.generate(COMPANY_ID, TEXT_DTO);

      expect(mockAiRouter.executeImageAnalysis).not.toHaveBeenCalled();
    });
  });

  describe('generate() - caption generation', () => {
    it('should call execute("generateCaption") with system prompt containing content type modifier', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      const captionCall = mockAiRouter.execute.mock.calls.find(
        (call) => call[0].taskType === 'generateCaption',
      );
      expect(captionCall).toBeDefined();
      const messages = captionCall[1];
      const systemMsg = messages.find((m: any) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg.content.length).toBeGreaterThan(0);
    });

    it('should pass brandId in AICallContext for every AI call', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      // All execute calls should have brandId
      for (const call of mockAiRouter.execute.mock.calls) {
        expect(call[0].brandId).toBe(BRAND_ID);
      }
      // executeImageAnalysis should also have brandId
      if (mockAiRouter.executeImageAnalysis.mock.calls.length > 0) {
        expect(mockAiRouter.executeImageAnalysis.mock.calls[0][0].brandId).toBe(BRAND_ID);
      }
    });

    it('should place user brief in user message role, not system prompt', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      const captionCall = mockAiRouter.execute.mock.calls.find(
        (call) => call[0].taskType === 'generateCaption',
      );
      expect(captionCall).toBeDefined();
      const messages = captionCall[1];
      const systemMsg = messages.find((m: any) => m.role === 'system');
      const userMsg = messages.find((m: any) => m.role === 'user');

      // Brief should be in user message
      expect(userMsg).toBeDefined();
      expect(userMsg.content).toContain('Show off our new product');
      // Brief should NOT be in system prompt
      expect(systemMsg.content).not.toContain('Show off our new product');
    });
  });

  describe('generate() - platform adaptation', () => {
    it('should call execute("adaptForPlatform") once per target platform', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      const adaptationCalls = mockAiRouter.execute.mock.calls.filter(
        (call) => call[0].taskType === 'adaptForPlatform',
      );
      // MEDIA_DTO has 2 platforms: instagram, facebook
      expect(adaptationCalls).toHaveLength(2);
    });

    it('should call execute("scoreContent") once per platform variant', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      const scoringCalls = mockAiRouter.execute.mock.calls.filter(
        (call) => call[0].taskType === 'scoreContent',
      );
      // One score call per platform
      expect(scoringCalls).toHaveLength(2);
    });

    it('should use Promise.allSettled for parallel platform adaptation (partial failure handling)', async () => {
      // One platform fails, the other succeeds
      mockRepository.createPost.mockResolvedValue(MOCK_POST);
      mockRepository.createVariants.mockResolvedValue([
        { id: 'variant-1', platform: 'instagram', status: 'APPROVED', confidenceScore: 0.85 },
      ]);
      mockRepository.updatePostStatus.mockResolvedValue({ ...MOCK_POST, status: 'APPROVED' });
      mockAiConfigService.findByCompany.mockResolvedValue(MOCK_AI_CONFIG);
      mockPrisma.companyMedia.findUnique.mockResolvedValue(null); // no media
      mockMediaProcessingService.generateVariants.mockResolvedValue(undefined);
      mockAiRouter.executeImageAnalysis.mockResolvedValue(MOCK_IMAGE_ANALYSIS_RESULT);
      mockAiRouter.execute
        .mockResolvedValueOnce(MOCK_CAPTION_RESULT)       // generateCaption
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)    // instagram adapt - succeeds
        .mockRejectedValueOnce(new Error('Platform error')) // instagram score - fails
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)    // facebook adapt
        .mockResolvedValueOnce(MOCK_SCORE_RESULT);         // facebook score

      // Should not throw even though one platform fails
      await expect(service.generate(COMPANY_ID, MEDIA_DTO)).resolves.toBeDefined();
    });
  });

  describe('generate() - repository operations', () => {
    it('should create ContentPost record via repository', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      expect(mockRepository.createPost).toHaveBeenCalledTimes(1);
      expect(mockRepository.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          brandId: BRAND_ID,
          contentType: 'product',
          status: 'DRAFT',
        }),
      );
    });

    it('should create PostVariant records with correct confidenceScore and generatedBy', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      expect(mockRepository.createVariants).toHaveBeenCalledTimes(1);
      const variantData = mockRepository.createVariants.mock.calls[0][1];
      expect(variantData.length).toBeGreaterThan(0);
      for (const variant of variantData) {
        expect(variant).toHaveProperty('confidenceScore');
        expect(typeof variant.confidenceScore).toBe('number');
        expect(variant).toHaveProperty('generatedBy');
        expect(typeof variant.generatedBy).toBe('string');
      }
    });
  });

  describe('generate() - confidence gating', () => {
    it('should apply confidence gating to set variant statuses', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      const variantData = mockRepository.createVariants.mock.calls[0][1];
      for (const variant of variantData) {
        expect(['APPROVED', 'PENDING_REVIEW', 'REJECTED']).toContain(variant.status);
      }
    });

    it('should set post status to PENDING_REVIEW if any variant is PENDING_REVIEW', async () => {
      setupHappyPath();
      // Override score to be below threshold for all platforms
      mockAiRouter.execute
        .mockReset()
        .mockResolvedValueOnce(MOCK_CAPTION_RESULT)
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)
        .mockResolvedValueOnce({ ...MOCK_SCORE_RESULT, output: { score: 0.5 } }) // below threshold
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)
        .mockResolvedValueOnce({ ...MOCK_SCORE_RESULT, output: { score: 0.5 } }); // below threshold

      await service.generate(COMPANY_ID, MEDIA_DTO);

      expect(mockRepository.updatePostStatus).toHaveBeenCalledWith(
        MOCK_POST.id,
        'PENDING_REVIEW',
      );
    });

    it('should set post status to APPROVED if all variants score above threshold', async () => {
      setupHappyPath(); // default uses score 0.85 > threshold 0.7

      await service.generate(COMPANY_ID, MEDIA_DTO);

      expect(mockRepository.updatePostStatus).toHaveBeenCalledWith(
        MOCK_POST.id,
        'APPROVED',
      );
    });
  });

  describe('generate() - BudgetExceededError propagation', () => {
    it('should handle BudgetExceededError by re-throwing (not swallowing)', async () => {
      mockRepository.createPost.mockResolvedValue(MOCK_POST);
      mockAiConfigService.findByCompany.mockResolvedValue(MOCK_AI_CONFIG);
      mockPrisma.companyMedia.findUnique.mockResolvedValue(null);
      mockMediaProcessingService.generateVariants.mockResolvedValue(undefined);
      mockAiRouter.executeImageAnalysis.mockResolvedValue(MOCK_IMAGE_ANALYSIS_RESULT);

      const budgetError = new Error('BudgetExceededError: Weekly budget of $10 exceeded');
      budgetError.name = 'BudgetExceededError';
      mockAiRouter.execute.mockRejectedValue(budgetError);

      await expect(service.generate(COMPANY_ID, MEDIA_DTO)).rejects.toThrow('BudgetExceededError');
    });
  });

  describe('generate() - media variant triggering', () => {
    it('should call MediaProcessingService.generateVariants when mediaId is provided', async () => {
      setupHappyPath();

      await service.generate(COMPANY_ID, MEDIA_DTO);

      expect(mockMediaProcessingService.generateVariants).toHaveBeenCalledWith(
        MEDIA_ID,
        MEDIA_DTO.platforms,
      );
    });

    it('should NOT call MediaProcessingService.generateVariants when mediaId is null', async () => {
      setupHappyPath();
      mockAiRouter.execute
        .mockReset()
        .mockResolvedValueOnce(MOCK_CAPTION_RESULT)
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)
        .mockResolvedValueOnce(MOCK_SCORE_RESULT)
        .mockResolvedValueOnce(MOCK_ADAPTATION_RESULT)
        .mockResolvedValueOnce(MOCK_SCORE_RESULT);

      await service.generate(COMPANY_ID, TEXT_DTO);

      expect(mockMediaProcessingService.generateVariants).not.toHaveBeenCalled();
    });
  });

  describe('regenerateForPost()', () => {
    it('should delete old variants and generate new ones without creating a new ContentPost', async () => {
      setupHappyPath();
      const existingPost = { ...MOCK_POST, id: 'existing-post-123' };
      mockRepository.deleteVariantsByPostId.mockResolvedValue(undefined);
      mockRepository.createVariants.mockResolvedValue([
        { id: 'new-variant-1', platform: 'instagram', status: 'APPROVED' },
        { id: 'new-variant-2', platform: 'facebook', status: 'APPROVED' },
      ]);

      const result = await service.regenerateForPost(existingPost, MEDIA_DTO);

      // Should NOT create a new ContentPost
      expect(mockRepository.createPost).not.toHaveBeenCalled();
      // Should delete old variants
      expect(mockRepository.deleteVariantsByPostId).toHaveBeenCalledWith(existingPost.id);
      // Should create new variants
      expect(mockRepository.createVariants).toHaveBeenCalled();
      // Should return existing post with new variants
      expect(result.post.id).toBe(existingPost.id);
      expect(result.variants).toBeDefined();
    });

    it('should NOT create a new ContentPost (reuses existing)', async () => {
      setupHappyPath();
      const existingPost = { ...MOCK_POST, id: 'existing-post-456' };
      mockRepository.deleteVariantsByPostId.mockResolvedValue(undefined);

      await service.regenerateForPost(existingPost, MEDIA_DTO);

      expect(mockRepository.createPost).not.toHaveBeenCalled();
    });
  });
});
