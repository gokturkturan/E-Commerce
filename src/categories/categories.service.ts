import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    await this.assertUnique(createCategoryDto);

    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  findAll(): Promise<Category[]> {
    return this.categoryRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category)
      throw new NotFoundException(`Category with id ${id} not found`);

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    await this.findOne(id);
    await this.assertUnique(updateCategoryDto, id);

    await this.categoryRepository.update(id, updateCategoryDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const productCount = await this.productRepository.count({
      where: { category: { id } },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Category still has ${productCount} product(s); move or delete them first`,
      );
    }

    await this.categoryRepository.delete(id);
  }

  /** Name and slug are unique columns; report clashes as 409 instead of a database error. */
  private async assertUnique(
    data: { name?: string; slug?: string },
    excludeId?: string,
  ) {
    const idFilter = excludeId ? { id: Not(excludeId) } : {};

    if (
      data.name &&
      (await this.categoryRepository.exists({
        where: { name: data.name, ...idFilter },
      }))
    ) {
      throw new ConflictException(`A category named "${data.name}" already exists`);
    }

    if (
      data.slug &&
      (await this.categoryRepository.exists({
        where: { slug: data.slug, ...idFilter },
      }))
    ) {
      throw new ConflictException(`The slug "${data.slug}" is already in use`);
    }
  }
}
