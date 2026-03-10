/**
 * ScheduleResolverService unit tests.
 *
 * Tests scheduling behaviors:
 * - Timezone conversion to UTC before storing
 * - Setting SCHEDULED status on all variants
 * - publishWindowExpiresAt calculation
 * - State transition validation
 * - Parent ContentPost status update
 * - Auto-slot next available window
 * - Auto-slot skips occupied windows
 * - Re-scheduling (idempotent — updates time for already-SCHEDULED post)
 * - cancelSchedule transitions back to APPROVED
 *
 * Mocks: SchedulingRepository, dayjs
 */

import { ScheduleResolverService } from '../scheduling/schedule-resolver.service';
import { SchedulingRepository } from '../scheduling/scheduling.repository';

// dayjs is used with require() in the service (CJS interop)
// No special mock needed — we use jest fake timers to control "now"

describe('ScheduleResolverService', () => {
  let service: ScheduleResolverService;
  let mockRepo: jest.Mocked<SchedulingRepository>;

  const mockApprovedPost = {
    id: 'post-1',
    status: 'APPROVED',
    companyId: 'company-1',
    scheduledAt: null,
    variants: [
      { id: 'variant-1', status: 'APPROVED', platformPostId: null, scheduledAt: null, publishWindowExpiresAt: null },
      { id: 'variant-2', status: 'APPROVED', platformPostId: null, scheduledAt: null, publishWindowExpiresAt: null },
    ],
  };

  const mockScheduledPost = {
    id: 'post-2',
    status: 'SCHEDULED',
    companyId: 'company-1',
    scheduledAt: new Date('2026-03-11T10:00:00Z'),
    variants: [
      { id: 'variant-3', status: 'SCHEDULED', platformPostId: null, scheduledAt: new Date('2026-03-11T10:00:00Z'), publishWindowExpiresAt: new Date('2026-03-11T14:00:00Z') },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepo = {
      findPostWithVariants: jest.fn(),
      updateVariantSchedule: jest.fn(),
      updatePostSchedule: jest.fn(),
      findDueVariants: jest.fn(),
      markVariantPublishing: jest.fn(),
      markVariantStale: jest.fn(),
      findScheduledPostsForCompany: jest.fn(),
      findCompanyTimezone: jest.fn(),
      findCompanyPostingTimes: jest.fn(),
    } as any;

    service = new ScheduleResolverService(mockRepo);
  });

  describe('Test 1: schedulePost converts company timezone to UTC before storing', () => {
    it('should convert scheduledAt from given timezone to UTC', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(mockApprovedPost as any);
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockApprovedPost as any);

      // The service interprets the Date's UTC getters as the "wall clock time" in the given TZ.
      // So new Date('2026-03-11T09:00:00Z') -> UTC getters: year=2026, month=3, day=11, hour=9, min=0
      // Interpreted as 09:00 in Asia/Kolkata (UTC+5:30) -> stored as 03:30 UTC
      const localTime = new Date('2026-03-11T09:00:00Z'); // UTC explicitly — getUTCHours() = 9
      const tz = 'Asia/Kolkata'; // UTC+5:30 always (no DST)

      await service.schedulePost('post-1', localTime, tz);

      // updateVariantSchedule should be called with UTC-converted time
      expect(mockRepo.updateVariantSchedule).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          scheduledAt: expect.any(Date),
        })
      );

      // 9:00 AM IST (UTC+5:30) = 03:30 UTC
      const callArgs = (mockRepo.updateVariantSchedule as jest.Mock).mock.calls[0][1];
      const storedTime = callArgs.scheduledAt as Date;
      expect(storedTime.getUTCHours()).toBe(3);
      expect(storedTime.getUTCMinutes()).toBe(30);
    });
  });

  describe('Test 2: schedulePost sets all variants to SCHEDULED status with scheduledAt', () => {
    it('should update all APPROVED variants to SCHEDULED with scheduledAt', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(mockApprovedPost as any);
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockApprovedPost as any);
      mockRepo.findCompanyTimezone.mockResolvedValue('UTC');

      const scheduledAt = new Date('2026-03-11T14:00:00Z');
      await service.schedulePost('post-1', scheduledAt, 'UTC');

      // Called for each variant
      expect(mockRepo.updateVariantSchedule).toHaveBeenCalledTimes(2);
      expect(mockRepo.updateVariantSchedule).toHaveBeenCalledWith('variant-1', expect.objectContaining({
        status: 'SCHEDULED',
        scheduledAt: expect.any(Date),
      }));
      expect(mockRepo.updateVariantSchedule).toHaveBeenCalledWith('variant-2', expect.objectContaining({
        status: 'SCHEDULED',
        scheduledAt: expect.any(Date),
      }));
    });
  });

  describe('Test 3: schedulePost sets publishWindowExpiresAt = scheduledAt + windowHours', () => {
    it('should set publishWindowExpiresAt to scheduledAt + 4 hours by default', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(mockApprovedPost as any);
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockApprovedPost as any);
      mockRepo.findCompanyTimezone.mockResolvedValue('UTC');

      const scheduledAt = new Date('2026-03-11T14:00:00Z');
      await service.schedulePost('post-1', scheduledAt, 'UTC');

      const callArgs = (mockRepo.updateVariantSchedule as jest.Mock).mock.calls[0][1];
      const expiresAt = callArgs.publishWindowExpiresAt as Date;

      // 14:00 UTC + 4 hours = 18:00 UTC
      expect(expiresAt.getUTCHours()).toBe(18);
    });

    it('should respect custom windowHours', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(mockApprovedPost as any);
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockApprovedPost as any);
      mockRepo.findCompanyTimezone.mockResolvedValue('UTC');

      const scheduledAt = new Date('2026-03-11T14:00:00Z');
      await service.schedulePost('post-1', scheduledAt, 'UTC', 2);

      const callArgs = (mockRepo.updateVariantSchedule as jest.Mock).mock.calls[0][1];
      const expiresAt = callArgs.publishWindowExpiresAt as Date;

      // 14:00 UTC + 2 hours = 16:00 UTC
      expect(expiresAt.getUTCHours()).toBe(16);
    });
  });

  describe('Test 4: schedulePost throws if post is not in APPROVED status', () => {
    it('should throw if post status is DRAFT', async () => {
      const draftPost = { ...mockApprovedPost, status: 'DRAFT' };
      mockRepo.findPostWithVariants.mockResolvedValue(draftPost as any);

      const scheduledAt = new Date('2026-03-11T14:00:00Z');
      await expect(service.schedulePost('post-1', scheduledAt)).rejects.toThrow(
        /Cannot schedule post with status DRAFT/
      );
    });

    it('should throw if post status is PUBLISHED', async () => {
      const publishedPost = { ...mockApprovedPost, status: 'PUBLISHED' };
      mockRepo.findPostWithVariants.mockResolvedValue(publishedPost as any);

      await expect(service.schedulePost('post-1', new Date())).rejects.toThrow(
        /Cannot schedule post with status PUBLISHED/
      );
    });

    it('should throw if post not found', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(null);

      await expect(service.schedulePost('non-existent', new Date())).rejects.toThrow(
        /Post.*not found/
      );
    });
  });

  describe('Test 5: schedulePost sets parent ContentPost status to SCHEDULED and scheduledAt', () => {
    it('should update parent ContentPost to SCHEDULED with scheduledAt', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(mockApprovedPost as any);
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockApprovedPost as any);
      mockRepo.findCompanyTimezone.mockResolvedValue('UTC');

      const scheduledAt = new Date('2026-03-11T14:00:00Z');
      await service.schedulePost('post-1', scheduledAt, 'UTC');

      expect(mockRepo.updatePostSchedule).toHaveBeenCalledWith('post-1', expect.objectContaining({
        status: 'SCHEDULED',
        scheduledAt: expect.any(Date),
      }));
    });
  });

  describe('Test 6: autoSlot finds next available window from company preferred posting times', () => {
    it('should schedule post at next available preferred posting window', async () => {
      // Current time is just past midnight UTC on 2026-03-11
      const now = new Date('2026-03-11T00:30:00Z');
      jest.useFakeTimers().setSystemTime(now);

      mockRepo.findPostWithVariants.mockResolvedValue(mockApprovedPost as any);
      mockRepo.findCompanyTimezone.mockResolvedValue('UTC');
      mockRepo.findCompanyPostingTimes.mockResolvedValue([9, 12, 17]); // 9am, 12pm, 5pm
      mockRepo.findScheduledPostsForCompany.mockResolvedValue([]); // no conflicts
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockApprovedPost as any);

      await service.autoSlot('post-1');

      // Should pick 9:00 UTC (first slot after now + 1hr minimum = 01:30 UTC)
      const updateCall = (mockRepo.updatePostSchedule as jest.Mock).mock.calls[0][1];
      const scheduledAt = updateCall.scheduledAt as Date;
      expect(scheduledAt.getUTCHours()).toBe(9);
      expect(scheduledAt.getUTCMinutes()).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Test 7: autoSlot skips windows that already have a scheduled post', () => {
    it('should skip occupied slots and pick the next available one', async () => {
      // Current time is 8:00 UTC
      const now = new Date('2026-03-11T08:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      // 9:00 slot is occupied
      const occupiedSlot = new Date('2026-03-11T09:00:00Z');

      mockRepo.findPostWithVariants.mockResolvedValue(mockApprovedPost as any);
      mockRepo.findCompanyTimezone.mockResolvedValue('UTC');
      mockRepo.findCompanyPostingTimes.mockResolvedValue([9, 12, 17]);
      mockRepo.findScheduledPostsForCompany
        .mockResolvedValueOnce([{ scheduledAt: occupiedSlot }]) // 9am slot occupied
        .mockResolvedValueOnce([]); // 12pm slot free
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockApprovedPost as any);

      await service.autoSlot('post-1');

      // Should pick 12:00 UTC (second slot, since 9:00 was occupied)
      const updateCall = (mockRepo.updatePostSchedule as jest.Mock).mock.calls[0][1];
      const scheduledAt = updateCall.scheduledAt as Date;
      expect(scheduledAt.getUTCHours()).toBe(12);

      jest.useRealTimers();
    });
  });

  describe('Test 8: schedulePost is idempotent — re-scheduling an already-SCHEDULED post updates time', () => {
    it('should allow re-scheduling an already-SCHEDULED post and update time', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(mockScheduledPost as any);
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockScheduledPost as any);
      mockRepo.findCompanyTimezone.mockResolvedValue('UTC');

      // Pass explicit UTC timezone to skip conversion (already-UTC datetime)
      const newTime = new Date('2026-03-12T14:00:00Z');
      // Should not throw for SCHEDULED -> SCHEDULED (reschedule case)
      await expect(service.schedulePost('post-2', newTime, 'UTC')).resolves.not.toThrow();

      expect(mockRepo.updateVariantSchedule).toHaveBeenCalledWith(
        'variant-3',
        expect.objectContaining({
          scheduledAt: newTime,
        })
      );
    });
  });

  describe('Test 9: cancelSchedule transitions post back to APPROVED, clears scheduledAt', () => {
    it('should cancel scheduling and revert to APPROVED with null scheduledAt', async () => {
      mockRepo.findPostWithVariants.mockResolvedValue(mockScheduledPost as any);
      mockRepo.updateVariantSchedule.mockResolvedValue({} as any);
      mockRepo.updatePostSchedule.mockResolvedValue(mockScheduledPost as any);

      await service.cancelSchedule('post-2');

      // All SCHEDULED variants should go back to APPROVED
      expect(mockRepo.updateVariantSchedule).toHaveBeenCalledWith('variant-3', {
        status: 'APPROVED',
        scheduledAt: null,
        publishWindowExpiresAt: null,
      });

      // Parent post should go back to APPROVED with cleared scheduledAt
      expect(mockRepo.updatePostSchedule).toHaveBeenCalledWith('post-2', {
        status: 'APPROVED',
        scheduledAt: null,
      });
    });

    it('should throw if trying to cancel a non-SCHEDULED post', async () => {
      const draftPost = { ...mockApprovedPost, status: 'DRAFT' };
      mockRepo.findPostWithVariants.mockResolvedValue(draftPost as any);

      await expect(service.cancelSchedule('post-1')).rejects.toThrow(
        /Cannot cancel scheduling of a post with status DRAFT/
      );
    });
  });
});
