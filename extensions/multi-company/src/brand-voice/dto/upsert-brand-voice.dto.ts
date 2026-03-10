import {
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

/**
 * DTO for upserting a BrandVoice for a Brand.
 * This is an upsert operation — it creates or replaces the brand voice entirely.
 * tone is required and must contain at least one value.
 * All array fields default to empty if not provided.
 */
export class UpsertBrandVoiceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tone: string[];

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredHashtags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blacklistedWords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  samplePosts?: string[];

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
