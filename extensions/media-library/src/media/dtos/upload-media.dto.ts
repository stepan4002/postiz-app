import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * DTO for media upload request body.
 * File itself is handled by FileInterceptor + @UploadedFile() decorator.
 */
export class UploadMediaDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @IsOptional()
  @IsString()
  alt?: string;
}
