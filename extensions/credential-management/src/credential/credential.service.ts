import { Injectable } from '@nestjs/common';
import { TokenEncryptionService } from '../encryption/token.encryption.service';

/**
 * Parameters for saving (updating) an integration's token credentials.
 */
export interface SaveCredentialParams {
  integrationId: string;
  token: string;
  refreshToken: string | null;
  expiresIn?: number;
}

/**
 * Minimal Prisma interface for CredentialService.
 * Only the integration model methods we need — avoids tight coupling to
 * PrismaClient while keeping tests simple via mocking.
 */
export interface ICredentialPrismaService {
  integration: {
    update(args: object): Promise<any>;
    findUnique(args: object): Promise<any | null>;
  };
}

/**
 * CredentialService
 *
 * Wraps token-specific operations on the Integration model with
 * AES-256-GCM encryption provided by TokenEncryptionService.
 *
 * Design: This service does NOT replace IntegrationService.
 * It handles the token write/read lifecycle:
 * - saveCredential(): encrypt and persist token + refreshToken
 * - decryptToken(): decrypt on read with backward compatibility for legacy tokens
 * - decryptRefreshToken(): same logic, handles null
 * - encryptExistingToken(): one-time migration for unencrypted legacy tokens
 *
 * The upstream IntegrationService.createOrUpdateIntegration() still handles
 * initial OAuth persistence. OAuthBrandController (Plan 03 Task 2) calls that
 * method first and then calls saveCredential() to encrypt the stored token.
 */
@Injectable()
export class CredentialService {
  constructor(
    private readonly encryption: TokenEncryptionService,
    private readonly prisma: ICredentialPrismaService
  ) {}

  /**
   * Encrypt token and refreshToken and persist them to the Integration record.
   * Sets tokenEncrypted=true. Handles null refreshToken gracefully.
   *
   * @param params - integrationId, plaintext token, plaintext refreshToken (or null), optional expiresIn
   */
  async saveCredential(params: SaveCredentialParams): Promise<void> {
    const { integrationId, token, refreshToken, expiresIn } = params;

    const encryptedToken = this.encryption.encrypt(token);
    const encryptedRefreshToken = refreshToken
      ? this.encryption.encrypt(refreshToken)
      : null;

    const updateData: Record<string, any> = {
      token: encryptedToken,
      tokenEncrypted: true,
    };

    if (encryptedRefreshToken !== null) {
      updateData.refreshToken = encryptedRefreshToken;
    }

    if (expiresIn !== undefined && expiresIn !== null) {
      updateData.tokenExpiration = new Date(Date.now() + expiresIn * 1000);
    }

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: updateData,
    });
  }

  /**
   * Decrypt an integration's access token.
   *
   * Backward compatibility:
   * - tokenEncrypted=false: return the raw token (legacy, pre-encryption)
   * - tokenEncrypted=true: decrypt via AES-256-GCM
   *
   * @param integration - Object with token string and tokenEncrypted boolean
   * @returns Plaintext token string
   */
  decryptToken(integration: { token: string; tokenEncrypted: boolean }): string {
    if (!integration.tokenEncrypted) {
      // Backward compat: pre-encryption token stored in plaintext
      return integration.token;
    }
    return this.encryption.decrypt(integration.token);
  }

  /**
   * Decrypt an integration's refresh token.
   *
   * Same backward-compat logic as decryptToken, but handles null refreshToken.
   *
   * @param integration - Object with refreshToken (string or null) and tokenEncrypted boolean
   * @returns Plaintext refresh token string, or null if no refresh token
   */
  decryptRefreshToken(integration: {
    refreshToken: string | null;
    tokenEncrypted: boolean;
  }): string | null {
    if (!integration.refreshToken) {
      return null;
    }
    if (!integration.tokenEncrypted) {
      // Backward compat: pre-encryption token stored in plaintext
      return integration.refreshToken;
    }
    return this.encryption.decrypt(integration.refreshToken);
  }

  /**
   * Encrypt an existing (unencrypted) integration's token and refreshToken.
   * Used for one-time migration of legacy integrations.
   *
   * Reads the current token from DB, encrypts it, and saves it back with
   * tokenEncrypted=true. If the token is already encrypted (heuristic check),
   * it is left unchanged to avoid double-encryption.
   *
   * @param integrationId - The Integration.id to migrate
   */
  async encryptExistingToken(integrationId: string): Promise<void> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    // Skip if already encrypted
    if (integration.tokenEncrypted) {
      return;
    }

    // Guard against double-encryption via heuristic
    const tokenIsEncrypted = this.encryption.isEncrypted(integration.token);
    const refreshTokenIsEncrypted =
      integration.refreshToken
        ? this.encryption.isEncrypted(integration.refreshToken)
        : true; // null is considered "done"

    if (tokenIsEncrypted && refreshTokenIsEncrypted) {
      // Looks encrypted already — just set the flag
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { tokenEncrypted: true },
      });
      return;
    }

    const encryptedToken = tokenIsEncrypted
      ? integration.token
      : this.encryption.encrypt(integration.token);

    const encryptedRefreshToken =
      integration.refreshToken && !refreshTokenIsEncrypted
        ? this.encryption.encrypt(integration.refreshToken)
        : integration.refreshToken;

    const updateData: Record<string, any> = {
      token: encryptedToken,
      tokenEncrypted: true,
    };

    if (encryptedRefreshToken !== null) {
      updateData.refreshToken = encryptedRefreshToken;
    }

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: updateData,
    });
  }
}
