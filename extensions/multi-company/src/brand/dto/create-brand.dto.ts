import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * DTO for creating a new Brand within a Company.
 * name and slug are required; logo and description are optional.
 */
export class CreateBrandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /**
   * URL-friendly identifier — lowercase letters, numbers, and hyphens only.
   * Must be unique within the company.
   * Example: "verde-main", "nexus-main"
   */
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens (e.g. my-brand)',
  })
  slug: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
