import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { DataSource, Repository } from 'typeorm';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';
import { User } from '../users/entities/user.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cartService: CartService,
    @Inject('ORDER_EVENTS_SERVICE')
    private readonly orderEventsClient: ClientProxy,
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

      this.orderEventsClient.emit('order_created', {
        orderId: savedOrder.id,
        userId,
        total: savedOrder.total,
      });

      return savedOrder;
    });
  }

  async findAllForUser(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { user: { id: userId } },
      relations: { items: { product: { category: true } } },
    });
  }

  findAllAdmin() {
    return this.ordersRepository.find({
      relations: { items: { product: true }, user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForUser(userId: string, orderId: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { items: { product: true }, user: true },
    });

    if (!order || order.user.id !== userId) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    return order;
  }

  async pay(userId: string, orderId: string) {
    const order = await this.findOneForUser(userId, orderId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot pay for an order with status ${order.status}`,
      );
    }

    order.status = OrderStatus.PAID;
    const savedOrder = await this.ordersRepository.save(order);

    this.orderEventsClient.emit('order_paid', {
      orderId: savedOrder.id,
      userId,
      total: savedOrder.total,
    });

    return savedOrder;
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.findOneForUser(userId, orderId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel an order with status ${order.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      for (const item of order.items) {
        await manager.increment(
          Product,
          { id: item.product.id },
          'stock',
          item.quantity,
        );
      }

      order.status = OrderStatus.CANCELLED;
      const savedOrder = await manager.save(order);

      this.orderEventsClient.emit('order_cancelled', {
        orderId: savedOrder.id,
        userId,
        total: savedOrder.total,
      });

      return savedOrder;
    });
  }

  async findOneOrFail(orderId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    return order;
  }

  async ship(orderId: string) {
    const order = await this.findOneOrFail(orderId);

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        `Cannot ship an order with status ${order.status}`,
      );
    }

    order.status = OrderStatus.SHIPPED;
    const savedOrder = await this.ordersRepository.save(order);

    this.orderEventsClient.emit('order_shipped', {
      orderId: savedOrder.id,
      userId: order.user.id,
      total: savedOrder.total,
    });

    return savedOrder;
  }
}
