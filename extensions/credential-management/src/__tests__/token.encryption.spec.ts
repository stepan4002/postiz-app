import { TokenEncryptionService } from '../encryption/token.encryption.service';

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService;

  beforeAll(() => {
    // Set the encryption key before instantiating the service
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';
  });

  beforeEach(() => {
    service = new TokenEncryptionService();
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt', () => {
    it('should produce a hex-encoded ciphertext with minimum length (12-byte IV + 16-byte tag + at least 1 byte ciphertext)', () => {
      const ciphertext = service.encrypt('hello world');
      // 12 (IV) + 16 (tag) = 28 bytes minimum overhead = 56 hex chars
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext.length).toBeGreaterThanOrEqual(56);
      expect(ciphertext).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce different output each call for the same input (random IV)', () => {
      const plaintext = 'same-input-value';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle composite tokens containing colons (X-style accessToken:accessSecret)', () => {
      const compositeToken = 'AKfakeAccessToken:AKfakeAccessSecret';
      const encrypted = service.encrypt(compositeToken);
      expect(encrypted.length).toBeGreaterThanOrEqual(56);
      expect(encrypted).toMatch(/^[0-9a-f]+$/);
    });

    it('should handle empty string edge case', () => {
      const encrypted = service.encrypt('');
      // Even empty string has IV + tag overhead
      expect(encrypted.length).toBeGreaterThanOrEqual(56);
      expect(encrypted).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('decrypt', () => {
    it('should round-trip: decrypt(encrypt(value)) === value for "hello world"', () => {
      const original = 'hello world';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should round-trip: decrypt(encrypt(value)) === value for composite tokens with colons', () => {
      const compositeToken = 'AKfakeAccessToken:AKfakeAccessSecret';
      const encrypted = service.encrypt(compositeToken);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(compositeToken);
    });

    it('should round-trip: decrypt(encrypt("")) === "" for empty string', () => {
      const original = '';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should throw when tampering with the ciphertext (GCM auth tag verification fails)', () => {
      const encrypted = service.encrypt('sensitive-token');
      // Tamper with the ciphertext bytes (flip some hex chars in the ciphertext portion)
      const tamperedHex = encrypted.slice(0, -4) + 'dead';
      expect(() => service.decrypt(tamperedHex)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('should return true for a valid encrypted hex string (length >= 56)', () => {
      const encrypted = service.encrypt('some token');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for a plaintext string', () => {
      expect(service.isEncrypted('ya29.plaintext-oauth-token')).toBe(false);
    });

    it('should return false for a short hex string (less than 56 chars)', () => {
      expect(service.isEncrypted('deadbeef1234')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(service.isEncrypted('')).toBe(false);
    });
  });

  describe('constructor validation', () => {
    it('should throw an error if ENCRYPTION_KEY env var is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      expect(() => new TokenEncryptionService()).toThrow(
        /ENCRYPTION_KEY/
      );
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });
});
