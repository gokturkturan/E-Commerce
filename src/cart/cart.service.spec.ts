import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { PricingService } from '../pricing/pricing.service';

describe('CartService', () => {
  let service: CartService;

  const mockCartRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockCartItemRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockProductRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Cart), useValue: mockCartRepository },
        {
          provide: getRepositoryToken(CartItem),
          useValue: mockCartItemRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: PricingService,
          useValue: new PricingService({
            get: (_key: string, fallback?: string) => fallback,
          } as unknown as ConfigService),
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateCart', () => {
    it('should return the existing cart when found', async () => {
      const cart = { id: 'cart-1', items: [] };
      mockCartRepository.findOne.mockResolvedValue(cart);

      const result = await service.getOrCreateCart('user-1');

      expect(result).toEqual(cart);
      expect(mockCartRepository.create).not.toHaveBeenCalled();
    });

    it('should create a new cart when none exists yet', async () => {
      const created = { user: { id: 'user-1' } };
      const saved = { id: 'cart-1', items: [], ...created };

      mockCartRepository.findOne.mockResolvedValue(null);
      mockCartRepository.create.mockReturnValue(created);
      mockCartRepository.save.mockResolvedValue(saved);

      const result = await service.getOrCreateCart('user-1');

      expect(mockCartRepository.create).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        items: [],
      });
      expect(result).toEqual(saved);
    });
  });

  describe('addItem', () => {
    const product = {
      id: 'prod-1',
      name: 'Headphones',
      price: 299.9,
      stock: 10,
    };

    it('should throw NotFoundException when the product does not exist', async () => {
      mockCartRepository.findOne.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addItem('user-1', { productId: 'prod-1', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should increase the quantity when the product is already in the cart', async () => {
      const existingItem = { id: 'item-1', product, quantity: 2 };
      const cart = { id: 'cart-1', items: [existingItem] };

      mockCartRepository.findOne.mockResolvedValue(cart);
      mockProductRepository.findOne.mockResolvedValue(product);

      await service.addItem('user-1', { productId: 'prod-1', quantity: 3 });

      expect(mockCartItemRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 5 }),
      );
      expect(mockCartItemRepository.create).not.toHaveBeenCalled();
    });

    it('should create a new item when the product is not yet in the cart', async () => {
      const cart = { id: 'cart-1', items: [] };
      const newItem = { cart, product, quantity: 2 };

      mockCartRepository.findOne.mockResolvedValue(cart);
      mockProductRepository.findOne.mockResolvedValue(product);
      mockCartItemRepository.create.mockReturnValue(newItem);

      await service.addItem('user-1', { productId: 'prod-1', quantity: 2 });

      expect(mockCartItemRepository.create).toHaveBeenCalledWith({
        cart,
        product,
        quantity: 2,
      });
      expect(mockCartItemRepository.save).toHaveBeenCalledWith(newItem);
    });
  });

  describe('addItem stock rules', () => {
    it('should reject a product that is out of stock', async () => {
      mockCartRepository.findOne.mockResolvedValue({ id: 'cart-1', items: [] });
      mockProductRepository.findOne.mockResolvedValue({
        id: 'prod-1',
        name: 'Headphones',
        price: 299.9,
        stock: 0,
      });

      await expect(
        service.addItem('user-1', { productId: 'prod-1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockCartItemRepository.save).not.toHaveBeenCalled();
    });

    it('should reject a quantity that, with what is already in the cart, exceeds the stock', async () => {
      const product = { id: 'prod-1', name: 'Headphones', price: 10, stock: 5 };
      mockCartRepository.findOne.mockResolvedValue({
        id: 'cart-1',
        items: [{ id: 'item-1', product, quantity: 4 }],
      });
      mockProductRepository.findOne.mockResolvedValue(product);

      await expect(
        service.addItem('user-1', { productId: 'prod-1', quantity: 2 }),
      ).rejects.toThrow('Only 5 of Headphones in stock');
      expect(mockCartItemRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getCart', () => {
    it('should attach a price summary with shipping to the cart', async () => {
      mockCartRepository.findOne.mockResolvedValue({
        id: 'cart-1',
        items: [
          { id: 'item-1', quantity: 2, product: { price: 12.5 } },
          { id: 'item-2', quantity: 1, product: { price: 5 } },
        ],
      });

      const result = await service.getCart('user-1');

      expect(result.summary).toEqual({
        subtotal: 30,
        shippingFee: 4.99,
        total: 34.99,
        freeShippingThreshold: 50,
      });
    });
  });

  describe('updateItem', () => {
    it('should throw NotFoundException when the item does not exist', async () => {
      mockCartItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateItem('user-1', 'item-1', { quantity: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the item belongs to another user', async () => {
      mockCartItemRepository.findOne.mockResolvedValue({
        id: 'item-1',
        cart: { user: { id: 'someone-else' } },
      });

      await expect(
        service.updateItem('user-1', 'item-1', { quantity: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update the quantity of an owned item', async () => {
      const item = {
        id: 'item-1',
        quantity: 2,
        product: { id: 'prod-1', name: 'Headphones', price: 299.9, stock: 10 },
        cart: { id: 'cart-1', user: { id: 'user-1' } },
      };
      mockCartItemRepository.findOne.mockResolvedValue(item);
      mockCartRepository.findOne.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });

      await service.updateItem('user-1', 'item-1', { quantity: 7 });

      expect(mockCartItemRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 7 }),
      );
    });
  });

  describe('updateItem stock rules', () => {
    it('should reject a quantity above the available stock', async () => {
      mockCartItemRepository.findOne.mockResolvedValue({
        id: 'item-1',
        quantity: 1,
        product: { id: 'prod-1', name: 'Headphones', price: 10, stock: 3 },
        cart: { id: 'cart-1', user: { id: 'user-1' } },
      });

      await expect(
        service.updateItem('user-1', 'item-1', { quantity: 4 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockCartItemRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('should throw NotFoundException when the item belongs to another user', async () => {
      mockCartItemRepository.findOne.mockResolvedValue({
        id: 'item-1',
        cart: { user: { id: 'someone-else' } },
      });

      await expect(service.removeItem('user-1', 'item-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockCartItemRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete an owned item', async () => {
      const item = {
        id: 'item-1',
        cart: { id: 'cart-1', user: { id: 'user-1' } },
      };
      mockCartItemRepository.findOne.mockResolvedValue(item);
      mockCartRepository.findOne.mockResolvedValue({
        id: 'cart-1',
        items: [],
      });

      await service.removeItem('user-1', 'item-1');

      expect(mockCartItemRepository.delete).toHaveBeenCalledWith('item-1');
    });
  });
});
