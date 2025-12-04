import { Controller, Post, Req, Res, Logger, Get } from '@nestjs/common';
import { Request, Response } from 'express';
import { OneDriveService } from '../services/onedrive.service';
import { GraphAuth } from '../models/graph-auth.model';
import { FileType } from '../models/item.model';
import { Constants } from '../config/constants';
import * as soap from 'soap';
import * as path from 'path';

@Controller()
export class SonosController {
  private readonly logger = new Logger(SonosController.name);
  private soapServer: any;

  constructor(private readonly oneDriveService: OneDriveService) {}

  @Post('/soap')
  async handleSoapRequest(@Req() req: Request, @Res() res: Response) {
    this.logger.debug('SOAP request received');
    
    if (!this.soapServer) {
      await this.initializeSoapServer();
    }

    this.soapServer.server.emit('request', req, res);
  }

  @Get('/wsdl')
  async getWsdl(@Res() res: Response) {
    const wsdlPath = path.join(__dirname, '../../resources/wsdl/Sonos.wsdl');
    res.sendFile(wsdlPath);
  }

  private async initializeSoapServer() {
    const wsdlPath = path.join(__dirname, '../../resources/wsdl/Sonos.wsdl');
    const services = this.getSoapServices();

    this.soapServer = await new Promise((resolve, reject) => {
      soap.listen(null, '/soap', services, wsdlPath, (err: any, server: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({ server });
        }
      });
    });
  }

  private getSoapServices() {
    return {
      SonosService: {
        SonosSoapPort: {
          getScrollIndices: async (args: any) => {
            this.logger.debug(`getScrollIndices id:${args.id}`);
            return null;
          },

          addToContainer: async (args: any) => {
            this.logger.debug('addToContainer');
            return null;
          },

          getExtendedMetadata: async (args: any) => {
            this.logger.debug(`getExtendedMetadata id:${args.id}`);
            return null;
          },

          reportPlaySeconds: async (args: any) => {
            this.logger.debug(`reportPlaySeconds id:${args.id} seconds:${args.seconds}`);
            return null;
          },

          reportStatus: async (args: any) => {
            this.logger.debug('reportStatus');
          },

          rateItem: async (args: any) => {
            this.logger.debug(`rateItem id:${args.id} rating:${args.rating}`);
            return null;
          },

          reportAccountAction: async (args: any) => {
            this.logger.debug('reportAccountAction');
          },

          getExtendedMetadataText: async (args: any) => {
            this.logger.debug(`getExtendedMetadataText id:${args.id}`);
            return null;
          },

          renameContainer: async (args: any) => {
            this.logger.debug('renameContainer');
            return null;
          },

          setPlayedSeconds: async (args: any) => {
            this.logger.debug(`setPlayedSeconds id:${args.id} sec:${args.seconds}`);
          },

          getLastUpdate: async (args: any, headers: any) => {
            this.logger.debug('getLastUpdate');
            const auth = this.getGraphAuthFromHeaders(headers);
            const lastUpdate = await this.oneDriveService.getLastUpdate(auth);
            return {
              catalog: lastUpdate,
            };
          },

          getDeviceLinkCode: async (args: any) => {
            this.logger.debug('getDeviceLinkCode');
            const isAppFolder = this.isAppFolder(args);
            return await this.oneDriveService.getDeviceLinkCode(args.householdId, isAppFolder);
          },

          deleteItem: async (args: any) => {
            this.logger.debug('deleteItem');
          },

          getDeviceAuthToken: async (args: any) => {
            this.logger.debug('getDeviceAuthToken');
            return await this.oneDriveService.getDeviceAuthToken(args.householdId, args.linkDeviceId);
          },

          createContainer: async (args: any) => {
            this.logger.debug('createContainer');
            return null;
          },

          reorderContainer: async (args: any) => {
            this.logger.debug('reorderContainer');
            return null;
          },

          getMediaURI: async (args: any, headers: any) => {
            this.logger.debug(`getMediaURI id:${args.id}`);
            const auth = this.getGraphAuthFromHeaders(headers);
            const itemId = args.id.replace(`${Constants.AUDIO}:`, '');
            const item = await this.oneDriveService.getItemById(itemId, auth);
            
            return {
              getMediaURIResult: item.getFileUri(),
            };
          },

          getMediaMetadata: async (args: any, headers: any) => {
            this.logger.debug(`getMediaMetadata id:${args.id}`);
            const auth = this.getGraphAuthFromHeaders(headers);
            const item = await this.oneDriveService.getItemById(args.id, auth);
            
            return {
              getMediaMetadataResult: this.buildMediaMetadata(item),
            };
          },

          getMetadata: async (args: any, headers: any) => {
            this.logger.debug(`getMetadata id:${args.id} count:${args.count} index:${args.index}`);
            const auth = this.getGraphAuthFromHeaders(headers);
            const isAppFolder = this.isAppFolder(args);

            if (args.id === 'search') {
              return {
                getMetadataResult: {
                  index: args.index,
                  count: 1,
                  total: 1,
                  mediaCollection: [
                    {
                      id: Constants.FILES,
                      title: 'Files',
                      itemType: 'search',
                      canPlay: false,
                    },
                  ],
                },
              };
            }

            const result = await this.oneDriveService.getMetadata(args.id, args.count, args.index, auth, isAppFolder);
            
            return {
              getMetadataResult: {
                index: args.index,
                count: result.count,
                total: result.total,
                mediaCollectionOrMediaMetadata: result.items,
              },
            };
          },

          getSessionId: async (args: any) => {
            this.logger.error('getSessionId (deprecated)');
            return null;
          },

          getContentKey: async (args: any) => {
            this.logger.debug('getContentKey');
            return null;
          },

          removeFromContainer: async (args: any) => {
            this.logger.debug('removeFromContainer');
            return null;
          },

          deleteContainer: async (args: any) => {
            this.logger.debug('deleteContainer');
            return null;
          },

          reportPlayStatus: async (args: any) => {
            this.logger.debug('reportPlayStatus');
          },

          createItem: async (args: any) => {
            this.logger.debug(`createItem favorite:${args.favorite}`);
            return null;
          },

          search: async (args: any, headers: any) => {
            this.logger.debug('search');
            const auth = this.getGraphAuthFromHeaders(headers);
            const result = await this.oneDriveService.searchFiles(args.term, args.count, args.index, auth);
            
            return {
              searchResult: {
                index: args.index,
                count: result.count,
                total: result.total,
                mediaList: result.items,
              },
            };
          },

          getAppLink: async (args: any) => {
            this.logger.debug('getAppLink');
            return null;
          },

          getUserInfo: async (args: any) => {
            this.logger.debug('getUserInfo');
            return null;
          },

          refreshAuthToken: async (args: any) => {
            this.logger.debug('refreshAuthToken');
            return null;
          },
        },
      },
    };
  }

  private getGraphAuthFromHeaders(headers: any): GraphAuth {
    if (!headers || !headers.credentials) {
      throw new Error(Constants.SESSION_INVALID);
    }

    const credentials = headers.credentials;
    const loginToken = credentials.loginToken;

    if (!loginToken) {
      throw new Error(Constants.SESSION_INVALID);
    }

    const accessToken = this.oneDriveService.decompressToken(loginToken.token);

    return new GraphAuth(
      loginToken.householdId,
      accessToken,
      loginToken.key
    );
  }

  private buildMediaMetadata(item: any): any {
    return {
      id: item.getId(),
      mimeType: this.getMimeType(item),
      itemType: 'track',
      displayType: 'audio',
      title: item.getTitle() || item.getName(),
      trackMetadata: {
        artist: item.getArtist(),
        album: item.getAlbum(),
        duration: item.getDuration(),
        albumArtURI: item.getThumbnail(),
        trackNumber: item.getTrack(),
      },
    };
  }

  private getMimeType(item: any): string {
    if (item.getType() === FileType.FILE && item.getName().endsWith('.flac')) {
      return 'audio/flac';
    }
    if (item.getMimeType()?.endsWith('wma')) {
      return 'audio/wma';
    }
    return item.getMimeType();
  }

  private isAppFolder(args: any): boolean {
    // Determine if app folder from request context
    // The context would typically be available from the SOAP headers or request URL
    // This matches the Java implementation which checks the request URL for 'soap_appfolder'
    return false;
  }
}
