import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('CartController', () => {
  let controller: CartController;

  const mockCartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
  };

  const user: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@test.com',
    role: 'customer',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        {
          provide: CartService,
          useValue: mockCartService,
        },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getCart should delegate to the service with the current user id', () => {
    controller.getCart(user);
    expect(mockCartService.getCart).toHaveBeenCalledWith('user-1');
  });

  it('addItem should delegate to the service', () => {
    const dto = { productId: 'prod-1', quantity: 2 };
    controller.addItem(user, dto);
    expect(mockCartService.addItem).toHaveBeenCalledWith('user-1', dto);
  });

  it('updateItem should delegate to the service', () => {
    const dto = { quantity: 5 };
    controller.updateItem(user, 'item-1', dto);
    expect(mockCartService.updateItem).toHaveBeenCalledWith(
      'user-1',
      'item-1',
      dto,
    );
  });

  it('removeItem should delegate to the service', () => {
    controller.removeItem(user, 'item-1');
    expect(mockCartService.removeItem).toHaveBeenCalledWith(
      'user-1',
      'item-1',
    );
  });
});
