import { BudgetCircuitBreaker, BudgetExceededError } from '../cost/budget-circuit-breaker.service';
import { AIConfigData } from '../config/ai-config.service';

describe('BudgetCircuitBreaker', () => {
  let service: BudgetCircuitBreaker;
  let mockPrisma: any;
  let mockAIConfigService: any;

  const companyId = 'company-123';

  const makeConfig = (weeklyBudgetUsd: number | null): AIConfigData => ({
    defaultProvider: 'openai',
    preferredModels: {},
    weeklyBudgetUsd,
  });

  beforeEach(() => {
    mockPrisma = {
      aICostLog: {
        aggregate: jest.fn(),
      },
    };

    mockAIConfigService = {
      findByCompany: jest.fn(),
    };

    service = new BudgetCircuitBreaker(mockPrisma as any, mockAIConfigService);
  });

  describe('checkBudget()', () => {
    it('passes silently when no budget configured (null = unlimited)', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(null));

      await expect(service.checkBudget(companyId)).resolves.toBeUndefined();

      // No aggregate query should be performed
      expect(mockPrisma.aICostLog.aggregate).not.toHaveBeenCalled();
    });

    it('passes silently when spent is less than budget', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(100.0));
      mockPrisma.aICostLog.aggregate.mockResolvedValue({
        _sum: { estimatedCostUsd: 50.0 },
      });

      await expect(service.checkBudget(companyId)).resolves.toBeUndefined();
    });

    it('throws BudgetExceededError when spent equals budget', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(100.0));
      mockPrisma.aICostLog.aggregate.mockResolvedValue({
        _sum: { estimatedCostUsd: 100.0 },
      });

      await expect(service.checkBudget(companyId)).rejects.toThrow(BudgetExceededError);
    });

    it('throws BudgetExceededError when spent exceeds budget', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(100.0));
      mockPrisma.aICostLog.aggregate.mockResolvedValue({
        _sum: { estimatedCostUsd: 150.0 },
      });

      await expect(service.checkBudget(companyId)).rejects.toThrow(BudgetExceededError);
    });

    it('BudgetExceededError contains companyId, spent, and budget values', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(50.0));
      mockPrisma.aICostLog.aggregate.mockResolvedValue({
        _sum: { estimatedCostUsd: 75.5 },
      });

      try {
        await service.checkBudget(companyId);
        fail('Expected BudgetExceededError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BudgetExceededError);
        const budgetErr = err as BudgetExceededError;
        expect(budgetErr.companyId).toBe(companyId);
        expect(budgetErr.spent).toBe(75.5);
        expect(budgetErr.budget).toBe(50.0);
        expect(budgetErr.message).toContain('75.5');
        expect(budgetErr.message).toContain('50');
      }
    });

    it('handles null aggregate sum (no logs yet) as 0 spend', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(100.0));
      mockPrisma.aICostLog.aggregate.mockResolvedValue({
        _sum: { estimatedCostUsd: null },
      });

      await expect(service.checkBudget(companyId)).resolves.toBeUndefined();
    });

    it('aggregate query uses gte with startOf week date', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(100.0));
      mockPrisma.aICostLog.aggregate.mockResolvedValue({
        _sum: { estimatedCostUsd: 10.0 },
      });

      await service.checkBudget(companyId);

      const aggregateCall = mockPrisma.aICostLog.aggregate.mock.calls[0][0];
      expect(aggregateCall.where.companyId).toBe(companyId);
      expect(aggregateCall.where.createdAt.gte).toBeInstanceOf(Date);
      // The date should be before or equal to now
      expect(aggregateCall.where.createdAt.gte.getTime()).toBeLessThanOrEqual(Date.now());
      // The date should be within the past 7 days (start of week)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      expect(aggregateCall.where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo);
    });

    it('aggregate query sums estimatedCostUsd', async () => {
      mockAIConfigService.findByCompany.mockResolvedValue(makeConfig(100.0));
      mockPrisma.aICostLog.aggregate.mockResolvedValue({
        _sum: { estimatedCostUsd: 20.0 },
      });

      await service.checkBudget(companyId);

      const aggregateCall = mockPrisma.aICostLog.aggregate.mock.calls[0][0];
      expect(aggregateCall._sum).toEqual({ estimatedCostUsd: true });
    });
  });

  describe('BudgetExceededError', () => {
    it('is a proper Error subclass', () => {
      const err = new BudgetExceededError(companyId, 150.0, 100.0);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(BudgetExceededError);
    });

    it('has the correct name', () => {
      const err = new BudgetExceededError(companyId, 150.0, 100.0);
      expect(err.name).toBe('BudgetExceededError');
    });

    it('has companyId, spent and budget properties', () => {
      const err = new BudgetExceededError('company-abc', 200.0, 150.0);
      expect(err.companyId).toBe('company-abc');
      expect(err.spent).toBe(200.0);
      expect(err.budget).toBe(150.0);
    });

    it('message contains both spent and budget amounts', () => {
      const err = new BudgetExceededError(companyId, 200.0, 100.0);
      expect(err.message).toContain('200');
      expect(err.message).toContain('100');
    });
  });
});
