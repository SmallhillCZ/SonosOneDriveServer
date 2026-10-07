import { Controller, Get } from '@nestjs/common';
import { SOAP_APPFOLDER_PATH, SOAP_PATH } from '../config/constants';

@Controller()
export class HealthController {
  @Get('/health')
  health() {
    return { status: 'ok' };
  }

  @Get('/')
  root() {
    return {
      name: 'Sonos OneDrive Server',
      endpoints: {
        soap: SOAP_PATH,
        soapAppFolder: SOAP_APPFOLDER_PATH,
        wsdl: '/wsdl',
        health: '/health',
      },
    };
  }
}
