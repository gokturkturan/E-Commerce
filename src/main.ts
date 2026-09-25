import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes( // Whitelist: body deki beklenmedik inputları siler, transform: gelen json'ı DTO objesine çevirir.
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalInterceptors( // @Exclude() un çalışmasını sağlıyor
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
