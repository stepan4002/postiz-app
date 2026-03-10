import { Injectable, Logger } from '@nestjs/common';
import { CredentialRepository } from './credential.repository';
import { TokenEncryptionService } from '../encryption/token.encryption.service';

/**
 * Minimal interface for the upstream RefreshIntegrationService.
 * Avoids tight coupling to @gitroom/nestjs-libraries at this layer.
 * The actual service is injected via NestJS DI in the module (Plan 03).
 */
export interface IRefreshIntegrationService {
  refresh(integration: any): Promise<false | { accessToken: string; refreshToken?: string | null; expiresIn?: number }>;
}

/**
 * Minimal interface for NotificationService.
 */
export interface INotificationService {
  inAppNotification(
    orgId: string,
    subject: string,
    message: string,
    sendEmail?: boolean,
    digest?: boolean,
    type?: string
  ): Promise<void>;
}

/**
 * Minimal interface for PrismaService (token update after refresh).
 */
export interface ITokenPrismaService {
  integration: {
    update(args: object): Promise<any>;
  };
}

/**
 * TokenRefreshJob
 *
 * Proactive @Cron job that refreshes OAuth tokens before they expire.
 * Runs every 10 minutes to find tokens at 75% of their lifetime and
 * attempt a proactive refresh using the upstream provider.
 *
 * Behavior:
 * - Guarded by RUN_CRON env var (only runs in orchestrator/worker context)
 * - Skips X provider tokens (non-expiring, handled by CredentialRepository filter)
 * - On success: resets failure counter and updates lastRefreshedAt
 * - On failure: increments failure counter
 * - On 3rd consecutive failure: triggers in-app notification to org operators
 *
 * Wired into CredentialManagementModule in Plan 03.
 */
@Injectable()
export class TokenRefreshJob {
  private readonly logger = new Logger(TokenRefreshJob.name);

  /**
   * Number of consecutive failures that triggers an operator alert.
   * Alert fires when consecutiveFailures is about to reach this threshold.
   */
  private static readonly ALERT_THRESHOLD = 3;

  constructor(
    private readonly credentialRepository: CredentialRepository,
    private readonly tokenEncryptionService: TokenEncryptionService,
    private readonly refreshService: IRefreshIntegrationService,
    private readonly notificationService: INotificationService,
    private readonly prisma: ITokenPrismaService
  ) {}

  /**
   * Main cron method. Called every 10 minutes.
   *
   * @Cron decorator is applied when wired into NestJS module in Plan 03
   * to avoid importing @nestjs/schedule here (keeps unit tests simple).
   */
  async refreshExpiringTokens(): Promise<void> {
    // Guard: only run in contexts where RUN_CRON is set (orchestrator/worker)
    if (!process.env.RUN_CRON) {
      return;
    }

    const integrations = await this.credentialRepository.findTokensAt75Percent();
    this.logger.log(`Proactive refresh: found ${integrations.length} token(s) at 75% lifetime`);

    for (const integration of integrations) {
      await this.processIntegration(integration);
    }
  }

  /**
   * Process a single integration: decrypt tokens, attempt refresh,
   * update failure tracking, and alert on threshold breach.
   */
  private async processIntegration(integration: any): Promise<void> {
    const { id, organizationId, consecutiveFailures } = integration;

    // Decrypt tokens before passing to provider refresh logic
    const decryptedToken = this.decryptIfNeeded(integration.token, integration.tokenEncrypted);
    const decryptedRefreshToken = integration.refreshToken
      ? this.decryptIfNeeded(integration.refreshToken, integration.tokenEncrypted)
      : null;

    const integrationWithDecryptedTokens = {
      ...integration,
      token: decryptedToken,
      refreshToken: decryptedRefreshToken,
    };

    let refreshResult: false | { accessToken: string; refreshToken?: string | null; expiresIn?: number };

    try {
      refreshResult = await this.refreshService.refresh(integrationWithDecryptedTokens);
    } catch (err) {
      this.logger.error(`Refresh failed for integration ${id} (exception): ${err}`);
      refreshResult = false;
    }

    if (refreshResult && refreshResult.accessToken) {
      await this.handleRefreshSuccess(id, refreshResult);
    } else {
      await this.handleRefreshFailure(id, organizationId, consecutiveFailures);
    }
  }

  /**
   * Handle a successful token refresh: re-encrypt and save new tokens,
   * then reset the failure counter.
   */
  private async handleRefreshSuccess(
    id: string,
    result: { accessToken: string; refreshToken?: string | null; expiresIn?: number }
  ): Promise<void> {
    this.logger.log(`Token refresh succeeded for integration ${id}`);

    // Re-encrypt the new tokens before storing
    const encryptedAccessToken = this.tokenEncryptionService.encrypt(result.accessToken);
    const encryptedRefreshToken = result.refreshToken
      ? this.tokenEncryptionService.encrypt(result.refreshToken)
      : null;

    // Persist updated tokens
    const updateData: Record<string, any> = {
      token: encryptedAccessToken,
      tokenEncrypted: true,
    };
    if (encryptedRefreshToken !== null) {
      updateData.refreshToken = encryptedRefreshToken;
    }
    if (result.expiresIn) {
      updateData.tokenExpiration = new Date(Date.now() + result.expiresIn * 1000);
    }

    await this.prisma.integration.update({
      where: { id },
      data: updateData,
    });

    await this.credentialRepository.resetFailureCount(id);
  }

  /**
   * Handle a failed token refresh: increment failure counter and
   * alert the org operator if the threshold is reached.
   */
  private async handleRefreshFailure(
    id: string,
    organizationId: string,
    currentFailures: number
  ): Promise<void> {
    this.logger.warn(
      `Token refresh failed for integration ${id} (consecutive failures: ${currentFailures + 1})`
    );

    await this.credentialRepository.incrementFailureCount(id);

    // Alert when about to reach the 3rd consecutive failure
    // currentFailures is the value BEFORE this failure, so:
    //   currentFailures=2 means this is the 3rd failure → trigger alert
    if (currentFailures >= TokenRefreshJob.ALERT_THRESHOLD - 1) {
      await this.maybeAlertOperator(organizationId, id, currentFailures + 1);
    }
  }

  /**
   * Send an in-app notification to the organization about repeated refresh failures.
   */
  private async maybeAlertOperator(
    organizationId: string,
    integrationId: string,
    failureCount: number
  ): Promise<void> {
    this.logger.error(
      `Integration ${integrationId} has failed ${failureCount} consecutive times — alerting org ${organizationId}`
    );

    await this.notificationService.inAppNotification(
      organizationId,
      'Token Refresh Failed',
      `An OAuth token refresh has failed ${failureCount} consecutive times for integration ${integrationId}. ` +
        `Please reconnect the integration to restore posting capability.`,
      false,
      false,
      'fail'
    );
  }

  /**
   * Decrypt a token value if the tokenEncrypted flag is set and the value
   * passes the isEncrypted heuristic check.
   */
  private decryptIfNeeded(value: string, tokenEncrypted: boolean): string {
    if (!tokenEncrypted) {
      return value;
    }
    if (this.tokenEncryptionService.isEncrypted(value)) {
      return this.tokenEncryptionService.decrypt(value);
    }
    return value;
  }
}
