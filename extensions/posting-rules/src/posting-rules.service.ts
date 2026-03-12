/**
 * PostingRulesService
 *
 * Business logic for posting rule lifecycle management.
 *
 * Responsibilities:
 * - CRUD operations for posting rules (delegated to PostingRulesRepository)
 * - Validation of rule data before persistence
 * - Ownership enforcement: operations always verify companyId matches
 * - Toggling rules on/off (enable/disable)
 *
 * Services receive IDs only — slug resolution is done in the controller.
 *
 * Validation rules:
 * - name must be non-empty
 * - frequency must be >= 1 and <= 24 (max 24 posts per day)
 * - timeSlots must be non-empty and each slot must have valid hour (0-23) and minute (0-59)
 * - platformId must be non-empty
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PostingRulesRepository } from './posting-rules.repository';

export interface CreatePostingRuleDto {
  name: string;
  platformId: string;
  accountIds?: string[];
  frequency: number;
  timeSlots: { hour: number; minute: number }[];
  contentTypes?: string[];
  hashtags?: string[];
}

export interface UpdatePostingRuleDto extends Partial<CreatePostingRuleDto> {
  enabled?: boolean;
}

@Injectable()
export class PostingRulesService {
  constructor(private readonly repo: PostingRulesRepository) {}

  /**
   * Get all posting rules for a company.
   * Returns both enabled and disabled rules ordered by creation date descending.
   */
  getRules(companyId: string): Promise<any[]> {
    return this.repo.findByCompany(companyId);
  }

  /**
   * Create a new posting rule.
   *
   * Validates:
   * - name is non-empty
   * - platformId is non-empty
   * - frequency is an integer between 1 and 24
   * - timeSlots is non-empty array with valid hour/minute values
   *
   * @throws BadRequestException if any validation fails
   */
  async createRule(companyId: string, data: CreatePostingRuleDto): Promise<any> {
    this.validateRuleData(data);

    return this.repo.create({
      companyId,
      name: data.name.trim(),
      platformId: data.platformId,
      accountIds: data.accountIds ?? [],
      frequency: data.frequency,
      timeSlots: data.timeSlots,
      contentTypes: data.contentTypes ?? [],
      hashtags: data.hashtags ?? [],
    });
  }

  /**
   * Update an existing posting rule.
   *
   * Verifies the rule belongs to the given company before updating.
   * Validates any fields provided in the update DTO.
   *
   * @throws NotFoundException if the rule does not exist or belongs to a different company
   * @throws BadRequestException if any provided field fails validation
   */
  async updateRule(
    id: string,
    companyId: string,
    data: UpdatePostingRuleDto,
  ): Promise<any> {
    await this.assertRuleOwnership(id, companyId);
    this.validatePartialRuleData(data);

    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) updatePayload['name'] = data.name.trim();
    if (data.platformId !== undefined) updatePayload['platformId'] = data.platformId;
    if (data.accountIds !== undefined) updatePayload['accountIds'] = data.accountIds;
    if (data.frequency !== undefined) updatePayload['frequency'] = data.frequency;
    if (data.timeSlots !== undefined) updatePayload['timeSlots'] = data.timeSlots;
    if (data.contentTypes !== undefined) updatePayload['contentTypes'] = data.contentTypes;
    if (data.hashtags !== undefined) updatePayload['hashtags'] = data.hashtags;
    if (data.enabled !== undefined) updatePayload['enabled'] = data.enabled;

    return this.repo.update(id, updatePayload);
  }

  /**
   * Delete a posting rule.
   *
   * Verifies the rule belongs to the given company before deleting.
   *
   * @throws NotFoundException if the rule does not exist or belongs to a different company
   */
  async deleteRule(id: string, companyId: string): Promise<{ deleted: true; id: string }> {
    await this.assertRuleOwnership(id, companyId);
    await this.repo.delete(id);
    return { deleted: true, id };
  }

  /**
   * Enable or disable a posting rule.
   *
   * Verifies the rule belongs to the given company before updating.
   *
   * @throws NotFoundException if the rule does not exist or belongs to a different company
   */
  async toggleRule(id: string, companyId: string, enabled: boolean): Promise<any> {
    await this.assertRuleOwnership(id, companyId);
    return this.repo.update(id, { enabled });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Assert that a rule exists and belongs to the given company.
   *
   * @throws NotFoundException if the rule is not found or companyId does not match
   */
  private async assertRuleOwnership(id: string, companyId: string): Promise<any> {
    const rule = await this.repo.findById(id);
    if (!rule) {
      throw new NotFoundException(`Posting rule '${id}' not found`);
    }
    if (rule.companyId !== companyId) {
      // Return 404 rather than 403 to avoid leaking existence of other companies' rules
      throw new NotFoundException(`Posting rule '${id}' not found`);
    }
    return rule;
  }

  /**
   * Validate all required fields for rule creation.
   *
   * @throws BadRequestException if any field is invalid
   */
  private validateRuleData(data: CreatePostingRuleDto): void {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('name must be a non-empty string');
    }
    if (!data.platformId || !data.platformId.trim()) {
      throw new BadRequestException('platformId must be a non-empty string');
    }
    this.validateFrequency(data.frequency);
    this.validateTimeSlots(data.timeSlots);
  }

  /**
   * Validate only the fields that are present in a partial update DTO.
   *
   * @throws BadRequestException if any provided field is invalid
   */
  private validatePartialRuleData(data: UpdatePostingRuleDto): void {
    if (data.name !== undefined && (!data.name || !data.name.trim())) {
      throw new BadRequestException('name must be a non-empty string');
    }
    if (data.platformId !== undefined && (!data.platformId || !data.platformId.trim())) {
      throw new BadRequestException('platformId must be a non-empty string');
    }
    if (data.frequency !== undefined) {
      this.validateFrequency(data.frequency);
    }
    if (data.timeSlots !== undefined) {
      this.validateTimeSlots(data.timeSlots);
    }
    if (data.enabled !== undefined && typeof data.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be a boolean');
    }
  }

  /**
   * Validate frequency is an integer between 1 and 24.
   */
  private validateFrequency(frequency: number): void {
    if (!Number.isInteger(frequency) || frequency < 1 || frequency > 24) {
      throw new BadRequestException('frequency must be an integer between 1 and 24');
    }
  }

  /**
   * Validate timeSlots is non-empty and each slot has valid hour (0-23) and minute (0-59).
   */
  private validateTimeSlots(timeSlots: { hour: number; minute: number }[]): void {
    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      throw new BadRequestException('timeSlots must be a non-empty array');
    }
    for (const slot of timeSlots) {
      if (
        !Number.isInteger(slot.hour) ||
        slot.hour < 0 ||
        slot.hour > 23
      ) {
        throw new BadRequestException(
          `Invalid time slot: hour must be an integer between 0 and 23, got ${slot.hour}`,
        );
      }
      if (
        !Number.isInteger(slot.minute) ||
        slot.minute < 0 ||
        slot.minute > 59
      ) {
        throw new BadRequestException(
          `Invalid time slot: minute must be an integer between 0 and 59, got ${slot.minute}`,
        );
      }
    }
  }
}
