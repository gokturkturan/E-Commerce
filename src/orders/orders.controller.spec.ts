import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    create: jest.fn(),
    findAllForUser: jest.fn(),
    findOneForUser: jest.fn(),
    pay: jest.fn(),
    cancel: jest.fn(),
    ship: jest.fn(),
  };

  const user: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@test.com',
    role: 'customer',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should delegate to the service with the current user id', () => {
    const shippingAddress = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@test.com',
      phone: '555-0100',
      address: '1 Main St',
      city: 'Springfield',
      district: 'IL',
    };

    controller.create(user, { shippingAddress });

    expect(mockOrdersService.create).toHaveBeenCalledWith(
      'user-1',
      shippingAddress,
    );
  });

  it('findAllForUser should delegate to the service with the current user id', () => {
    controller.findAllForUser(user);
    expect(mockOrdersService.findAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('findOne should delegate to the service with the user id and order id', () => {
    controller.findOne(user, 'order-1');
    expect(mockOrdersService.findOneForUser).toHaveBeenCalledWith(
      'user-1',
      'order-1',
    );
  });

  it('pay should delegate to the service', () => {
    controller.pay(user, 'order-1');
    expect(mockOrdersService.pay).toHaveBeenCalledWith('user-1', 'order-1');
  });

  it('cancel should delegate to the service', () => {
    controller.cancel(user, 'order-1');
    expect(mockOrdersService.cancel).toHaveBeenCalledWith(
      'user-1',
      'order-1',
    );
  });

  it('ship should delegate to the service with just the order id', () => {
    controller.ship('order-1');
    expect(mockOrdersService.ship).toHaveBeenCalledWith('order-1');
  });
});
