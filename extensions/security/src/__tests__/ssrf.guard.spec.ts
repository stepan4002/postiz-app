import { assertSafeUrl } from '../ssrf.guard';

describe('assertSafeUrl', () => {
  describe('HTTP rejection (non-HTTPS)', () => {
    it('throws for http:// URLs', () => {
      expect(() => assertSafeUrl('http://example.com')).toThrow('Only HTTPS URLs allowed');
    });

    it('throws for ftp:// URLs', () => {
      expect(() => assertSafeUrl('ftp://example.com/file.txt')).toThrow('Only HTTPS URLs allowed');
    });

    it('throws for plain http with path', () => {
      expect(() => assertSafeUrl('http://example.com/api/data')).toThrow('Only HTTPS URLs allowed');
    });
  });

  describe('Private IP range rejection', () => {
    it('throws for 192.168.x.x range', () => {
      expect(() => assertSafeUrl('https://192.168.1.1/path')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 192.168.0.0', () => {
      expect(() => assertSafeUrl('https://192.168.0.0')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 10.x.x.x range', () => {
      expect(() => assertSafeUrl('https://10.0.0.1/path')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 10.255.255.255', () => {
      expect(() => assertSafeUrl('https://10.255.255.255')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 172.16.x.x range', () => {
      expect(() => assertSafeUrl('https://172.16.0.1/path')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 172.31.x.x range', () => {
      expect(() => assertSafeUrl('https://172.31.255.255')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 127.0.0.1 (loopback)', () => {
      expect(() => assertSafeUrl('https://127.0.0.1/path')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 127.x.x.x loopback range', () => {
      expect(() => assertSafeUrl('https://127.100.50.25')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 169.254.x.x (link-local / APIPA)', () => {
      expect(() => assertSafeUrl('https://169.254.1.1/path')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for 169.254.169.254 (AWS metadata endpoint)', () => {
      expect(() => assertSafeUrl('https://169.254.169.254/latest/meta-data/')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for IPv6 loopback ::1', () => {
      expect(() => assertSafeUrl('https://[::1]/path')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for IPv6 ULA fc00:: range', () => {
      expect(() => assertSafeUrl('https://[fc00::1]/path')).toThrow('Private IP ranges are not allowed');
    });

    it('throws for IPv6 ULA fd00:: range', () => {
      expect(() => assertSafeUrl('https://[fd12:3456:789a:1::1]/path')).toThrow('Private IP ranges are not allowed');
    });
  });

  describe('Internal hostname rejection', () => {
    it('throws for localhost hostname', () => {
      expect(() => assertSafeUrl('https://localhost/path')).toThrow('Internal hostnames are not allowed');
    });

    it('throws for LOCALHOST uppercase', () => {
      expect(() => assertSafeUrl('https://LOCALHOST/path')).toThrow('Internal hostnames are not allowed');
    });

    it('throws for metadata.google.internal', () => {
      expect(() => assertSafeUrl('https://metadata.google.internal/path')).toThrow('Internal hostnames are not allowed');
    });

    it('throws for .internal TLD suffix', () => {
      expect(() => assertSafeUrl('https://myservice.internal/api')).toThrow('Internal hostnames are not allowed');
    });

    it('throws for .local TLD suffix', () => {
      expect(() => assertSafeUrl('https://myhost.local/api')).toThrow('Internal hostnames are not allowed');
    });
  });

  describe('Invalid URL rejection', () => {
    it('throws for non-URL string', () => {
      expect(() => assertSafeUrl('not-a-url')).toThrow('Invalid URL');
    });

    it('throws for empty string', () => {
      expect(() => assertSafeUrl('')).toThrow('Invalid URL');
    });

    it('throws for just a hostname without protocol', () => {
      expect(() => assertSafeUrl('example.com')).toThrow('Invalid URL');
    });
  });

  describe('Valid public HTTPS URLs (no throw)', () => {
    it('allows https://example.com/valid', () => {
      expect(() => assertSafeUrl('https://example.com/valid')).not.toThrow();
    });

    it('allows https://api.twitter.com/2/tweets', () => {
      expect(() => assertSafeUrl('https://api.twitter.com/2/tweets')).not.toThrow();
    });

    it('allows https://graph.facebook.com/v19.0/me', () => {
      expect(() => assertSafeUrl('https://graph.facebook.com/v19.0/me')).not.toThrow();
    });

    it('allows https://api.linkedin.com/v2/me', () => {
      expect(() => assertSafeUrl('https://api.linkedin.com/v2/me')).not.toThrow();
    });

    it('allows URL with query params', () => {
      expect(() => assertSafeUrl('https://cdn.example.com/image.jpg?w=800&h=600')).not.toThrow();
    });

    it('does NOT block 172.32.x.x (outside private range — starts at 172.16)', () => {
      // 172.32.x.x is public, only 172.16-172.31 is RFC 1918
      expect(() => assertSafeUrl('https://172.32.0.1/path')).not.toThrow();
    });

    it('does NOT block 11.x.x.x (not in 10.x private range)', () => {
      expect(() => assertSafeUrl('https://11.0.0.1/path')).not.toThrow();
    });
  });
});
