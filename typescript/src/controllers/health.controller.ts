import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Sonos OneDrive Server',
      version: '1.0.0',
    };
  }

  @Get('/')
  root() {
    return {
      name: 'Sonos OneDrive Server',
      version: '1.0.0',
      description: 'TypeScript/NestJS implementation of Sonos OneDrive integration',
      endpoints: {
        health: '/health',
        soap: '/soap',
        wsdl: '/wsdl',
      },
    };
  }
}
