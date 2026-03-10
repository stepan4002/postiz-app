/**
 * CompanyMediaRepository unit tests.
 *
 * Tests company-scoped Prisma queries with a mocked PrismaService.
 * Key invariant: findByCompany never returns records from another company.
 */
import { CompanyMediaRepository } from '../media/company-media.repository';

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCount = jest.fn();
const mockProcessingJobCreate = jest.fn();
const mockProcessingJobFindMany = jest.fn();
const mockProcessingJobUpdate = jest.fn();

const mockPrisma = {
  media: {
    create: mockCreate,
    findMany: mockFindMany,
    findUnique: mockFindUnique,
    update: mockUpdate,
    count: mockCount,
  },
  mediaProcessingJob: {
    create: mockProcessingJobCreate,
    findMany: mockProcessingJobFindMany,
    update: mockProcessingJobUpdate,
  },
} as any;

describe('CompanyMediaRepository', () => {
  let repository: CompanyMediaRepository;

  beforeEach(() => {
    repository = new CompanyMediaRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('createMedia', () => {
    it('should call prisma.media.create with all provided fields', async () => {
      const mediaData = {
        name: 'test.jpg',
        path: 'company-1/media-id-1/test.jpg',
        thumbnail: 'company-1/media-id-1/thumb_test.jpg',
        organizationId: 'org-1',
        companyId: 'company-1',
        fileSize: 12345,
        type: 'image',
        width: 800,
        height: 600,
        format: 'jpeg',
        tags: ['product', 'summer'],
      };
      const expectedResult = { id: 'media-id-1', ...mediaData };
      mockCreate.mockResolvedValue(expectedResult);

      const result = await repository.createMedia(mediaData);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'test.jpg',
          companyId: 'company-1',
          organizationId: 'org-1',
          width: 800,
          height: 600,
          format: 'jpeg',
          tags: ['product', 'summer'],
        }),
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findByCompany', () => {
    it('should filter by companyId and deletedAt IS NULL', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findByCompany('company-1', 1, 20);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1',
            deletedAt: null,
          }),
        })
      );
    });

    it('should order by createdAt DESC', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findByCompany('company-1', 1, 20);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should apply pagination with skip and take', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      // Page 2, limit 20 -> skip 20
      await repository.findByCompany('company-1', 2, 20);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });

    it('should filter by tag when provided using has operator', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findByCompany('company-1', 1, 20, 'product');

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: { has: 'product' },
          }),
        })
      );
    });

    it('should not include tag filter when tag is undefined', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await repository.findByCompany('company-1', 1, 20);

      const call = mockFindMany.mock.calls[0][0];
      expect(call.where.tags).toBeUndefined();
    });

    it('should return paginated result with total and totalPages', async () => {
      const items = [{ id: 'media-1', companyId: 'company-1' }];
      mockFindMany.mockResolvedValue(items);
      mockCount.mockResolvedValue(42);

      const result = await repository.findByCompany('company-1', 1, 20);

      expect(result).toEqual({
        items,
        total: 42,
        page: 1,
        totalPages: 3, // ceil(42/20)
      });
    });

    it('ISOLATION: Company A query should NOT return Company B data', async () => {
      // Simulate that DB only returns matching company records
      const companyARecords = [{ id: 'media-1', companyId: 'company-A' }];
      const companyBRecords = [{ id: 'media-2', companyId: 'company-B' }];

      // When querying company-A, only company-A records returned
      mockFindMany.mockResolvedValueOnce(companyARecords);
      mockCount.mockResolvedValueOnce(1);
      const resultA = await repository.findByCompany('company-A', 1, 20);

      // When querying company-B, only company-B records returned
      mockFindMany.mockResolvedValueOnce(companyBRecords);
      mockCount.mockResolvedValueOnce(1);
      const resultB = await repository.findByCompany('company-B', 1, 20);

      // Verify company A query was issued with company-A scoping
      const callA = mockFindMany.mock.calls[0][0];
      expect(callA.where.companyId).toBe('company-A');

      // Verify company B query was issued with company-B scoping
      const callB = mockFindMany.mock.calls[1][0];
      expect(callB.where.companyId).toBe('company-B');

      // Results are properly isolated
      expect(resultA.items).toEqual(companyARecords);
      expect(resultB.items).toEqual(companyBRecords);
      expect(resultA.items).not.toContainEqual(expect.objectContaining({ companyId: 'company-B' }));
    });
  });

  describe('findById', () => {
    it('should find media by id with variants included', async () => {
      const media = { id: 'media-1', variants: [] };
      mockFindUnique.mockResolvedValue(media);

      const result = await repository.findById('media-1');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        include: { variants: true },
      });
      expect(result).toEqual(media);
    });
  });

  describe('deleteMedia', () => {
    it('should soft-delete by setting deletedAt to current date', async () => {
      const updated = { id: 'media-1', deletedAt: new Date() };
      mockUpdate.mockResolvedValue(updated);

      const before = new Date();
      const result = await repository.deleteMedia('media-1');
      const after = new Date();

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { deletedAt: expect.any(Date) },
      });
      const calledDeletedAt: Date = mockUpdate.mock.calls[0][0].data.deletedAt;
      expect(calledDeletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(calledDeletedAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
      expect(result).toEqual(updated);
    });
  });

  describe('createProcessingJob', () => {
    it('should create a MediaProcessingJob with pending status', async () => {
      const job = { id: 'job-1', mediaId: 'media-1', platforms: ['instagram'], status: 'pending' };
      mockProcessingJobCreate.mockResolvedValue(job);

      const result = await repository.createProcessingJob('media-1', ['instagram', 'facebook']);

      expect(mockProcessingJobCreate).toHaveBeenCalledWith({
        data: {
          mediaId: 'media-1',
          platforms: ['instagram', 'facebook'],
          status: 'pending',
        },
      });
      expect(result).toEqual(job);
    });
  });
});
