/**
 * PublishAttemptLogger unit tests.
 *
 * Tests:
 * - Test 1: logAttempt creates PublishAttempt record with all fields
 * - Test 2: logAttempt never throws — catches DB errors and warns
 */

import { PublishAttemptLogger } from '../publishing/publish-attempt-logger';

describe('PublishAttemptLogger', () => {
  let logger: PublishAttemptLogger;
  let mockPrisma: any;

  const makeRecord = (overrides: Partial<{
    variantId: string;
    attemptNumber: number;
    timestamp: Date;
    success: boolean;
    responseCode?: number;
    responseBody?: string;
    error?: string;
    errorType?: 'transient' | 'permanent' | 'rate_limit';
  }> = {}) => ({
    variantId: 'variant-1',
    attemptNumber: 1,
    timestamp: new Date('2026-03-11T10:00:00Z'),
    success: true,
    responseCode: 200,
    responseBody: '{"id":"post-123"}',
    error: undefined,
    errorType: undefined,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      publishAttempt: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    logger = new PublishAttemptLogger(mockPrisma);
  });

  describe('Test 1: logAttempt creates PublishAttempt record with all fields', () => {
    it('should create a PublishAttempt record with all provided fields', async () => {
      const record = makeRecord();
      mockPrisma.publishAttempt.create.mockResolvedValue({ id: 'attempt-1', ...record });

      await logger.logAttempt(record);

      expect(mockPrisma.publishAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variantId: 'variant-1',
          attemptNumber: 1,
          timestamp: record.timestamp,
          success: true,
          responseCode: 200,
          responseBody: '{"id":"post-123"}',
        }),
      });
    });

    it('should include error and errorType when provided', async () => {
      const record = makeRecord({
        success: false,
        responseCode: 429,
        error: 'Rate limit exceeded',
        errorType: 'rate_limit' as const,
      });
      mockPrisma.publishAttempt.create.mockResolvedValue({ id: 'attempt-1' });

      await logger.logAttempt(record);

      expect(mockPrisma.publishAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          responseCode: 429,
          error: 'Rate limit exceeded',
          errorType: 'rate_limit',
        }),
      });
    });

    it('should log a failed attempt with permanent error type', async () => {
      const record = makeRecord({
        success: false,
        responseCode: 400,
        error: 'Invalid content format',
        errorType: 'permanent' as const,
      });
      mockPrisma.publishAttempt.create.mockResolvedValue({ id: 'attempt-2' });

      await logger.logAttempt(record);

      expect(mockPrisma.publishAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          errorType: 'permanent',
          error: 'Invalid content format',
        }),
      });
    });
  });

  describe('Test 2: logAttempt never throws — catches DB errors and warns', () => {
    it('should not throw when DB create fails', async () => {
      const record = makeRecord();
      mockPrisma.publishAttempt.create.mockRejectedValue(new Error('DB connection failed'));

      // Must not throw — logging must never block publishing flow
      await expect(logger.logAttempt(record)).resolves.not.toThrow();
    });

    it('should console.warn when DB create fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const record = makeRecord();
      mockPrisma.publishAttempt.create.mockRejectedValue(new Error('DB write error'));

      await logger.logAttempt(record);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should continue to work after a DB error', async () => {
      mockPrisma.publishAttempt.create
        .mockRejectedValueOnce(new Error('Transient DB error'))
        .mockResolvedValueOnce({ id: 'attempt-2' });

      const record1 = makeRecord({ variantId: 'variant-1' });
      const record2 = makeRecord({ variantId: 'variant-2' });

      // Both should resolve without throwing
      await logger.logAttempt(record1);
      await logger.logAttempt(record2);

      // Second call should succeed
      expect(mockPrisma.publishAttempt.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAttemptsForVariant', () => {
    it('should return all attempts ordered by timestamp desc', async () => {
      const mockAttempts = [
        { id: 'a2', variantId: 'variant-1', attemptNumber: 2, timestamp: new Date('2026-03-11T11:00:00Z') },
        { id: 'a1', variantId: 'variant-1', attemptNumber: 1, timestamp: new Date('2026-03-11T10:00:00Z') },
      ];
      mockPrisma.publishAttempt.findMany.mockResolvedValue(mockAttempts);

      const result = await logger.getAttemptsForVariant('variant-1');

      expect(mockPrisma.publishAttempt.findMany).toHaveBeenCalledWith({
        where: { variantId: 'variant-1' },
        orderBy: { timestamp: 'desc' },
      });
      expect(result).toEqual(mockAttempts);
    });
  });
});
