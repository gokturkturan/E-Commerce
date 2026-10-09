import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddItemDto } from './dto/add-item.dto';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCart(user.userId);
  }

  @Post('items')
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() addItemDto: AddItemDto,
  ) {
    return this.cartService.addItem(user.userId, addItemDto);
  }

  @Patch('items/:id')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') itemId: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.cartService.updateItem(user.userId, itemId, updateItemDto);
  }

  @Delete('items/:id')
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') itemId: string,
  ) {
    return this.cartService.removeItem(user.userId, itemId);
  }

  @Delete()
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.clear(user.userId);
  }
}
