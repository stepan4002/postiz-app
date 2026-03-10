/**
 * MediaProcessingService unit tests.
 *
 * Tests sharp-based variant generation and the full generateVariants pipeline.
 * Mocks: sharp, @aws-sdk/client-s3, PrismaService, uploadBufferToMinio
 */

// ---- Mock sharp ----
const mockToBufferFn = jest.fn();
const mockJpegFn = jest.fn();
const mockResizeFn = jest.fn();

const sharpChain = {
  resize: mockResizeFn,
  jpeg: mockJpegFn,
  toBuffer: mockToBufferFn,
};

mockResizeFn.mockReturnValue(sharpChain);
mockJpegFn.mockReturnValue(sharpChain);

const mockSharp = jest.fn().mockReturnValue(sharpChain);
jest.mock('sharp', () => mockSharp);

// ---- Mock @aws-sdk/client-s3 ----
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

// ---- Mock uploadBufferToMinio ----
const mockUploadBufferToMinio = jest.fn();
jest.mock('../storage/minio.storage', () => ({
  uploadBufferToMinio: mockUploadBufferToMinio,
}));

import { MediaProcessingService } from '../processing/media-processing.service';

describe('MediaProcessingService', () => {
  let service: MediaProcessingService;
  let mockPrisma: any;

  const minioConfig = {
    endpoint: 'http://localhost:9000',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    bucket: 'postiz-media',
    publicUrl: 'http://localhost:9000/postiz-media',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      media: {
        findUnique: jest.fn(),
      },
      mediaVariant: {
        create: jest.fn(),
      },
    };

    // Reset sharp chain
    mockResizeFn.mockReturnValue(sharpChain);
    mockJpegFn.mockReturnValue(sharpChain);
    mockSharp.mockReturnValue(sharpChain);

    service = new MediaProcessingService(mockPrisma, minioConfig);
  });

  describe('generateVariant', () => {
    it('should call sharp with source buffer and resize to exact dimensions with cover fit', async () => {
      const sourceBuffer = Buffer.from('fake-image');
      const variantBuffer = Buffer.from('resized-image');
      mockToBufferFn.mockResolvedValue(variantBuffer);

      const spec = { platform: 'instagram', width: 1080, height: 1080 };
      const result = await service.generateVariant(sourceBuffer, spec);

      expect(mockSharp).toHaveBeenCalledWith(sourceBuffer);
      expect(mockResizeFn).toHaveBeenCalledWith(1080, 1080, { fit: 'cover', position: 'centre' });
      expect(mockJpegFn).toHaveBeenCalledWith({ quality: 85 });
      expect(mockToBufferFn).toHaveBeenCalled();
      expect(result.buffer).toBe(variantBuffer);
    });

    it('should return VariantResult with correct dimensions and format', async () => {
      const variantBuffer = Buffer.from('resized-image-data');
      mockToBufferFn.mockResolvedValue(variantBuffer);

      const spec = { platform: 'facebook', width: 1200, height: 630 };
      const result = await service.generateVariant(Buffer.from('img'), spec);

      expect(result.width).toBe(1200);
      expect(result.height).toBe(630);
      expect(result.format).toBe('jpeg');
      expect(result.fileSize).toBe(variantBuffer.length);
    });

    it('should throw a descriptive error when sharp fails on corrupt data', async () => {
      mockToBufferFn.mockRejectedValue(new Error('Input buffer contains unsupported image format'));

      const spec = { platform: 'instagram', width: 1080, height: 1080 };

      await expect(service.generateVariant(Buffer.from('corrupt'), spec)).rejects.toThrow(
        /failed to generate variant/i
      );
    });
  });

  describe('generateVariants', () => {
    const mediaRecord = {
      id: 'media-1',
      path: 'company-abc/media-1/photo.jpg',
      companyId: 'company-abc',
    };

    beforeEach(() => {
      mockPrisma.media.findUnique.mockResolvedValue(mediaRecord);

      // Simulate MinIO GetObject returning a stream-like body
      const fakeBody = {
        transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('original-image'))),
      };
      mockSend.mockResolvedValue({ Body: fakeBody });

      // Sharp returns a variant buffer
      const variantBuffer = Buffer.from('variant-data');
      mockToBufferFn.mockResolvedValue(variantBuffer);

      mockUploadBufferToMinio.mockResolvedValue(undefined);
      mockPrisma.mediaVariant.create.mockResolvedValue({ id: 'variant-1' });
    });

    it('should load the media record from DB', async () => {
      await service.generateVariants('media-1', ['facebook']);

      expect(mockPrisma.media.findUnique).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        select: { id: true, path: true, companyId: true },
      });
    });

    it('should download the original file from MinIO', async () => {
      await service.generateVariants('media-1', ['facebook']);

      expect(mockSend).toHaveBeenCalled();
    });

    it('should generate correct number of variants per platform', async () => {
      // Facebook has 1 variant spec (1200x630)
      await service.generateVariants('media-1', ['facebook']);

      // One upload call for the one Facebook variant
      expect(mockUploadBufferToMinio).toHaveBeenCalledTimes(1);
    });

    it('should upload variants to correct MinIO paths', async () => {
      await service.generateVariants('media-1', ['facebook']);

      const uploadCall = mockUploadBufferToMinio.mock.calls[0];
      // key param: {companyId}/{mediaId}/variants/{platform}_{w}x{h}.jpg
      const key = uploadCall[2] as string;
      expect(key).toBe('company-abc/media-1/variants/facebook_1200x630.jpg');
    });

    it('should create MediaVariant DB records for each variant', async () => {
      await service.generateVariants('media-1', ['facebook']);

      expect(mockPrisma.mediaVariant.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.mediaVariant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mediaId: 'media-1',
          platform: 'facebook',
          width: 1200,
          height: 630,
          path: 'company-abc/media-1/variants/facebook_1200x630.jpg',
        }),
      });
    });

    it('should generate 3 Instagram variants (square, portrait, landscape)', async () => {
      await service.generateVariants('media-1', ['instagram']);

      // Instagram has 3 variant specs
      expect(mockUploadBufferToMinio).toHaveBeenCalledTimes(3);
      expect(mockPrisma.mediaVariant.create).toHaveBeenCalledTimes(3);
    });

    it('should process multiple platforms in a single call', async () => {
      await service.generateVariants('media-1', ['facebook', 'linkedin']);

      // Facebook: 1, LinkedIn: 1 => total 2
      expect(mockUploadBufferToMinio).toHaveBeenCalledTimes(2);
      expect(mockPrisma.mediaVariant.create).toHaveBeenCalledTimes(2);
    });
  });
});
