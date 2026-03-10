/**
 * MinioStorage provider tests.
 * Tests S3Client construction, upload, and delete operations.
 * Mocks @aws-sdk/client-s3 to avoid real network calls.
 */

// Track sent commands for assertions
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const original = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...original,
    S3Client: jest.fn().mockImplementation((config: Record<string, unknown>) => ({
      _config: config,
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((params: Record<string, unknown>) => ({
      _type: 'PutObjectCommand',
      ...params,
    })),
    DeleteObjectCommand: jest.fn().mockImplementation((params: Record<string, unknown>) => ({
      _type: 'DeleteObjectCommand',
      ...params,
    })),
    HeadBucketCommand: jest.fn().mockImplementation((params: Record<string, unknown>) => ({
      _type: 'HeadBucketCommand',
      ...params,
    })),
    CreateBucketCommand: jest.fn().mockImplementation((params: Record<string, unknown>) => ({
      _type: 'CreateBucketCommand',
      ...params,
    })),
  };
});

// Mock global fetch for uploadSimple tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MinioStorage, uploadBufferToMinio } from '../storage/minio.storage';

const ENDPOINT = 'http://localhost:9000';
const ACCESS_KEY = 'minioadmin';
const SECRET_KEY = 'minioadmin';
const BUCKET = 'postiz-media';
const PUBLIC_URL = 'http://localhost:9000/postiz-media';

describe('MinioStorage', () => {
  let storage: MinioStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    storage = new MinioStorage(ENDPOINT, ACCESS_KEY, SECRET_KEY, BUCKET, PUBLIC_URL);
  });

  describe('constructor', () => {
    it('creates S3Client with forcePathStyle: true (required for MinIO)', () => {
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          forcePathStyle: true,
        })
      );
    });

    it('creates S3Client with the provided endpoint', () => {
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: ENDPOINT,
        })
      );
    });

    it('creates S3Client with provided credentials', () => {
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: {
            accessKeyId: ACCESS_KEY,
            secretAccessKey: SECRET_KEY,
          },
        })
      );
    });
  });

  describe('uploadFile', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 12345,
      buffer: Buffer.from('fake-image-data'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('sends PutObjectCommand with correct Bucket and ContentType', async () => {
      await storage.uploadFile(mockFile);

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: BUCKET,
          ContentType: mockFile.mimetype,
          Body: mockFile.buffer,
        })
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('returns object with path containing publicUrl and generated key', async () => {
      const result = await storage.uploadFile(mockFile);

      expect(result).toHaveProperty('path');
      expect(result.path).toMatch(new RegExp(`^${PUBLIC_URL}/`));
      expect(result.path).toMatch(/\.jpe?g$/);
    });

    it('returns object with correct metadata fields', async () => {
      const result = await storage.uploadFile(mockFile);

      expect(result).toMatchObject({
        mimetype: mockFile.mimetype,
        size: mockFile.size,
        buffer: mockFile.buffer,
        fieldname: 'file',
        encoding: '7bit',
      });
    });
  });

  describe('uploadSimple', () => {
    it('fetches URL and uploads buffer to S3, returns public URL string', async () => {
      const imageBuffer = Buffer.from('fake-image-content');
      const contentType = 'image/png';

      mockFetch.mockResolvedValue({
        headers: {
          get: (header: string) =>
            header === 'content-type' ? contentType : null,
        },
        arrayBuffer: async () => imageBuffer.buffer,
      });

      const result = await storage.uploadSimple('http://example.com/image.png');

      expect(mockFetch).toHaveBeenCalledWith('http://example.com/image.png');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: BUCKET,
          ContentType: contentType,
          Body: expect.any(Buffer),
        })
      );
      expect(typeof result).toBe('string');
      expect(result).toMatch(new RegExp(`^${PUBLIC_URL}/`));
    });
  });

  describe('removeFile', () => {
    it('sends DeleteObjectCommand with key extracted from path', async () => {
      const key = 'abc123.jpg';
      const filePath = `${PUBLIC_URL}/${key}`;

      await storage.removeFile(filePath);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: BUCKET,
        Key: key,
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('handles paths with subdirectories correctly', async () => {
      const key = 'subdir/abc123.jpg';
      const filePath = `${PUBLIC_URL}/${key}`;

      await storage.removeFile(filePath);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: BUCKET,
        Key: key,
      });
    });
  });
});

describe('uploadBufferToMinio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it('sends PutObjectCommand with correct params and returns', async () => {
    const mockClient = { send: mockSend } as any;
    const buffer = Buffer.from('test-data');

    await uploadBufferToMinio(mockClient, 'my-bucket', 'test-key.png', buffer, 'image/png');

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'my-bucket',
      Key: 'test-key.png',
      Body: buffer,
      ContentType: 'image/png',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
