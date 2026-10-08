import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartModule } from '../cart/cart.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { OrderEventsController } from './order-events.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product]),
    CartModule,
    NotificationsModule,
    ClientsModule.registerAsync([
      {
        name: 'ORDER_EVENTS_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              `amqp://${config.get('RABBITMQ_USER')}:${config.get('RABBITMQ_PASSWORD')}@localhost:5672`,
            ],
            queue: 'order_events_queue',
            queueOptions: { durable: false },
          },
        }),
      },
    ]),
  ],
  controllers: [OrdersController, OrderEventsController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
