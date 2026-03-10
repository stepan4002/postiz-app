/**
 * company-isolation.spec.ts — Integration tests proving cross-company data isolation.
 *
 * These are integration tests that run against a real PostgreSQL database.
 * PREREQUISITE: Docker Compose must be running and the company_hierarchy migration applied.
 *   pnpm run dev:docker
 *   pnpm run prisma:migrate
 *   pnpm run prisma:generate
 *
 * Each test creates isolated data and cleans up in afterAll.
 * Tests are deterministic and safe to run multiple times.
 *
 * Company Data Isolation — verified behaviors:
 * 1. Company A brands not visible when querying Company B brands
 * 2. Company B returns empty brands when only Company A has brands
 * 3. findAll() returns all companies (companies are top-level, not scoped)
 * 4. findAllByCompany(companyAId) returns only Company A brands
 * 5. BrandVoice for Company A brand is not accessible via Company B brand query
 * 6. SocialAccount for Company A brand not visible in Company B brand context
 * 7. Deleting Company cascades to brands, brand voices, and social accounts
 * 8. Company slug uniqueness is enforced (duplicate slug throws)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { BrandService } from '../brand/brand.service';
import { BrandVoiceService } from '../brand-voice/brand-voice.service';

// ---------------------------------------------------------------------------
// Test data setup helpers
// ---------------------------------------------------------------------------

const COMPANY_A_SLUG = 'isolation-test-a';
const COMPANY_B_SLUG = 'isolation-test-b';

describe('Company Data Isolation', () => {
  let module: TestingModule;
  let companyService: CompanyService;
  let brandService: BrandService;
  let brandVoiceService: BrandVoiceService;
  let prisma: PrismaService;

  let companyAId: string;
  let companyBId: string;
  let brandAId: string;

  // -------------------------------------------------------------------------
  // Setup: create test companies, brand A, brand voice A, social account A
  // -------------------------------------------------------------------------

  beforeAll(async () => {
    module = await Test.createTestingModule({
      // Flat providers — avoids NestJS module scoping issues with PrismaService
      providers: [PrismaService, CompanyService, BrandService, BrandVoiceService],
    }).compile();

    companyService = module.get<CompanyService>(CompanyService);
    brandService = module.get<BrandService>(BrandService);
    brandVoiceService = module.get<BrandVoiceService>(BrandVoiceService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clean up any leftover test data from a previous run
    await (prisma as any).company.deleteMany({
      where: { slug: { in: [COMPANY_A_SLUG, COMPANY_B_SLUG] } },
    });

    // Create Company A with a brand, brand voice, and social account
    const companyA = await companyService.create({
      name: 'Isolation Test Company A',
      slug: COMPANY_A_SLUG,
    });
    companyAId = companyA.id;

    const brandA = await brandService.create(companyAId, {
      name: 'Brand A',
      slug: 'brand-a',
    });
    brandAId = brandA.id;

    await brandVoiceService.upsert(brandAId, {
      tone: ['professional'],
      targetAudience: 'Company A audience',
    });

    await (prisma as any).socialAccount.create({
      data: {
        brandId: brandAId,
        platform: 'instagram',
        displayName: '@brand-a',
      },
    });

    // Create Company B with NO brands
    const companyB = await companyService.create({
      name: 'Isolation Test Company B',
      slug: COMPANY_B_SLUG,
    });
    companyBId = companyB.id;
  });

  // -------------------------------------------------------------------------
  // Cleanup: delete both test companies (cascade handles children)
  // -------------------------------------------------------------------------

  afterAll(async () => {
    await (prisma as any).company.deleteMany({
      where: { slug: { in: [COMPANY_A_SLUG, COMPANY_B_SLUG] } },
    });
    await module.close();
  });

  // -------------------------------------------------------------------------
  // Test 1: Creating a brand for Company A does NOT make it visible for Company B
  // -------------------------------------------------------------------------

  it('Test 1: Company A brand is NOT visible when querying Company B brands', async () => {
    const companyBBrands = await brandService.findAllByCompany(companyBId);

    // Company B has no brands — Company A's brand must not appear
    expect(companyBBrands).toHaveLength(0);
    expect(companyBBrands.map((b: any) => b.id)).not.toContain(brandAId);
  });

  // -------------------------------------------------------------------------
  // Test 2: Company B returns empty when only Company A has brands
  // -------------------------------------------------------------------------

  it('Test 2: Company B brand list is empty when only Company A has brands', async () => {
    const companyBBrands = await brandService.findAllByCompany(companyBId);

    expect(Array.isArray(companyBBrands)).toBe(true);
    expect(companyBBrands).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Test 3: Company findAll returns ALL companies (top-level, not scoped)
  // -------------------------------------------------------------------------

  it('Test 3: findAll() returns all companies including both test companies', async () => {
    const all = await companyService.findAll();
    const slugs = all.map((c: any) => c.slug);

    expect(slugs).toContain(COMPANY_A_SLUG);
    expect(slugs).toContain(COMPANY_B_SLUG);
  });

  // -------------------------------------------------------------------------
  // Test 4: findAllByCompany(companyAId) returns ONLY Company A brands
  // -------------------------------------------------------------------------

  it('Test 4: findAllByCompany(companyAId) returns only Company A brands', async () => {
    const companyABrands = await brandService.findAllByCompany(companyAId);

    expect(companyABrands).toHaveLength(1);
    expect(companyABrands[0].id).toBe(brandAId);
    expect(companyABrands[0].companyId).toBe(companyAId);
  });

  // -------------------------------------------------------------------------
  // Test 5: BrandVoice for Company A brand NOT accessible via Company B brand query
  // -------------------------------------------------------------------------

  it('Test 5: Brand voice for Company A brand not accessible in Company B brand context', async () => {
    // Company B has no brands, so there are no brand voices accessible from Company B
    const companyBBrands = await brandService.findAllByCompany(companyBId);
    const brandVoicesFromB = companyBBrands.flatMap((b: any) => b.brandVoice ?? []);

    expect(brandVoicesFromB).toHaveLength(0);

    // Verify Company A DOES have a brand voice (positive confirmation)
    const companyABrands = await brandService.findAllByCompany(companyAId);
    const brandVoiceA = companyABrands[0]?.brandVoice;
    expect(brandVoiceA).toBeDefined();
    expect(brandVoiceA.brandId).toBe(brandAId);
  });

  // -------------------------------------------------------------------------
  // Test 6: SocialAccount for Company A brand NOT visible in Company B brand context
  // -------------------------------------------------------------------------

  it('Test 6: Social accounts for Company A brand not visible in Company B brand context', async () => {
    const companyBBrands = await brandService.findAllByCompany(companyBId);
    const socialAccountsFromB = companyBBrands.flatMap((b: any) => b.socialAccounts ?? []);

    expect(socialAccountsFromB).toHaveLength(0);

    // Verify Company A DOES have a social account (positive confirmation)
    const companyABrands = await brandService.findAllByCompany(companyAId);
    const socialAccountsA = companyABrands[0]?.socialAccounts;
    expect(socialAccountsA).toHaveLength(1);
    expect(socialAccountsA[0].platform).toBe('instagram');
  });

  // -------------------------------------------------------------------------
  // Test 7: Deleting Company cascades to brands, brand voices, and social accounts
  // -------------------------------------------------------------------------

  it('Test 7: Deleting a company cascades to delete its brands, brand voices, and social accounts', async () => {
    // Create a temporary company with full hierarchy
    const tempCompany = await companyService.create({
      name: 'Temp Company for Cascade Test',
      slug: 'isolation-test-temp-cascade',
    });

    const tempBrand = await brandService.create(tempCompany.id, {
      name: 'Temp Brand',
      slug: 'temp-brand',
    });

    await brandVoiceService.upsert(tempBrand.id, {
      tone: ['casual'],
    });

    await (prisma as any).socialAccount.create({
      data: {
        brandId: tempBrand.id,
        platform: 'facebook',
        displayName: 'Temp Brand FB',
      },
    });

    // Verify all children exist before delete
    const brandBefore = await (prisma as any).brand.findUnique({ where: { id: tempBrand.id } });
    expect(brandBefore).not.toBeNull();

    const voiceBefore = await (prisma as any).brandVoice.findUnique({
      where: { brandId: tempBrand.id },
    });
    expect(voiceBefore).not.toBeNull();

    const accountsBefore = await (prisma as any).socialAccount.findMany({
      where: { brandId: tempBrand.id },
    });
    expect(accountsBefore).toHaveLength(1);

    // Delete the company
    await companyService.delete(tempCompany.id);

    // Verify all children are gone (cascade delete)
    const brandAfter = await (prisma as any).brand.findUnique({ where: { id: tempBrand.id } });
    expect(brandAfter).toBeNull();

    const voiceAfter = await (prisma as any).brandVoice.findUnique({
      where: { brandId: tempBrand.id },
    });
    expect(voiceAfter).toBeNull();

    const accountsAfter = await (prisma as any).socialAccount.findMany({
      where: { brandId: tempBrand.id },
    });
    expect(accountsAfter).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Test 8: Company slug uniqueness is enforced (duplicate slug throws)
  // -------------------------------------------------------------------------

  it('Test 8: Company slug uniqueness is enforced — duplicate slug throws ConflictException', async () => {
    // COMPANY_A_SLUG already exists — creating another with same slug should throw
    await expect(
      companyService.create({
        name: 'Duplicate Slug Company',
        slug: COMPANY_A_SLUG,
      })
    ).rejects.toThrow();
  });
});
