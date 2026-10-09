import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockCategoryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  const mockProductRepository = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new category', async () => {
      const dto = { name: 'Electronics', slug: 'electronics' };
      const created = { ...dto };
      const saved = { id: '1', ...dto };

      mockCategoryRepository.exists.mockResolvedValue(false);
      mockCategoryRepository.create.mockReturnValue(created);
      mockCategoryRepository.save.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(mockCategoryRepository.create).toHaveBeenCalledWith(dto);
      expect(mockCategoryRepository.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(saved);
    });

    it('should throw ConflictException when the name or slug is taken', async () => {
      mockCategoryRepository.exists.mockResolvedValueOnce(true);

      await expect(
        service.create({ name: 'Electronics', slug: 'electronics' }),
      ).rejects.toThrow(ConflictException);
      expect(mockCategoryRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the category when found', async () => {
      const category = { id: '1', name: 'Electronics', slug: 'electronics' };
      mockCategoryRepository.findOne.mockResolvedValue(category);

      const result = await service.findOne('1');

      expect(result).toEqual(category);
    });

    it('should throw NotFoundException when the category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update the category and return the fresh value', async () => {
      const updated = { id: '1', name: 'Updated', slug: 'updated' };
      mockCategoryRepository.exists.mockResolvedValue(false);
      mockCategoryRepository.update.mockResolvedValue({ affected: 1 });
      mockCategoryRepository.findOne.mockResolvedValue(updated);

      const result = await service.update('1', { name: 'Updated' });

      expect(mockCategoryRepository.update).toHaveBeenCalledWith('1', {
        name: 'Updated',
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if the category no longer exists', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('1', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockCategoryRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when another category uses the slug', async () => {
      mockCategoryRepository.findOne.mockResolvedValue({ id: '1' });
      mockCategoryRepository.exists.mockResolvedValue(true);

      await expect(
        service.update('1', { slug: 'books' }),
      ).rejects.toThrow(ConflictException);
      expect(mockCategoryRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete an empty category', async () => {
      mockCategoryRepository.findOne.mockResolvedValue({ id: '1' });
      mockProductRepository.count.mockResolvedValue(0);

      await service.remove('1');

      expect(mockCategoryRepository.delete).toHaveBeenCalledWith('1');
    });

    it('should refuse to delete a category that still has products', async () => {
      mockCategoryRepository.findOne.mockResolvedValue({ id: '1' });
      mockProductRepository.count.mockResolvedValue(3);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
      expect(mockCategoryRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the category does not exist', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});
