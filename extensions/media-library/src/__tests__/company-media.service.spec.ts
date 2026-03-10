/**
 * CompanyMediaService unit tests.
 *
 * Mocks: CompanyMediaRepository, sharp, uploadBufferToMinio
 * Key behaviors:
 *   - uploadAndRecord extracts metadata via sharp
 *   - Thumbnail is generated at 300x300 max, JPEG, aspect ratio preserved
 *   - Original and thumbnail uploaded to MinIO via uploadBufferToMinio
 *   - DB record created with all metadata
 *   - Returns MediaUploadResult with all fields populated
 */

// Mock sharp before imports
const mockMetadataFn = jest.fn();
const mockResizeFn = jest.fn();
const mockJpegFn = jest.fn();
const mockToBufferFn = jest.fn();

const sharpChain = {
  metadata: mockMetadataFn,
  resize: mockResizeFn,
  jpeg: mockJpegFn,
  toBuffer: mockToBufferFn,
};

// Chain methods return the same object for fluent API
mockResizeFn.mockReturnValue(sharpChain);
mockJpegFn.mockReturnValue(sharpChain);

const mockSharp = jest.fn().mockReturnValue(sharpChain);

jest.mock('sharp', () => mockSharp);

// Mock uploadBufferToMinio
const mockUploadBufferToMinio = jest.fn();
jest.mock('../storage/minio.storage', () => ({
  uploadBufferToMinio: mockUploadBufferToMinio,
}));

// Mock S3Client
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

import { CompanyMediaService } from '../media/company-media.service';
import { CompanyMediaRepository } from '../media/company-media.repository';

describe('CompanyMediaService', () => {
  let service: CompanyMediaService;
  let mockRepository: jest.Mocked<CompanyMediaRepository>;
  let mockS3Client: { send: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      createMedia: jest.fn(),
      findByCompany: jest.fn(),
      findById: jest.fn(),
      deleteMedia: jest.fn(),
      createProcessingJob: jest.fn(),
    } as any;

    // Reset sharp chain mocks
    mockResizeFn.mockReturnValue(sharpChain);
    mockJpegFn.mockReturnValue(sharpChain);
    mockSharp.mockReturnValue(sharpChain);

    mockS3Client = { send: jest.fn() };

    service = new CompanyMediaService(
      mockRepository,
      {
        endpoint: 'http://localhost:9000',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        bucket: 'postiz-media',
        publicUrl: 'http://localhost:9000/postiz-media',
      } as any
    );
  });

  describe('uploadAndRecord', () => {
    const fileBuffer = Buffer.from('fake-image-data');
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: fileBuffer,
      size: fileBuffer.length,
    } as any;

    beforeEach(() => {
      mockMetadataFn.mockResolvedValue({ width: 1200, height: 800, format: 'jpeg' });
      mockToBufferFn.mockResolvedValue(Buffer.from('thumb-data'));
      mockUploadBufferToMinio.mockResolvedValue(undefined);
      mockRepository.createMedia.mockResolvedValue({
        id: 'media-uuid',
        name: 'test.jpg',
        path: 'company-1/media-uuid/test.jpg',
        thumbnail: 'company-1/media-uuid/thumb_test.jpg',
        width: 1200,
        height: 800,
        format: 'jpeg',
        fileSize: fileBuffer.length,
        companyId: 'company-1',
        organizationId: 'org-1',
        tags: [],
      } as any);
    });

    it('should call sharp with the file buffer to extract metadata', async () => {
      await service.uploadAndRecord('company-1', 'org-1', mockFile, { tags: [], alt: '' });

      expect(mockSharp).toHaveBeenCalledWith(fileBuffer);
      expect(mockMetadataFn).toHaveBeenCalled();
    });

    it('should generate thumbnail at 300x300 max with inside fit', async () => {
      await service.uploadAndRecord('company-1', 'org-1', mockFile, { tags: [], alt: '' });

      expect(mockResizeFn).toHaveBeenCalledWith(300, 300, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      expect(mockJpegFn).toHaveBeenCalledWith({ quality: 80 });
      expect(mockToBufferFn).toHaveBeenCalled();
    });

    it('should upload original to MinIO with companyId/mediaId/filename path', async () => {
      await service.uploadAndRecord('company-1', 'org-1', mockFile, { tags: [], alt: '' });

      const uploadCalls = mockUploadBufferToMinio.mock.calls;
      // At least one upload for the original
      const originalUpload = uploadCalls.find((call: any[]) =>
        call[2] && call[2].includes('test.jpg') && !call[2].includes('thumb')
      );
      expect(originalUpload).toBeDefined();
      expect(originalUpload[2]).toMatch(/^company-1\//);
    });

    it('should upload thumbnail to MinIO with thumb_ prefix in path', async () => {
      await service.uploadAndRecord('company-1', 'org-1', mockFile, { tags: [], alt: '' });

      const uploadCalls = mockUploadBufferToMinio.mock.calls;
      const thumbnailUpload = uploadCalls.find((call: any[]) =>
        call[2] && call[2].includes('thumb_')
      );
      expect(thumbnailUpload).toBeDefined();
      expect(thumbnailUpload[2]).toMatch(/^company-1\//);
    });

    it('should create DB record with extracted metadata', async () => {
      await service.uploadAndRecord('company-1', 'org-1', mockFile, { tags: ['product'] });

      expect(mockRepository.createMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          organizationId: 'org-1',
          width: 1200,
          height: 800,
          format: 'jpeg',
          tags: ['product'],
        })
      );
    });

    it('should return MediaUploadResult with all fields populated', async () => {
      const result = await service.uploadAndRecord('company-1', 'org-1', mockFile, { tags: [], alt: '' });

      expect(result).toMatchObject({
        id: expect.any(String),
        path: expect.any(String),
        thumbnailPath: expect.any(String),
        width: 1200,
        height: 800,
        format: 'jpeg',
        fileSize: expect.any(Number),
      });
    });
  });

  describe('listMedia', () => {
    it('should delegate to repository with companyId and pagination', async () => {
      const expectedResult = { items: [], total: 0, page: 1, totalPages: 0 };
      mockRepository.findByCompany.mockResolvedValue(expectedResult as any);

      const result = await service.listMedia('company-1', { page: 1, limit: 20 });

      expect(mockRepository.findByCompany).toHaveBeenCalledWith('company-1', 1, 20, undefined);
      expect(result).toEqual(expectedResult);
    });

    it('should pass tag filter to repository when provided', async () => {
      mockRepository.findByCompany.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 } as any);

      await service.listMedia('company-1', { page: 1, limit: 20, tag: 'product' });

      expect(mockRepository.findByCompany).toHaveBeenCalledWith('company-1', 1, 20, 'product');
    });
  });

  describe('getMedia', () => {
    it('should delegate to repository.findById', async () => {
      const media = { id: 'media-1', variants: [] };
      mockRepository.findById.mockResolvedValue(media as any);

      const result = await service.getMedia('media-1');

      expect(mockRepository.findById).toHaveBeenCalledWith('media-1');
      expect(result).toEqual(media);
    });
  });

  describe('deleteMedia', () => {
    it('should delegate to repository.deleteMedia', async () => {
      mockRepository.deleteMedia.mockResolvedValue({ id: 'media-1' } as any);

      await service.deleteMedia('media-1');

      expect(mockRepository.deleteMedia).toHaveBeenCalledWith('media-1');
    });
  });

  describe('queueVariantGeneration', () => {
    it('should create a MediaProcessingJob via repository', async () => {
      const job = { id: 'job-1', status: 'pending' };
      mockRepository.createProcessingJob.mockResolvedValue(job as any);

      const result = await service.queueVariantGeneration('media-1', ['instagram', 'facebook']);

      expect(mockRepository.createProcessingJob).toHaveBeenCalledWith('media-1', ['instagram', 'facebook']);
      expect(result).toEqual(job);
    });
  });
});
