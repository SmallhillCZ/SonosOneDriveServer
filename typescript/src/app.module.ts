import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SonosController } from './controllers/sonos.controller';
import { StaticController } from './controllers/static.controller';
import { HealthController } from './controllers/health.controller';
import { OneDriveService } from './services/onedrive.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [SonosController, StaticController, HealthController],
  providers: [OneDriveService],
})
export class AppModule {}
