/**
 * Idempotent seed script for Social Command Centre dev/test data.
 *
 * Creates 3 companies with brands, brand voices, and mock social accounts.
 * Safe to run multiple times — uses Prisma upsert on unique constraints.
 *
 * Usage: pnpm run prisma:seed
 *        (or: npx tsx extensions/seed/seed.ts)
 *
 * Requires: DATABASE_URL set (Docker Postgres must be running)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Social Command Centre data...');

  // =========================================================================
  // Company 1: Verde Kitchen — Greek restaurant, 1 brand
  // =========================================================================
  const verdeKitchen = await (prisma as any).company.upsert({
    where: { slug: 'verde-kitchen' },
    update: {},
    create: {
      name: 'Verde Kitchen',
      slug: 'verde-kitchen',
      industry: 'food-beverage',
      timezone: 'Europe/Athens',
      defaultLanguage: 'el',
      website: 'https://verdekitchen.gr',
      notes: 'Family-run Mediterranean restaurant in Athens',
    },
  });
  console.log(`Upserted company: ${verdeKitchen.name} (${verdeKitchen.id})`);

  const verdeMain = await (prisma as any).brand.upsert({
    where: { companyId_slug: { companyId: verdeKitchen.id, slug: 'verde-main' } },
    update: {},
    create: {
      companyId: verdeKitchen.id,
      name: 'Verde Kitchen',
      slug: 'verde-main',
      description: 'The main brand for Verde Kitchen restaurant',
    },
  });
  console.log(`  Upserted brand: ${verdeMain.name} (${verdeMain.id})`);

  await (prisma as any).brandVoice.upsert({
    where: { brandId: verdeMain.id },
    update: {},
    create: {
      brandId: verdeMain.id,
      tone: ['warm', 'friendly', 'appetizing'],
      targetAudience: 'Families and food lovers aged 25-55',
      preferredHashtags: ['#MediterraneanFood', '#FreshIngredients', '#FamilyDining'],
      blacklistedWords: ['cheap', 'fast food', 'greasy'],
      language: 'el',
      notes: 'Emphasize fresh seasonal ingredients and family atmosphere',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: verdeMain.id, platform: 'instagram' } },
    update: {},
    create: {
      brandId: verdeMain.id,
      platform: 'instagram',
      displayName: '@verde.kitchen',
      externalId: 'verde.kitchen',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: verdeMain.id, platform: 'facebook' } },
    update: {},
    create: {
      brandId: verdeMain.id,
      platform: 'facebook',
      displayName: 'Verde Kitchen',
      externalId: 'verdekitchen',
    },
  });

  // =========================================================================
  // Company 2: Nexus AI — Tech startup, 1 brand
  // =========================================================================
  const nexusAI = await (prisma as any).company.upsert({
    where: { slug: 'nexus-ai' },
    update: {},
    create: {
      name: 'Nexus AI',
      slug: 'nexus-ai',
      industry: 'technology',
      timezone: 'UTC',
      defaultLanguage: 'en',
      website: 'https://nexus.ai',
      notes: 'AI-powered operations platform for SMBs',
    },
  });
  console.log(`Upserted company: ${nexusAI.name} (${nexusAI.id})`);

  const nexusMain = await (prisma as any).brand.upsert({
    where: { companyId_slug: { companyId: nexusAI.id, slug: 'nexus-main' } },
    update: {},
    create: {
      companyId: nexusAI.id,
      name: 'Nexus AI',
      slug: 'nexus-main',
      description: 'The main brand for Nexus AI',
    },
  });
  console.log(`  Upserted brand: ${nexusMain.name} (${nexusMain.id})`);

  await (prisma as any).brandVoice.upsert({
    where: { brandId: nexusMain.id },
    update: {},
    create: {
      brandId: nexusMain.id,
      tone: ['professional', 'innovative', 'clear'],
      targetAudience: 'SMB operations teams and CTOs',
      preferredHashtags: ['#AIAutomation', '#OperationsAI', '#FutureOfWork'],
      blacklistedWords: ['hype', 'revolutionary', 'disruptive'],
      language: 'en',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: nexusMain.id, platform: 'instagram' } },
    update: {},
    create: {
      brandId: nexusMain.id,
      platform: 'instagram',
      displayName: '@nexusai',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: nexusMain.id, platform: 'linkedin' } },
    update: {},
    create: {
      brandId: nexusMain.id,
      platform: 'linkedin',
      displayName: 'Nexus AI',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: nexusMain.id, platform: 'x' } },
    update: {},
    create: {
      brandId: nexusMain.id,
      platform: 'x',
      displayName: '@nexusai',
    },
  });

  // =========================================================================
  // Company 3: Aura Fashion — Fashion brand, 2 brands
  // =========================================================================
  const auraFashion = await (prisma as any).company.upsert({
    where: { slug: 'aura-fashion' },
    update: {},
    create: {
      name: 'Aura Fashion',
      slug: 'aura-fashion',
      industry: 'fashion',
      timezone: 'Europe/London',
      defaultLanguage: 'en',
      website: 'https://aurafashion.com',
      notes: 'Premium fashion brand with two sub-brands: womenswear and active',
    },
  });
  console.log(`Upserted company: ${auraFashion.name} (${auraFashion.id})`);

  // Brand 1: Aura Womenswear
  const auraWomenswear = await (prisma as any).brand.upsert({
    where: { companyId_slug: { companyId: auraFashion.id, slug: 'aura-womenswear' } },
    update: {},
    create: {
      companyId: auraFashion.id,
      name: 'Aura Womenswear',
      slug: 'aura-womenswear',
      description: 'Elegant womenswear for the modern professional',
    },
  });
  console.log(`  Upserted brand: ${auraWomenswear.name} (${auraWomenswear.id})`);

  await (prisma as any).brandVoice.upsert({
    where: { brandId: auraWomenswear.id },
    update: {},
    create: {
      brandId: auraWomenswear.id,
      tone: ['elegant', 'aspirational', 'empowering'],
      targetAudience: 'Women 25-45, urban professionals',
      preferredHashtags: ['#AuraWomenswear', '#ElegantFashion', '#PowerDressing'],
      blacklistedWords: ['cheap', 'discount', 'fast fashion'],
      language: 'en',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: auraWomenswear.id, platform: 'instagram' } },
    update: {},
    create: {
      brandId: auraWomenswear.id,
      platform: 'instagram',
      displayName: '@aura.womenswear',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: auraWomenswear.id, platform: 'facebook' } },
    update: {},
    create: {
      brandId: auraWomenswear.id,
      platform: 'facebook',
      displayName: 'Aura Womenswear',
    },
  });

  // Brand 2: Aura Active
  const auraActive = await (prisma as any).brand.upsert({
    where: { companyId_slug: { companyId: auraFashion.id, slug: 'aura-active' } },
    update: {},
    create: {
      companyId: auraFashion.id,
      name: 'Aura Active',
      slug: 'aura-active',
      description: 'High-performance activewear for fitness-minded women',
    },
  });
  console.log(`  Upserted brand: ${auraActive.name} (${auraActive.id})`);

  await (prisma as any).brandVoice.upsert({
    where: { brandId: auraActive.id },
    update: {},
    create: {
      brandId: auraActive.id,
      tone: ['energetic', 'motivating', 'inclusive'],
      targetAudience: 'Fitness-minded women 20-40',
      preferredHashtags: ['#AuraActive', '#FitnessMotivation', '#ActiveWear'],
      blacklistedWords: ['diet', 'skinny', 'losing weight'],
      language: 'en',
    },
  });

  await (prisma as any).socialAccount.upsert({
    where: { brandId_platform: { brandId: auraActive.id, platform: 'instagram' } },
    update: {},
    create: {
      brandId: auraActive.id,
      platform: 'instagram',
      displayName: '@aura.active',
    },
  });

  console.log('\nSeed complete! 3 companies, 4 brands, 4 brand voices, 8 social accounts.');
}

main()
  .then(() => {
    console.log('Done.');
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
