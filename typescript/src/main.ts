import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Get port from environment or use default
  const port = process.env.PORT || 3000;

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
