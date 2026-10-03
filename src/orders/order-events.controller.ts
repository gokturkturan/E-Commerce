import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class OrderEventsController {
  private readonly logger = new Logger(OrderEventsController.name);

  @EventPattern('order_created')
  handleOrderCreated(
    @Payload() data: { orderId: string; userId: string; total: number },
  ) {
    this.logger.log(
      `📦 New order received! Order: ${data.orderId}, User:${data.userId}, Total: ${data.total}`,
    );
  }
}
