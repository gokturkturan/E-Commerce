import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  const mockCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should delegate to the service', () => {
    const dto = { name: 'Electronics', slug: 'electronics' };
    controller.create(dto);
    expect(mockCategoriesService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll should delegate to the service', () => {
    controller.findAll();
    expect(mockCategoriesService.findAll).toHaveBeenCalled();
  });

  it('findOne should delegate to the service with the id', () => {
    controller.findOne('1');
    expect(mockCategoriesService.findOne).toHaveBeenCalledWith('1');
  });

  it('update should delegate to the service with id and dto', () => {
    const dto = { name: 'Updated' };
    controller.update('1', dto);
    expect(mockCategoriesService.update).toHaveBeenCalledWith('1', dto);
  });

  it('remove should delegate to the service with the id', () => {
    controller.remove('1');
    expect(mockCategoriesService.remove).toHaveBeenCalledWith('1');
  });
});
