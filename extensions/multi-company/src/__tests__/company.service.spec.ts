/**
 * company.service.spec.ts — Unit tests for CompanyService CRUD operations.
 *
 * Tests the service with a mocked PrismaService so they run without a database.
 * Verifies: create, read, update, delete, slug uniqueness, and cascade delete semantics.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompanyService } from '../company/company.service';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock Prisma setup
// ---------------------------------------------------------------------------

const mockCompanyA: Record<string, any> = {
  id: 'company-a-id',
  name: 'Company A',
  slug: 'company-a',
  timezone: 'UTC',
  defaultLanguage: 'en',
  industry: null as string | null,
  website: null as string | null,
  logo: null as string | null,
  notes: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCompanyB: Record<string, any> = {
  id: 'company-b-id',
  name: 'Company B',
  slug: 'company-b',
  timezone: 'UTC',
  defaultLanguage: 'en',
  industry: null as string | null,
  website: null as string | null,
  logo: null as string | null,
  notes: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Create a minimal mock of what (prisma as any).company exposes
const mockPrismaCompany = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// PrismaService mock with $transaction support and company accessor
const mockPrismaService = {
  $transaction: jest.fn((fn: (tx: any) => any) => fn({ company: mockPrismaCompany })),
  // Direct access for non-transaction calls
  company: mockPrismaCompany,
} as unknown as PrismaService;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CompanyService', () => {
  let service: CompanyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    it('returns all companies ordered by name', async () => {
      mockPrismaCompany.findMany.mockResolvedValue([mockCompanyA, mockCompanyB]);
      (mockPrismaService.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: any) => any) => fn({ company: mockPrismaCompany })
      );

      const result = await service.findAll();

      expect(mockPrismaCompany.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
      expect(result).toEqual([mockCompanyA, mockCompanyB]);
    });
  });

  // -------------------------------------------------------------------------
  // findBySlug
  // -------------------------------------------------------------------------

  describe('findBySlug()', () => {
    it('returns the company when slug exists', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(mockCompanyA);

      const result = await service.findBySlug('company-a');

      expect(mockPrismaCompany.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'company-a' } })
      );
      expect(result).toEqual(mockCompanyA);
    });

    it('throws NotFoundException when slug does not exist', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById()', () => {
    it('returns the company when id exists', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(mockCompanyA);

      const result = await service.findById('company-a-id');

      expect(result).toEqual(mockCompanyA);
    });

    it('throws NotFoundException when id does not exist', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('creates a company when slug is unique', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(null); // slug not taken
      mockPrismaCompany.create.mockResolvedValue(mockCompanyA);

      const result = await service.create({
        name: 'Company A',
        slug: 'company-a',
      });

      expect(mockPrismaCompany.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Company A', slug: 'company-a' }),
        })
      );
      expect(result).toEqual(mockCompanyA);
    });

    it('throws ConflictException when slug already exists', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(mockCompanyA); // slug taken

      await expect(
        service.create({ name: 'Company A Duplicate', slug: 'company-a' })
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaCompany.create).not.toHaveBeenCalled();
    });

    it('uses default timezone UTC when not provided', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(null);
      mockPrismaCompany.create.mockResolvedValue({ ...mockCompanyA, timezone: 'UTC' });

      await service.create({ name: 'Test', slug: 'test' });

      expect(mockPrismaCompany.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ timezone: 'UTC' }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update()', () => {
    it('partially updates a company', async () => {
      mockPrismaCompany.findUnique
        .mockResolvedValueOnce(mockCompanyA) // findById check
        .mockResolvedValueOnce(null); // slug uniqueness check (no conflict)
      mockPrismaCompany.update.mockResolvedValue({ ...mockCompanyA, name: 'Updated Name' });

      const result = await service.update('company-a-id', { name: 'Updated Name', slug: 'company-a-new' });

      expect(mockPrismaCompany.update).toHaveBeenCalledWith({
        where: { id: 'company-a-id' },
        data: { name: 'Updated Name', slug: 'company-a-new' },
      });
      expect(result.name).toBe('Updated Name');
    });

    it('throws NotFoundException when id does not exist', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'Updated' })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new slug is taken by another company', async () => {
      mockPrismaCompany.findUnique
        .mockResolvedValueOnce(mockCompanyA) // findById - current company
        .mockResolvedValueOnce(mockCompanyB); // slug uniqueness check - slug taken by B

      await expect(
        service.update('company-a-id', { slug: 'company-b' })
      ).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // delete (cascade behavior verified by schema, not service)
  // -------------------------------------------------------------------------

  describe('delete()', () => {
    it('deletes the company when it exists', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(mockCompanyA);
      mockPrismaCompany.delete.mockResolvedValue(mockCompanyA);

      const result = await service.delete('company-a-id');

      expect(mockPrismaCompany.delete).toHaveBeenCalledWith({
        where: { id: 'company-a-id' },
      });
      expect(result).toEqual(mockCompanyA);
    });

    it('throws NotFoundException when company does not exist', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow(NotFoundException);

      expect(mockPrismaCompany.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // slug uniqueness constraint (duplicate slug throws)
  // -------------------------------------------------------------------------

  describe('slug uniqueness', () => {
    it('create: duplicate slug throws ConflictException', async () => {
      mockPrismaCompany.findUnique.mockResolvedValue(mockCompanyA);

      await expect(
        service.create({ name: 'Another Company', slug: 'company-a' })
      ).rejects.toThrow(ConflictException);
    });

    it('update: using another company slug throws ConflictException', async () => {
      mockPrismaCompany.findUnique
        .mockResolvedValueOnce(mockCompanyA) // findById
        .mockResolvedValueOnce(mockCompanyB); // slug taken by B

      await expect(
        service.update('company-a-id', { slug: 'company-b' })
      ).rejects.toThrow(ConflictException);
    });
  });
});
