import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockCategoryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepository,
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

      mockCategoryRepository.create.mockReturnValue(created);
      mockCategoryRepository.save.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(mockCategoryRepository.create).toHaveBeenCalledWith(dto);
      expect(mockCategoryRepository.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(saved);
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
      mockCategoryRepository.update.mockResolvedValue({ affected: 1 });
      mockCategoryRepository.findOne.mockResolvedValue(updated);

      const result = await service.update('1', { name: 'Updated' });

      expect(mockCategoryRepository.update).toHaveBeenCalledWith('1', {
        name: 'Updated',
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if the category no longer exists', async () => {
      mockCategoryRepository.update.mockResolvedValue({ affected: 0 });
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('1', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete the category by id', () => {
      service.remove('1');

      expect(mockCategoryRepository.delete).toHaveBeenCalledWith('1');
    });
  });
});
