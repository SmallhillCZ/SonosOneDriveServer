import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { GraphAuth } from '../models/graph-auth.model';
import { Item, FileType } from '../models/item.model';
import { Constants } from '../config/constants';

@Injectable()
export class OneDriveService {
  private readonly logger = new Logger(OneDriveService.name);
  private readonly graphApiUri: string;
  private readonly authApiUri: string;
  private readonly clientId: string;
  private readonly axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.graphApiUri = this.configService.get<string>('GRAPH_API_URI', Constants.GRAPH_API_URI_DEFAULT);
    this.authApiUri = this.configService.get<string>('AUTH_API_URI', Constants.AUTH_API_URI_DEFAULT);
    this.clientId = this.configService.get<string>('GRAPH_CLIENT_ID');
    
    this.axiosInstance = axios.create({
      baseURL: this.graphApiUri,
    });
  }

  async getDeviceLinkCode(householdId: string, isAppFolder: boolean): Promise<any> {
    this.logger.debug('getDeviceLinkCode');

    const scope = isAppFolder
      ? 'user.read Files.ReadWrite.AppFolder offline_access'
      : 'user.read files.read offline_access';

    try {
      const response = await axios.post(
        `${this.authApiUri}devicecode`,
        new URLSearchParams({
          client_id: this.clientId,
          scope: scope,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.logger.log(`${householdId.hashCode()}: Got verification uri`);

      return {
        linkCode: response.data.user_code,
        regUrl: response.data.verification_uri,
        linkDeviceId: response.data.device_code,
        showLinkCode: true,
      };
    } catch (error) {
      this.logger.error('Error getting device link code', error.response?.data);
      throw error;
    }
  }

  async getDeviceAuthToken(householdId: string, linkDeviceId: string): Promise<any> {
    this.logger.debug('getDeviceAuthToken');

    try {
      const response = await axios.post(
        `${this.authApiUri}token`,
        new URLSearchParams({
          client_id: this.clientId,
          device_code: linkDeviceId,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      let accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;

      if (accessToken.length > 2048) {
        accessToken = this.compressToken(accessToken);
      }

      this.logger.log(`${householdId.hashCode()}: Got token`);

      return {
        authToken: accessToken,
        privateKey: refreshToken,
      };
    } catch (error) {
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData.error === 'authorization_pending') {
          this.logger.log(`${householdId.hashCode()}: Not linked retry`);
          throw new Error(Constants.NOT_LINKED_RETRY);
        }
      }
      this.logger.error('Error getting device auth token', error.response?.data);
      throw error;
    }
  }

  async refreshAuthToken(auth: GraphAuth, isAppFolder: boolean): Promise<GraphAuth> {
    this.logger.debug('refreshAuthToken');

    const scope = isAppFolder
      ? 'user.read Files.ReadWrite.AppFolder offline_access'
      : 'user.read files.read offline_access';

    try {
      const response = await axios.post(
        `${this.authApiUri}token`,
        new URLSearchParams({
          client_id: this.clientId,
          refresh_token: auth.refreshToken,
          grant_type: 'refresh_token',
          scope: scope,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      let accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;

      if (accessToken.length > 2048) {
        accessToken = this.compressToken(accessToken);
      }

      const newAuth = new GraphAuth();
      newAuth.deviceCode = accessToken;
      newAuth.refreshToken = refreshToken;

      this.logger.log(`${auth.householdId.hashCode()}: Got refreshed token`);

      return newAuth;
    } catch (error) {
      this.logger.error('Error refreshing auth token', error.response?.data);
      throw error;
    }
  }

  async getLastUpdate(auth: GraphAuth): Promise<string> {
    this.logger.debug('getLastUpdate');

    const path = `${Constants.DRIVE_ROOT}/delta`;
    const response = await this.graphApiGetRequest(path, 1, null, auth);

    if (response.value && response.value.length > 0) {
      return response.value[0].lastModifiedDateTime;
    }

    return null;
  }

  async getMetadata(id: string, count: number, index: number, auth: GraphAuth, isAppFolder: boolean): Promise<any> {
    this.logger.debug(`getMetadata id:${id} count:${count} index:${index}`);

    let path: string;

    if (id === 'root') {
      path = isAppFolder ? `${Constants.DRIVE_APPFOLDER}/children` : `${Constants.DRIVE_ROOT}/children`;
    } else if (id.startsWith(Constants.FOLDER)) {
      const itemId = id.replace(`${Constants.FOLDER}:`, '');
      path = `/me/drive/items/${itemId}/children`;
    } else {
      return null;
    }

    let skipToken = null;
    if (index > 0) {
      skipToken = await this.getSkipToken(path, index, auth);
    }

    const response = await this.graphApiGetRequest(path, count, skipToken, auth);
    return this.parseMediaListResponse(response);
  }

  async searchFiles(term: string, count: number, index: number, auth: GraphAuth): Promise<any> {
    this.logger.debug('searchFiles');

    const path = `/me/drive/root/search(q='${term}')`;
    
    let skipToken = null;
    if (index > 0) {
      skipToken = await this.getSkipToken(path, index, auth);
    }

    const response = await this.graphApiGetRequest(path, count, skipToken, auth);
    return this.parseMediaListResponse(response);
  }

  async getItemById(id: string, auth: GraphAuth): Promise<Item> {
    this.logger.debug(`getItemById id:${id}`);

    const response = await this.graphApiGetRequest(`me/drive/items/${id}`, 1, null, auth);
    return new Item(response);
  }

  private async graphApiGetRequest(path: string, count: number, skipToken: string, auth: GraphAuth): Promise<any> {
    try {
      const params: any = {};

      if (!path.includes('delta')) {
        params.expand = 'thumbnails';
      }
      if (count > 1) {
        params.top = count;
      }
      if (skipToken) {
        params.$skipToken = skipToken;
      }
      if (count > 100 && count !== Number.MAX_SAFE_INTEGER) {
        params.select = 'id';
      }

      const response = await this.axiosInstance.get(path, {
        params,
        headers: {
          Authorization: `Bearer ${auth.deviceCode}`,
        },
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.debug('Request NotAuthorized, trying to refresh token');
        throw new Error(Constants.TOKEN_REFRESH_REQUIRED);
      }
      this.logger.error('Bad request', error.response?.data);
      throw error;
    }
  }

  private async getSkipToken(path: string, index: number, auth: GraphAuth): Promise<string> {
    const response = await this.graphApiGetRequest(path, index, null, auth);
    
    if (response['@odata.nextLink']) {
      const match = response['@odata.nextLink'].match(/\$skiptoken=(.+)/i);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  private parseMediaListResponse(data: any): any {
    const items: any[] = [];

    if (data.value) {
      for (const itemData of data.value) {
        const item = new Item(itemData);
        
        if (!item.getType()) {
          this.logger.debug(`Ignoring item with null type: ${item.getName()}`);
          continue;
        }

        if (
          item.getType() === FileType.AUDIO ||
          (item.getType() === FileType.FILE && item.getName().endsWith('.flac')) ||
          (item.getType() === FileType.FILE && item.getMimeType()?.includes('audio'))
        ) {
          items.push(this.buildMediaMetadata(item));
        } else if (item.getType() === FileType.FOLDER || item.getType() === FileType.FILE) {
          items.push(this.buildMediaCollection(item));
        }
      }
    }

    return {
      items,
      count: items.length,
      total: data['@odata.count'] || items.length,
    };
  }

  private buildMediaCollection(item: Item): any {
    const mc: any = {};

    if (
      item.getType() === FileType.AUDIO ||
      (item.getType() === FileType.FILE && item.getName().endsWith('.flac')) ||
      (item.getType() === FileType.FILE && item.getMimeType()?.includes('audio'))
    ) {
      mc.id = `${Constants.AUDIO}:${item.getId()}`;
      mc.itemType = 'track';
      mc.title = item.getTitle() || item.getName();
      mc.artist = item.getArtist();
      mc.albumArtURI = item.getThumbnail();
      mc.canPlay = true;
      mc.canEnumerate = false;
    } else if (item.getType() === FileType.FILE) {
      mc.id = `${Constants.FILE}:${item.getId()}`;
      mc.itemType = 'other';
      mc.title = item.getName();
      mc.canPlay = false;
      mc.canEnumerate = false;
    } else if (item.getType() === FileType.FOLDER) {
      mc.id = `${Constants.FOLDER}:${item.getId()}`;
      mc.itemType = 'collection';
      mc.title = item.getName();
      mc.canPlay = item.getChildCount() < Constants.CAN_PLAY_COUNT;
      mc.canEnumerate = true;
    }

    return mc;
  }

  private buildMediaMetadata(item: Item): any {
    return {
      id: item.getId(),
      mimeType: this.getMimeType(item),
      itemType: 'track',
      displayType: 'audio',
      title: item.getTitle() || item.getName(),
      artist: item.getArtist(),
      album: item.getAlbum(),
      duration: item.getDuration(),
      albumArtURI: item.getThumbnail(),
      trackNumber: item.getTrack(),
    };
  }

  private getMimeType(item: Item): string {
    if (item.getType() === FileType.FILE && item.getName().endsWith('.flac')) {
      return 'audio/flac';
    }
    if (item.getMimeType()?.endsWith('wma')) {
      return 'audio/wma';
    }
    return item.getMimeType();
  }

  private compressToken(token: string): string {
    this.logger.log('Access token too long, compressing...');
    
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      const decodedFirstPart = Buffer.from(tokenParts[0], 'base64').toString('utf-8');
      const decodedSecondPart = Buffer.from(tokenParts[1], 'base64').toString('utf-8');
      const compressedToken = `${decodedFirstPart}###${decodedSecondPart}###${tokenParts[2]}`;
      
      if (compressedToken.length > 2048) {
        this.logger.error('Compressed token too long');
      }
      
      return compressedToken;
    }
    
    throw new Error(Constants.NOT_LINKED_FAILURE);
  }

  decompressToken(compressedToken: string): string {
    if (compressedToken.startsWith('{') && compressedToken.includes('###')) {
      const tokenParts = compressedToken.split('###');
      if (tokenParts.length === 3) {
        const encodedFirstPart = Buffer.from(tokenParts[0]).toString('base64').replace(/=/g, '');
        const encodedSecondPart = Buffer.from(tokenParts[1]).toString('base64').replace(/=/g, '');
        return `${encodedFirstPart}.${encodedSecondPart}.${tokenParts[2]}`;
      }
    }
    return compressedToken;
  }
}

// Add hashCode method to String prototype
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function(): number {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
};
