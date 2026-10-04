import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should delegate to the service', () => {
    const dto = {
      name: 'Headphones',
      description: 'Wireless',
      price: 299.9,
      stock: 10,
      categoryId: 'cat-1',
    };
    controller.create(dto);
    expect(mockProductsService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll should delegate to the service', () => {
    controller.findAll();
    expect(mockProductsService.findAll).toHaveBeenCalled();
  });

  it('findOne should delegate to the service with the id', () => {
    controller.findOne('p1');
    expect(mockProductsService.findOne).toHaveBeenCalledWith('p1');
  });

  it('update should delegate to the service with id and dto', () => {
    const dto = { name: 'New name' };
    controller.update('p1', dto);
    expect(mockProductsService.update).toHaveBeenCalledWith('p1', dto);
  });

  it('remove should delegate to the service with the id', () => {
    controller.remove('p1');
    expect(mockProductsService.remove).toHaveBeenCalledWith('p1');
  });
});
