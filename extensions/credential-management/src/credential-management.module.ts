import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenEncryptionService } from './encryption/token.encryption.service';
import { CredentialService } from './credential/credential.service';
import { CredentialRepository } from './refresh/credential.repository';
import { TokenHealthService } from './health/token.health.service';
import { TokenRefreshJob } from './refresh/token.refresh.job';
import { OAuthBrandController } from './oauth/oauth.brand.controller';
import { TokenHealthController } from './health/token.health.controller';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';

/**
 * CredentialManagementModule
 *
 * NestJS module that wires all credential management services, cron jobs,
 * and controllers together. Registers in AppModule after MultiCompanyModule.
 *
 * Services provided:
 * - TokenEncryptionService: AES-256-GCM encrypt/decrypt (Plan 01)
 * - CredentialService: encrypt-on-write, decrypt-on-read wrapper (Plan 03)
 * - CredentialRepository: DB queries for token refresh job (Plan 02)
 * - TokenHealthService: health state calculator (Plan 02)
 * - TokenRefreshJob: proactive @Cron token refresh (Plan 02, wired here)
 *
 * Controllers:
 * - OAuthBrandController: /api/credentials/oauth/start + /api/credentials/oauth/callback (Plan 03)
 * - TokenHealthController: /api/credentials/health (Plan 04)
 *
 * Exports (for other modules):
 * - CredentialService, TokenEncryptionService, TokenHealthService, CredentialRepository
 *
 * Dependency injection:
 * The interface-typed constructor parameters in CredentialRepository, TokenRefreshJob,
 * and CredentialService are resolved here by providing the real implementations
 * (PrismaService, RefreshIntegrationService, NotificationService) which are
 * globally available from DatabaseModule (@Global).
 */
@Module({
  imports: [
    // Required for @Cron support in TokenRefreshJob
    ScheduleModule.forRoot(),
  ],
  providers: [
    TokenEncryptionService,
    TokenHealthService,

    // CredentialRepository depends on PrismaIntegrationModel (interface).
    // PrismaService satisfies this interface: prisma.integration.findMany / update
    {
      provide: CredentialRepository,
      useFactory: (prisma: PrismaService) => new CredentialRepository(prisma),
      inject: [PrismaService],
    },

    // CredentialService depends on TokenEncryptionService + ICredentialPrismaService.
    // PrismaService satisfies ICredentialPrismaService (has integration.update + findUnique).
    {
      provide: CredentialService,
      useFactory: (
        encryption: TokenEncryptionService,
        prisma: PrismaService
      ) => new CredentialService(encryption, prisma),
      inject: [TokenEncryptionService, PrismaService],
    },

    // TokenRefreshJob depends on interfaces for RefreshIntegrationService,
    // NotificationService, and PrismaService. Wire real implementations here.
    {
      provide: TokenRefreshJob,
      useFactory: (
        credentialRepository: CredentialRepository,
        tokenEncryptionService: TokenEncryptionService,
        refreshService: RefreshIntegrationService,
        notificationService: NotificationService,
        prisma: PrismaService
      ) =>
        new TokenRefreshJob(
          credentialRepository,
          tokenEncryptionService,
          refreshService,
          notificationService,
          prisma
        ),
      inject: [
        CredentialRepository,
        TokenEncryptionService,
        RefreshIntegrationService,
        NotificationService,
        PrismaService,
      ],
    },
  ],
  controllers: [
    OAuthBrandController,
    TokenHealthController,
  ],
  exports: [
    CredentialService,
    TokenEncryptionService,
    TokenHealthService,
    CredentialRepository,
  ],
})
export class CredentialManagementModule {}
