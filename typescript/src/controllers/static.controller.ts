import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller()
export class StaticController {
  constructor(private configService: ConfigService) {}

  @Get('/.well-known/microsoft-identity-association.json')
  getMicrosoftIdentityAssociation(@Res() res: Response) {
    const clientId = this.configService.get<string>('GRAPH_CLIENT_ID');
    
    res.json({
      associatedApplications: [
        {
          applicationId: clientId,
        },
      ],
    });
  }

  @Get('/static/presentationMap.xml')
  getPresentationMap(@Res() res: Response) {
    res.sendFile('presentationMap.xml', { root: './public/static' });
  }

  @Get('/static/strings.xml')
  getStrings(@Res() res: Response) {
    res.sendFile('strings.xml', { root: './public/static' });
  }

  @Get('/static/rating_star_on.png')
  getRatingStarOn(@Res() res: Response) {
    res.sendFile('rating_star_on.png', { root: './public/static' });
  }

  @Get('/static/rating_star_off.png')
  getRatingStarOff(@Res() res: Response) {
    res.sendFile('rating_star_off.png', { root: './public/static' });
  }
}
