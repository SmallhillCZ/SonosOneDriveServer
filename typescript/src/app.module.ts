import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SonosController } from './controllers/sonos.controller';
import { OneDriveService } from './services/onedrive.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [SonosController],
  providers: [OneDriveService],
})
export class AppModule {}
