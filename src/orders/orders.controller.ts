import { Controller, Get, Post, Param, UseGuards, Patch } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.create(user.userId);
  }

  @Get()
  findAllForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findAllForUser(user.userId);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllAdmin() {
    return this.ordersService.findAllAdmin();
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOneForUser(user.userId, id);
  }

  @Post(':id/pay')
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string) {
    return this.ordersService.pay(user.userId, orderId);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') orderId: string) {
    return this.ordersService.cancel(user.userId, orderId);
  }

  @Patch(':id/ship')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  ship(@Param('id') orderId: string) {
    return this.ordersService.ship(orderId);
  }
}
