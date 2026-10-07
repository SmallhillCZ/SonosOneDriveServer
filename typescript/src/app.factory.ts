import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { SonosSoapService } from './soap/sonos-soap.service';

export const PUBLIC_DIR = join(__dirname, '..', 'public');

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useStaticAssets(PUBLIC_DIR);
  await app.get(SonosSoapService).mount(app.getHttpAdapter().getInstance());
  await app.init();
  return app;
}
