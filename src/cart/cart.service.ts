import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PriceSummary, PricingService } from '../pricing/pricing.service';

/** The cart as returned by the API: its items plus a server-side price summary. */
export type CartView = Cart & { summary: PriceSummary };

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly pricingService: PricingService,
  ) {}

  async getOrCreateCart(userId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
      relations: { items: { product: { category: true } } },
      order: { items: { createdAt: 'ASC' } },
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

  async getCart(userId: string): Promise<CartView> {
    return this.withSummary(await this.getOrCreateCart(userId));
  }

  async addItem(userId: string, dto: AddItemDto): Promise<CartView> {
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
    const newQuantity = dto.quantity + (existingItem?.quantity ?? 0);
    this.assertInStock(product, newQuantity);

    if (existingItem) {
      existingItem.quantity = newQuantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      const newItem = this.cartItemRepository.create({
        cart: cart,
        product: product,
        quantity: dto.quantity,
      });
      await this.cartItemRepository.save(newItem);
    }

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateItemDto,
  ): Promise<CartView> {
    const item = await this.findOwnedItem(userId, itemId);
    this.assertInStock(item.product, dto.quantity);

    item.quantity = dto.quantity;
    await this.cartItemRepository.save(item);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    await this.findOwnedItem(userId, itemId);

    await this.cartItemRepository.delete(itemId);
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemRepository.delete({ cart: { id: cart.id } });
    return this.getCart(userId);
  }

  private async findOwnedItem(userId: string, itemId: string) {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: { cart: { user: true }, product: true },
    });

    if (!item || item.cart.user.id !== userId) {
      throw new NotFoundException(`Item with id ${itemId} not found`);
    }

    return item;
  }

  /** The storefront caps quantities at the available stock; enforce the same rule here. */
  private assertInStock(product: Product, quantity: number) {
    if (product.stock <= 0) {
      throw new BadRequestException(`${product.name} is out of stock`);
    }
    if (quantity > product.stock) {
      throw new BadRequestException(
        `Only ${product.stock} of ${product.name} in stock`,
      );
    }
  }

  private withSummary(cart: Cart): CartView {
    const subtotal = (cart.items ?? []).reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    return Object.assign(cart, {
      summary: this.pricingService.summarize(subtotal),
    });
  }
}
