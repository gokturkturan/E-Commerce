import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getOrCreateCart(userId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
      relations: { items: { product: { category: true } } },
    });

    if (cart) {
      return cart;
    }

    const newCart = this.cartRepository.create({
      user: { id: userId } as User,
      items: [],
    });
    return this.cartRepository.save(newCart);
  }

  async addItem(userId: string, dto: AddItemDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);

    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${dto.productId} not found`);
    }

    const existingItem = cart.items.find(
      (item) => item.product.id === dto.productId,
    );

    if (existingItem) {
      const { quantity, ...rest } = dto;
      existingItem.quantity = quantity + existingItem.quantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      const newItem = this.cartItemRepository.create({
        cart: cart,
        product: product,
        quantity: dto.quantity,
      });
      await this.cartItemRepository.save(newItem);
    }

    return this.getOrCreateCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateItemDto,
  ): Promise<Cart> {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: { cart: { user: true } },
    });

    if (!item || item.cart.user.id !== userId) {
      throw new NotFoundException(`Item with id ${itemId} not found`);
    }

    item.quantity = dto.quantity;
    await this.cartItemRepository.save(item);
    return this.getOrCreateCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: { cart: { user: true } },
    });

    if (!item || item.cart.user.id !== userId) {
      throw new NotFoundException(`Item with id ${itemId} not found`);
    }

    await this.cartItemRepository.delete(itemId);
    return this.getOrCreateCart(userId);
  }

  async clear(userId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemRepository.delete({ cart: { id: cart.id } });
    return this.getOrCreateCart(userId);
  }
}
