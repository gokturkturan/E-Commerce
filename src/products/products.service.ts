import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { DeepPartial, Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { FindProductsDto } from './dto/find-products.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const category = await this.categoryRepository.findOne({
      where: { id: createProductDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const product = this.productRepository.create({
      ...createProductDto,
      category,
    });

    return this.productRepository.save(product);
  }

  findAll(query: FindProductsDto): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (query.search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR category.name ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    if (query.categoryId) {
      queryBuilder.andWhere('category.id = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', {
        minPrice: query.minPrice,
      });
    }

    if (query.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }

    if (query.inStock) {
      queryBuilder.andWhere('product.stock > 0');
    }

    switch (query.sort) {
      case 'price-asc':
        queryBuilder.orderBy('product.price', 'ASC');
        break;
      case 'price-desc':
        queryBuilder.orderBy('product.price', 'DESC');
        break;
      case 'name':
        queryBuilder.orderBy('product.name', 'ASC');
        break;
      default:
        queryBuilder.orderBy('product.createdAt', 'DESC');
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: id },
      relations: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { categoryId, ...rest } = updateProductDto;

    const updateData: DeepPartial<Product> = { id, ...rest };

    if (categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Category with id ${categoryId} not found`);
      }

      updateData.category = category;
    }

    const product = await this.productRepository.preload(updateData);

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return this.productRepository.save(product);
  }

  remove(id: string) {
    return this.productRepository.delete(id);
  }
}
