import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartModule } from '../cart/cart.module';
import { CartService } from '../cart/cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product]), CartService],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
