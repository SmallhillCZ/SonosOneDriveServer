import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { WSDL_PATH } from '../soap/sonos-soap.service';

@Controller()
export class StaticController {
  constructor(private readonly configService: ConfigService) {}

  @Get('/.well-known/microsoft-identity-association.json')
  microsoftIdentityAssociation() {
    return {
      associatedApplications: [{ applicationId: this.configService.get<string>('GRAPH_CLIENT_ID') }],
    };
  }

  @Get('/wsdl')
  wsdl(@Res() res: Response) {
    res.type('text/xml').sendFile(WSDL_PATH);
  }
}
