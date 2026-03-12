/**
 * @social/content-ingestion — Public API
 *
 * Content source management and automated ingestion pipeline.
 * Supports RSS feeds, blog pages, and product pages as content sources.
 *
 * NestJS module for registration in AppModule:
 *   import { ContentIngestionModule } from '@social/content-ingestion';
 *
 * Exported services for cross-module use:
 *   ContentIngestionService  — source CRUD + manual fetch trigger
 *   ContentIngestionRepository — direct Prisma access to ContentSource + SourceItem
 *
 * Fetchers (available for direct use if needed):
 *   RssFetcher     — RSS 2.0 and Atom 1.0 feed parser
 *   BlogFetcher    — Blog/article page scraper
 *   ProductFetcher — Product page meta-tag extractor
 *
 * Type contracts:
 *   CreateSourceDto — DTO for source creation (name, type, url?, config?)
 *   FetchedItem     — Normalized item returned by all fetchers
 */

// NestJS module
export { ContentIngestionModule } from './content-ingestion.module';

// Repository: Prisma data access layer for ContentSource + SourceItem
export { ContentIngestionRepository } from './content-ingestion.repository';

// Service: business logic, source CRUD, fetch orchestration
export { ContentIngestionService } from './content-ingestion.service';

// DTO types
export type { CreateSourceDto } from './content-ingestion.service';

// Controller: REST endpoints for /companies/:companySlug/sources
export { ContentIngestionController } from './content-ingestion.controller';

// Cron job: 15-minute polling of enabled sources
export { ContentIngestionCron } from './content-ingestion.cron';

// Fetchers: can be imported directly for testing or embedding in other services
export { RssFetcher } from './fetchers/rss.fetcher';
export { BlogFetcher } from './fetchers/blog.fetcher';
export { ProductFetcher } from './fetchers/product.fetcher';

// Shared type
export type { FetchedItem } from './fetchers/rss.fetcher';
