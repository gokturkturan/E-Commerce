import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class FindProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  inStock?: boolean;

  @IsOptional()
  @IsIn(['newest', 'price-asc', 'price-desc', 'name'])
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'name';
}
