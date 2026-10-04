import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockOrdersRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockCartService = {
    getOrCreateCart: jest.fn(),
  };

  const mockClientProxy = {
    emit: jest.fn(),
  };

  // The transaction callback receives this fake EntityManager instead of a
  // real one connected to Postgres.
  const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const mockManager = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    increment: jest.fn(),
  };

  // Instead of really opening a transaction, just run the callback with our
  // fake manager and return whatever it returns/throws.
  const mockDataSource = {
    transaction: jest.fn((callback: (manager: unknown) => unknown) =>
      callback(mockManager),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrdersRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: CartService,
          useValue: mockCartService,
        },
        {
          provide: 'ORDER_EVENTS_SERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException when the cart is empty', async () => {
      mockCartService.getOrCreateCart.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });

      await expect(service.create('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      const cart = {
        id: 'cart-1',
        items: [
          {
            product: { id: 'prod-1', name: 'Headphones', price: 299.9 },
            quantity: 2,
          },
        ],
      };
      mockCartService.getOrCreateCart.mockResolvedValue(cart);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });

      await expect(service.create('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create the order, clear the cart and emit an event on success', async () => {
      const cart = {
        id: 'cart-1',
        items: [
          {
            product: { id: 'prod-1', name: 'Headphones', price: 299.9 },
            quantity: 2,
          },
        ],
      };
      const createdOrder = { total: 599.8 };
      const savedOrder = { id: 'order-1', total: 599.8 };

      mockCartService.getOrCreateCart.mockResolvedValue(cart);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });
      mockManager.create.mockReturnValue(createdOrder);
      mockManager.save.mockResolvedValue(savedOrder);

      const result = await service.create('user-1');

      expect(mockManager.delete).toHaveBeenCalledWith(CartItem, {
        cart: { id: 'cart-1' },
      });
      expect(mockClientProxy.emit).toHaveBeenCalledWith('order_created', {
        orderId: 'order-1',
        userId: 'user-1',
        total: 599.8,
      });
      expect(result).toEqual(savedOrder);
    });
  });

  describe('findOneForUser', () => {
    it('should return the order when it belongs to the user', async () => {
      const order = { id: 'order-1', user: { id: 'user-1' } };
      mockOrdersRepository.findOne.mockResolvedValue(order);

      const result = await service.findOneForUser('user-1', 'order-1');

      expect(result).toEqual(order);
    });

    it('should throw NotFoundException when the order belongs to another user', async () => {
      mockOrdersRepository.findOne.mockResolvedValue({
        id: 'order-1',
        user: { id: 'someone-else' },
      });

      await expect(
        service.findOneForUser('user-1', 'order-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the order does not exist', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForUser('user-1', 'order-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('pay', () => {
    it('should throw BadRequestException when the order is not pending', async () => {
      mockOrdersRepository.findOne.mockResolvedValue({
        id: 'order-1',
        user: { id: 'user-1' },
        status: OrderStatus.PAID,
      });

      await expect(service.pay('user-1', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark a pending order as paid', async () => {
      const order = {
        id: 'order-1',
        user: { id: 'user-1' },
        status: OrderStatus.PENDING,
      };
      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockOrdersRepository.save.mockImplementation((o) => Promise.resolve(o));

      const result = await service.pay('user-1', 'order-1');

      expect(result.status).toBe(OrderStatus.PAID);
    });
  });

  describe('cancel', () => {
    it('should throw BadRequestException when the order is not pending', async () => {
      mockOrdersRepository.findOne.mockResolvedValue({
        id: 'order-1',
        user: { id: 'user-1' },
        status: OrderStatus.SHIPPED,
      });

      await expect(service.cancel('user-1', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should restock the items and cancel a pending order', async () => {
      const order = {
        id: 'order-1',
        user: { id: 'user-1' },
        status: OrderStatus.PENDING,
        items: [{ product: { id: 'prod-1' }, quantity: 2 }],
      };
      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockManager.save.mockImplementation((o) => Promise.resolve(o));

      const result = await service.cancel('user-1', 'order-1');

      expect(mockManager.increment).toHaveBeenCalledWith(
        Product,
        { id: 'prod-1' },
        'stock',
        2,
      );
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('findOneOrFail', () => {
    it('should return the order when it exists', async () => {
      const order = { id: 'order-1' };
      mockOrdersRepository.findOne.mockResolvedValue(order);

      const result = await service.findOneOrFail('order-1');

      expect(result).toEqual(order);
    });

    it('should throw NotFoundException when the order does not exist', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneOrFail('order-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ship', () => {
    it('should throw BadRequestException when the order is not paid', async () => {
      mockOrdersRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });

      await expect(service.ship('order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark a paid order as shipped', async () => {
      const order = { id: 'order-1', status: OrderStatus.PAID };
      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockOrdersRepository.save.mockImplementation((o) => Promise.resolve(o));

      const result = await service.ship('order-1');

      expect(result.status).toBe(OrderStatus.SHIPPED);
    });
  });
});
