import { ContentPostRepository } from '../posts/content-post.repository';

describe('ContentPostRepository - PostVariant operations', () => {
  let repository: ContentPostRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      contentPost: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      postVariant: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
    };
    repository = new ContentPostRepository(mockPrisma);
  });

  describe('createVariants', () => {
    it('should create records with correct postId mapping', async () => {
      const postId = 'post-123';
      const variants = [
        {
          platform: 'instagram',
          caption: 'Test caption',
          hashtags: ['#test'],
          confidenceScore: 0.85,
          status: 'APPROVED' as const,
          generatedBy: 'gpt-4o-mini',
        },
        {
          platform: 'facebook',
          caption: 'Facebook caption',
          hashtags: ['#fb'],
          confidenceScore: 0.72,
          status: 'APPROVED' as const,
          generatedBy: 'gpt-4o-mini',
        },
      ];

      const createdVariants = variants.map((v) => ({ ...v, postId, id: `variant-${v.platform}` }));
      mockPrisma.postVariant.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.postVariant.findMany.mockResolvedValue(createdVariants);

      const result = await repository.createVariants(postId, variants);

      expect(mockPrisma.postVariant.createMany).toHaveBeenCalledWith({
        data: variants.map((v) => ({ ...v, postId })),
      });
      expect(mockPrisma.postVariant.findMany).toHaveBeenCalledWith({
        where: { postId },
      });
      expect(result).toEqual(createdVariants);
    });
  });

  describe('deleteVariantsByPostId', () => {
    it('should call deleteMany with correct where clause', async () => {
      const postId = 'post-456';
      mockPrisma.postVariant.deleteMany.mockResolvedValue({ count: 3 });

      await repository.deleteVariantsByPostId(postId);

      expect(mockPrisma.postVariant.deleteMany).toHaveBeenCalledWith({
        where: { postId },
      });
    });
  });

  describe('updateVariant', () => {
    it('should call update with correct id and data partial', async () => {
      const variantId = 'variant-789';
      const updateData = { caption: 'Updated caption', status: 'APPROVED' as const };
      const updatedVariant = { id: variantId, ...updateData };
      mockPrisma.postVariant.update.mockResolvedValue(updatedVariant);

      const result = await repository.updateVariant(variantId, updateData);

      expect(mockPrisma.postVariant.update).toHaveBeenCalledWith({
        where: { id: variantId },
        data: updateData,
      });
      expect(result).toEqual(updatedVariant);
    });
  });
});
