import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

interface OrderEventPayload {
  orderId: string;
  userId: string;
  total: number;
}

@Controller()
export class OrderEventsController {
  private readonly logger = new Logger(OrderEventsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @EventPattern('order_created')
  handleOrderCreated(@Payload() data: OrderEventPayload) {
    return this.notify(
      data,
      NotificationType.ORDER_CREATED,
      `Your order #${data.orderId} has been placed.`,
    );
  }

  @EventPattern('order_paid')
  handleOrderPaid(@Payload() data: OrderEventPayload) {
    return this.notify(
      data,
      NotificationType.ORDER_PAID,
      `Your payment for order #${data.orderId} was received.`,
    );
  }

  @EventPattern('order_shipped')
  handleOrderShipped(@Payload() data: OrderEventPayload) {
    return this.notify(
      data,
      NotificationType.ORDER_SHIPPED,
      `Your order #${data.orderId} has shipped.`,
    );
  }

  @EventPattern('order_cancelled')
  handleOrderCancelled(@Payload() data: OrderEventPayload) {
    return this.notify(
      data,
      NotificationType.ORDER_CANCELLED,
      `Your order #${data.orderId} was cancelled.`,
    );
  }

  private async notify(
    data: OrderEventPayload,
    type: NotificationType,
    message: string,
  ) {
    this.logger.log(
      `📦 ${type} — order: ${data.orderId}, user: ${data.userId}, total: ${data.total}`,
    );

    await this.notificationsService.create({
      userId: data.userId,
      orderId: data.orderId,
      type,
      message,
    });
  }
}
