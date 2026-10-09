import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProductRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    delete: jest.fn(),
  };

  const mockCategoryRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      name: 'Headphones',
      description: 'Wireless',
      price: 299.9,
      stock: 10,
      categoryId: 'cat-1',
    };

    it('should throw NotFoundException when the category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(mockProductRepository.create).not.toHaveBeenCalled();
    });

    it('should create the product with the resolved category', async () => {
      const category = { id: 'cat-1', name: 'Electronics' };
      const created = { ...dto, category };
      const saved = { id: 'p1', ...created };

      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockProductRepository.create.mockReturnValue(created);
      mockProductRepository.save.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(mockProductRepository.create).toHaveBeenCalledWith({
        ...dto,
        category,
      });
      expect(result).toEqual(saved);
    });
  });

  describe('findOne', () => {
    it('should return the product when found', async () => {
      const product = { id: 'p1', name: 'Headphones' };
      mockProductRepository.findOne.mockResolvedValue(product);

      const result = await service.findOne('p1');

      expect(result).toEqual(product);
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('p1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when the new category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('p1', { categoryId: 'missing-cat' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockProductRepository.preload).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductRepository.preload.mockResolvedValue(undefined);

      await expect(
        service.update('p1', { name: 'New name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update the product without touching the category when categoryId is omitted', async () => {
      const preloaded = { id: 'p1', name: 'New name' };
      const saved = { ...preloaded };

      mockProductRepository.preload.mockResolvedValue(preloaded);
      mockProductRepository.save.mockResolvedValue(saved);

      const result = await service.update('p1', { name: 'New name' });

      expect(mockCategoryRepository.findOne).not.toHaveBeenCalled();
      expect(mockProductRepository.preload).toHaveBeenCalledWith({
        id: 'p1',
        name: 'New name',
      });
      expect(result).toEqual(saved);
    });
  });

  describe('remove', () => {
    it('should delete the product by id', async () => {
      mockProductRepository.findOne.mockResolvedValue({ id: 'p1' });

      await service.remove('p1');

      expect(mockProductRepository.delete).toHaveBeenCalledWith('p1');
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('p1')).rejects.toThrow(NotFoundException);
      expect(mockProductRepository.delete).not.toHaveBeenCalled();
    });
  });
});
