/**
 * Health controller unit tests — Phase 8 Plan 01
 * Tests /health/live and /health/ready endpoints.
 * All 3 indicators are mocked — no real DB, Redis, or MinIO connections.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HealthCheckResult, HealthCheckError } from '@nestjs/terminus';
import { HealthController } from '../health.controller';
import { DatabaseHealthIndicator } from '../indicators/database.indicator';
import { RedisHealthIndicator } from '../indicators/redis.indicator';
import { MinioHealthIndicator } from '../indicators/minio.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let dbIndicator: jest.Mocked<DatabaseHealthIndicator>;
  let redisIndicator: jest.Mocked<RedisHealthIndicator>;
  let minioIndicator: jest.Mocked<MinioHealthIndicator>;

  beforeEach(async () => {
    const mockHealthCheckService: Partial<jest.Mocked<HealthCheckService>> = {
      check: jest.fn(),
    };
    const mockDbIndicator: Partial<jest.Mocked<DatabaseHealthIndicator>> = {
      isHealthy: jest.fn(),
    };
    const mockRedisIndicator: Partial<jest.Mocked<RedisHealthIndicator>> = {
      isHealthy: jest.fn(),
    };
    const mockMinioIndicator: Partial<jest.Mocked<MinioHealthIndicator>> = {
      isHealthy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: DatabaseHealthIndicator, useValue: mockDbIndicator },
        { provide: RedisHealthIndicator, useValue: mockRedisIndicator },
        { provide: MinioHealthIndicator, useValue: mockMinioIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get(HealthCheckService);
    dbIndicator = module.get(DatabaseHealthIndicator);
    redisIndicator = module.get(RedisHealthIndicator);
    minioIndicator = module.get(MinioHealthIndicator);
  });

  describe('GET /health/live', () => {
    it('should return status ok with a timestamp', () => {
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      // Validate timestamp is a valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('GET /health/ready', () => {
    it('should return composite health status when all indicators are healthy', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          minio: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          minio: { status: 'up' },
        },
      };

      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.readiness();

      expect(result.status).toBe('ok');
      expect(result.info).toBeDefined();
      expect(result.info?.database?.status).toBe('up');
      expect(result.info?.redis?.status).toBe('up');
      expect(result.info?.minio?.status).toBe('up');
      // Verify check was called with 3 indicator functions
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should propagate HealthCheckError when an indicator fails', async () => {
      const errorResult: HealthCheckResult = {
        status: 'error',
        info: {
          redis: { status: 'up' },
          minio: { status: 'up' },
        },
        error: {
          database: { status: 'down', message: 'Connection refused' },
        },
        details: {
          database: { status: 'down', message: 'Connection refused' },
          redis: { status: 'up' },
          minio: { status: 'up' },
        },
      };

      const healthCheckError = new HealthCheckError('DB check failed', errorResult);
      healthCheckService.check.mockRejectedValue(healthCheckError);

      await expect(controller.readiness()).rejects.toThrow(HealthCheckError);
    });

    it('should call all 3 health indicators in check', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };

      healthCheckService.check.mockResolvedValue(mockResult);
      dbIndicator.isHealthy.mockResolvedValue({ database: { status: 'up' } });
      redisIndicator.isHealthy.mockResolvedValue({ redis: { status: 'up' } });
      minioIndicator.isHealthy.mockResolvedValue({ minio: { status: 'up' } });

      await controller.readiness();

      // Get the check calls and invoke the indicator functions to verify they call the right methods
      const checkCalls = healthCheckService.check.mock.calls;
      expect(checkCalls).toHaveLength(1);
      const checkFns = checkCalls[0][0] as Array<() => Promise<unknown>>;
      expect(checkFns).toHaveLength(3);

      // Call each function to verify it invokes the right indicator
      await checkFns[0]();
      await checkFns[1]();
      await checkFns[2]();

      expect(dbIndicator.isHealthy).toHaveBeenCalledWith('database');
      expect(redisIndicator.isHealthy).toHaveBeenCalledWith('redis');
      expect(minioIndicator.isHealthy).toHaveBeenCalledWith('minio');
    });
  });
});
