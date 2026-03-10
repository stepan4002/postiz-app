import { AIConfigService, AIConfigData } from '../config/ai-config.service';

describe('AIConfigService', () => {
  let service: AIConfigService;
  let mockPrisma: any;

  const defaultCompanyId = 'company-123';

  const makeDbRecord = (overrides: Partial<AIConfigData & { companyId: string }> = {}) => ({
    id: 'config-uuid-1',
    companyId: defaultCompanyId,
    defaultProvider: 'anthropic',
    preferredModels: { generateCaption: 'gpt-4o' },
    weeklyBudgetUsd: 50.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma = {
      aIConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    service = new AIConfigService(mockPrisma as any);

    // Clear env vars before each test
    delete process.env.AI_DEFAULT_PROVIDER;
    delete process.env.AI_WEEKLY_BUDGET_USD;
  });

  afterEach(() => {
    delete process.env.AI_DEFAULT_PROVIDER;
    delete process.env.AI_WEEKLY_BUDGET_USD;
  });

  describe('findByCompany()', () => {
    it('returns DB record when found', async () => {
      const dbRecord = makeDbRecord();
      mockPrisma.aIConfig.findUnique.mockResolvedValue(dbRecord);

      const result = await service.findByCompany(defaultCompanyId);

      expect(mockPrisma.aIConfig.findUnique).toHaveBeenCalledWith({
        where: { companyId: defaultCompanyId },
      });
      expect(result.defaultProvider).toBe('anthropic');
      expect(result.weeklyBudgetUsd).toBe(50.0);
    });

    it('returns DB record with preferredModels when found', async () => {
      const dbRecord = makeDbRecord({ preferredModels: { generateCaption: 'gpt-4o', generateHashtags: 'gpt-4o-mini' } });
      mockPrisma.aIConfig.findUnique.mockResolvedValue(dbRecord);

      const result = await service.findByCompany(defaultCompanyId);

      expect(result.preferredModels).toEqual({ generateCaption: 'gpt-4o', generateHashtags: 'gpt-4o-mini' });
    });

    it('returns env-var defaults when no DB record exists', async () => {
      mockPrisma.aIConfig.findUnique.mockResolvedValue(null);
      process.env.AI_DEFAULT_PROVIDER = 'anthropic';
      process.env.AI_WEEKLY_BUDGET_USD = '100.5';

      const result = await service.findByCompany(defaultCompanyId);

      expect(result.defaultProvider).toBe('anthropic');
      expect(result.preferredModels).toEqual({});
      expect(result.weeklyBudgetUsd).toBeCloseTo(100.5);
    });

    it('returns { defaultProvider: "openai", preferredModels: {}, weeklyBudgetUsd: null } when no env vars and no DB record', async () => {
      mockPrisma.aIConfig.findUnique.mockResolvedValue(null);

      const result = await service.findByCompany(defaultCompanyId);

      expect(result.defaultProvider).toBe('openai');
      expect(result.preferredModels).toEqual({});
      expect(result.weeklyBudgetUsd).toBeNull();
    });

    it('returns null weeklyBudgetUsd when AI_WEEKLY_BUDGET_USD is not set', async () => {
      mockPrisma.aIConfig.findUnique.mockResolvedValue(null);
      process.env.AI_DEFAULT_PROVIDER = 'openai';

      const result = await service.findByCompany(defaultCompanyId);

      expect(result.weeklyBudgetUsd).toBeNull();
    });
  });

  describe('upsert()', () => {
    it('creates record with correct data when new', async () => {
      const upsertData = {
        defaultProvider: 'openai',
        preferredModels: { generateCaption: 'gpt-4o' },
        weeklyBudgetUsd: 75.0,
      };
      const expectedRecord = makeDbRecord({ ...upsertData });
      mockPrisma.aIConfig.upsert.mockResolvedValue(expectedRecord);

      const result = await service.upsert(defaultCompanyId, upsertData);

      expect(mockPrisma.aIConfig.upsert).toHaveBeenCalledWith({
        where: { companyId: defaultCompanyId },
        create: { companyId: defaultCompanyId, ...upsertData },
        update: upsertData,
      });
      expect(result.defaultProvider).toBe('openai');
      expect(result.weeklyBudgetUsd).toBe(75.0);
    });

    it('updates existing record with partial data', async () => {
      const partialData = { weeklyBudgetUsd: 200.0 };
      const expectedRecord = makeDbRecord(partialData);
      mockPrisma.aIConfig.upsert.mockResolvedValue(expectedRecord);

      await service.upsert(defaultCompanyId, partialData);

      expect(mockPrisma.aIConfig.upsert).toHaveBeenCalledWith({
        where: { companyId: defaultCompanyId },
        create: { companyId: defaultCompanyId, ...partialData },
        update: partialData,
      });
    });
  });

  describe('getPreferredModel()', () => {
    it('returns model for known task type', () => {
      const config: AIConfigData = {
        defaultProvider: 'openai',
        preferredModels: { generateCaption: 'gpt-4o', generateHashtags: 'gpt-4o-mini' },
        weeklyBudgetUsd: null,
      };

      expect(service.getPreferredModel(config, 'generateCaption')).toBe('gpt-4o');
      expect(service.getPreferredModel(config, 'generateHashtags')).toBe('gpt-4o-mini');
    });

    it('returns null for unknown task type', () => {
      const config: AIConfigData = {
        defaultProvider: 'openai',
        preferredModels: { generateCaption: 'gpt-4o' },
        weeklyBudgetUsd: null,
      };

      expect(service.getPreferredModel(config, 'analyzeImage')).toBeNull();
    });

    it('returns null when preferredModels is empty', () => {
      const config: AIConfigData = {
        defaultProvider: 'openai',
        preferredModels: {},
        weeklyBudgetUsd: null,
      };

      expect(service.getPreferredModel(config, 'generateCaption')).toBeNull();
    });
  });
});
