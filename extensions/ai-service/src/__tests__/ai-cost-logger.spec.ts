import { AICostLogger } from '../cost/ai-cost-logger.service';

describe('AICostLogger', () => {
  let service: AICostLogger;
  let mockPrisma: any;

  const baseParams = {
    companyId: 'company-123',
    provider: 'openai',
    model: 'gpt-4o',
    taskType: 'generateCaption',
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCostUsd: 0.015,
  };

  beforeEach(() => {
    mockPrisma = {
      aICostLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-uuid-1' }),
      },
    };
    service = new AICostLogger(mockPrisma as any);
  });

  describe('log()', () => {
    it('calls prisma.aICostLog.create with all required fields', async () => {
      await service.log(baseParams);

      expect(mockPrisma.aICostLog.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-123',
          postId: null,
          provider: 'openai',
          model: 'gpt-4o',
          taskType: 'generateCaption',
          inputTokens: 1000,
          outputTokens: 500,
          estimatedCostUsd: 0.015,
        },
      });
    });

    it('passes null for postId when not provided', async () => {
      await service.log(baseParams);

      const callArgs = mockPrisma.aICostLog.create.mock.calls[0][0];
      expect(callArgs.data.postId).toBeNull();
    });

    it('passes provided postId when given', async () => {
      await service.log({ ...baseParams, postId: 'post-456' });

      const callArgs = mockPrisma.aICostLog.create.mock.calls[0][0];
      expect(callArgs.data.postId).toBe('post-456');
    });

    it('does not throw when prisma.create fails (non-blocking)', async () => {
      mockPrisma.aICostLog.create.mockRejectedValue(new Error('DB connection refused'));

      // Should not throw
      await expect(service.log(baseParams)).resolves.toBeUndefined();
    });

    it('logs a warning (not throwing) when prisma.create fails', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockPrisma.aICostLog.create.mockRejectedValue(new Error('Timeout'));

      await service.log(baseParams);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to log AI cost:',
        'Timeout'
      );
      consoleSpy.mockRestore();
    });

    it('includes all fields including estimatedCostUsd in create call', async () => {
      const params = {
        ...baseParams,
        postId: 'post-789',
        estimatedCostUsd: 0.025,
      };
      await service.log(params);

      const callArgs = mockPrisma.aICostLog.create.mock.calls[0][0];
      expect(callArgs.data.estimatedCostUsd).toBe(0.025);
      expect(callArgs.data.postId).toBe('post-789');
    });
  });
});
