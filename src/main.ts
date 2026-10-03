import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    // Whitelist: body deki beklenmedik inputları siler, transform: gelen json'ı DTO objesine çevirir.
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  app.useGlobalInterceptors(
    // @Exclude() un çalışmasını sağlıyor
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  const configService = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        `amqp://${configService.get('RABBITMQ_USER')}:${configService.get('RABBITMQ_PASSWORD')}@localhost:5672`,
      ],

      queue: 'order_events_queue',
      queueOptions: { durable: false },
    },
  });

  await app.startAllMicroservices();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
