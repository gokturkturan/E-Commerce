import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { DataSource, Repository } from 'typeorm';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';
import { User } from '../users/entities/user.entity';
import { CartItem } from '../cart/entities/cart-item.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cartService: CartService,
  ) {}

  async create(userId: string): Promise<Order> {
    const cart = await this.cartService.getOrCreateCart(userId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    return this.dataSource.transaction(async (manager) => {
      let total = 0;
      const orderItemsData: Partial<OrderItem>[] = [];

      for (const cartItem of cart.items) {
        const result = await manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => 'stock - :qty' })
          .where('id = :id AND stock >= :qty', {
            id: cartItem.product.id,
            qty: cartItem.quantity,
          })
          .execute();

        if (result.affected === 0) {
          throw new BadRequestException(
            `Insufficient stock for ${cartItem.product.name}`,
          );
        }

        total += cartItem.product.price * cartItem.quantity;
        orderItemsData.push({
          product: cartItem.product,
          productName: cartItem.product.name,
          unitPrice: cartItem.product.price,
          quantity: cartItem.quantity,
        });
      }

      const order = manager.create(Order, {
        user: { id: userId } as User,
        total,
        items: orderItemsData as OrderItem[],
      });

      const savedOrder = await manager.save(order);
      await manager.delete(CartItem, { cart: { id: cart.id } });

      return savedOrder;
    });
  }

  async findAllForUser(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { user: { id: userId } },
      relations: { items: true },
    });
  }

  async findOneForUser(userId: string, orderId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { items: true, user: true },
    });

    if (!order || order.user.id !== userId) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    return order;
  }
}
