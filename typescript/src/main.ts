import { Logger } from '@nestjs/common';
import { createApp } from './app.factory';

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Listening on port ${port}`);
}

bootstrap();
