import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controllers/health.controller';
import { StaticController } from './controllers/static.controller';
import { OneDriveService } from './services/onedrive.service';
import { SonosSoapService } from './soap/sonos-soap.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [StaticController, HealthController],
  providers: [OneDriveService, SonosSoapService],
})
export class AppModule {}
