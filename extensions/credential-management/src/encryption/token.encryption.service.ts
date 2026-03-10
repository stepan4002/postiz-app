import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * TokenEncryptionService
 *
 * AES-256-GCM encryption for OAuth tokens and secrets.
 * Used in Phase 2: Credential Management to ensure tokens are stored
 * encrypted at rest in the database.
 *
 * Encryption format (hex-encoded):
 *   [12-byte IV][16-byte auth tag][N-byte ciphertext]
 *   = minimum 56 hex characters for empty plaintext
 */
@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // bytes (recommended for GCM)
  private static readonly TAG_LENGTH = 16; // bytes (GCM auth tag)

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required but not set. ' +
        'Set ENCRYPTION_KEY to a secure random string before starting the application.'
      );
    }
    // Derive a 32-byte key from the raw key string via SHA-256
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Generates a random 12-byte IV on each call, so the same plaintext
   * produces different ciphertext each time.
   *
   * @param plaintext - The string to encrypt (any UTF-8 content)
   * @returns Hex-encoded string: [IV][auth tag][ciphertext]
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(TokenEncryptionService.IV_LENGTH);
    const cipher = crypto.createCipheriv(
      TokenEncryptionService.ALGORITHM,
      this.key,
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // Layout: [12-byte IV][16-byte tag][ciphertext]
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  /**
   * Decrypt a hex-encoded ciphertext produced by encrypt().
   * GCM authentication tag verification happens automatically —
   * any tampering with the ciphertext will cause this to throw.
   *
   * @param hexData - Hex-encoded string from encrypt()
   * @returns Original plaintext string
   * @throws Error if authentication tag verification fails (tampered data)
   */
  decrypt(hexData: string): string {
    const data = Buffer.from(hexData, 'hex');

    const iv = data.subarray(0, TokenEncryptionService.IV_LENGTH);
    const tag = data.subarray(
      TokenEncryptionService.IV_LENGTH,
      TokenEncryptionService.IV_LENGTH + TokenEncryptionService.TAG_LENGTH
    );
    const ciphertext = data.subarray(
      TokenEncryptionService.IV_LENGTH + TokenEncryptionService.TAG_LENGTH
    );

    const decipher = crypto.createDecipheriv(
      TokenEncryptionService.ALGORITHM,
      this.key,
      iv
    );
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Check whether a string value appears to already be encrypted.
   * A value is considered encrypted if it is a valid lowercase hex string
   * of at least 56 characters (minimum overhead: 12-byte IV + 16-byte tag).
   *
   * This is a heuristic check — not a cryptographic guarantee.
   *
   * @param value - String to test
   * @returns true if value looks like an encrypted hex string
   */
  isEncrypted(value: string): boolean {
    if (!value || value.length < 56) {
      return false;
    }
    return /^[0-9a-f]+$/.test(value);
  }
}
