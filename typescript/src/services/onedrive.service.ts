import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import {
  AUTH_API_URI_DEFAULT,
  DRIVE_APPFOLDER,
  DRIVE_ROOT,
  FAULT,
  GRAPH_API_URI_DEFAULT,
  MAX_TOKEN_LENGTH,
  SCOPE_APPFOLDER,
  SCOPE_FILES,
} from '../config/constants';
import { GraphAuth, TokenPair } from '../models/graph-auth.model';
import { Item } from '../models/item.model';
import { MediaList, toMediaList } from '../soap/media.mapper';
import { SonosFault } from '../soap/sonos-fault';

export interface DeviceLinkCode {
  regUrl: string;
  linkCode: string;
  showLinkCode: boolean;
  linkDeviceId: string;
}

@Injectable()
export class OneDriveService {
  private readonly logger = new Logger(OneDriveService.name);
  private readonly authApi: AxiosInstance;
  private readonly graphApi: AxiosInstance;
  private readonly clientId: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.get<string>('GRAPH_CLIENT_ID');
    this.authApi = axios.create({
      baseURL: configService.get<string>('AUTH_API_URI') || AUTH_API_URI_DEFAULT,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    this.graphApi = axios.create({
      baseURL: configService.get<string>('GRAPH_API_URI') || GRAPH_API_URI_DEFAULT,
    });
  }

  async getDeviceLinkCode(householdId: string, isAppFolder: boolean): Promise<DeviceLinkCode> {
    try {
      const { data } = await this.authApi.post(
        'devicecode',
        new URLSearchParams({ client_id: this.clientId, scope: scope(isAppFolder) }),
      );
      this.logger.log(`${hashCode(householdId)}: Got verification uri`);
      return {
        regUrl: data.verification_uri,
        linkCode: data.user_code,
        showLinkCode: true,
        linkDeviceId: data.device_code,
      };
    } catch (error) {
      this.logger.error(`${hashCode(householdId)}: getDeviceLinkCode failed`, describe(error));
      if (status(error) === 401) {
        throw new SonosFault(FAULT.LOGIN_INVALID);
      }
      throw new SonosFault(FAULT.SERVICE_UNKNOWN_ERROR);
    }
  }

  async getDeviceAuthToken(householdId: string, linkDeviceId: string): Promise<TokenPair> {
    try {
      const { data } = await this.authApi.post(
        'token',
        new URLSearchParams({
          client_id: this.clientId,
          device_code: linkDeviceId,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      );
      this.logger.log(`${hashCode(householdId)}: Got token`);
      const tokens = this.toTokenPair(data);
      const userIdHashCode = await this.getUserIdHashCode(data.access_token);
      return userIdHashCode ? { ...tokens, userInfo: { userIdHashCode } } : tokens;
    } catch (error) {
      if (error instanceof SonosFault) {
        throw error;
      }
      const oauthError = (error as AxiosError<any>).response?.data?.error;
      if (status(error) === 401 || oauthError === 'authorization_pending' || oauthError === 'slow_down') {
        this.logger.log(`${hashCode(householdId)}: Not linked retry`);
        throw SonosFault.withSonosError(FAULT.NOT_LINKED_RETRY, 'NOT_LINKED_RETRY', 5);
      }
      this.logger.error(`${hashCode(householdId)}: getDeviceAuthToken failed`, describe(error));
      throw SonosFault.withSonosError(FAULT.NOT_LINKED_FAILURE, 'NOT_LINKED_FAILURE', 6);
    }
  }

  async refreshAuthToken(auth: GraphAuth, isAppFolder: boolean): Promise<TokenPair> {
    try {
      const { data } = await this.authApi.post(
        'token',
        new URLSearchParams({
          client_id: this.clientId,
          refresh_token: auth.refreshToken,
          grant_type: 'refresh_token',
          scope: scope(isAppFolder),
        }),
      );
      this.logger.log(`${hashCode(auth.householdId)}: Got refreshed token`);
      return this.toTokenPair(data);
    } catch (error) {
      if (error instanceof SonosFault) {
        throw error;
      }
      this.logger.error(`${hashCode(auth.householdId)}: refreshAuthToken failed`, describe(error));
      const oauthError = (error as AxiosError<any>).response?.data?.error;
      if (status(error) === 401 || oauthError === 'invalid_grant') {
        throw new SonosFault(FAULT.AUTH_TOKEN_EXPIRED);
      }
      throw new SonosFault(FAULT.SERVICE_UNKNOWN_ERROR);
    }
  }

  async getLastUpdate(auth: GraphAuth, isAppFolder: boolean): Promise<string> {
    const data = await this.graphGet(`${driveRoot(isAppFolder)}/delta`, auth, isAppFolder, { top: 1 });
    return data.value?.[0]?.lastModifiedDateTime ?? '';
  }

  async getRootChildren(auth: GraphAuth, isAppFolder: boolean, index: number, count: number): Promise<MediaList> {
    return this.getPage(`${driveRoot(isAppFolder)}/children`, auth, isAppFolder, index, count);
  }

  async getFolderChildren(
    folderId: string,
    auth: GraphAuth,
    isAppFolder: boolean,
    index: number,
    count: number,
  ): Promise<MediaList> {
    return this.getPage(`/me/drive/items/${encodeURIComponent(folderId)}/children`, auth, isAppFolder, index, count);
  }

  async search(term: string, auth: GraphAuth, isAppFolder: boolean, index: number, count: number): Promise<MediaList> {
    const query = encodeURIComponent(term.replace(/'/g, "''"));
    return this.getPage(`${driveRoot(isAppFolder)}/search(q='${query}')`, auth, isAppFolder, index, count);
  }

  async getItem(itemId: string, auth: GraphAuth, isAppFolder: boolean): Promise<Item> {
    const data = await this.graphGet(`/me/drive/items/${encodeURIComponent(itemId)}`, auth, isAppFolder, {
      expand: 'thumbnails',
    });
    return new Item(data);
  }

  private async getPage(
    path: string,
    auth: GraphAuth,
    isAppFolder: boolean,
    index: number,
    count: number,
  ): Promise<MediaList> {
    const params: Record<string, string | number> = { expand: 'thumbnails', top: count };
    if (index > 0) {
      const skipToken = await this.getSkipToken(path, auth, isAppFolder, index);
      if (!skipToken) {
        return { index, count: 0, total: index };
      }
      params.$skiptoken = skipToken;
    }
    return toMediaList(await this.graphGet(path, auth, isAppFolder, params), index);
  }

  private async getSkipToken(path: string, auth: GraphAuth, isAppFolder: boolean, index: number): Promise<string> {
    const data = await this.graphGet(path, auth, isAppFolder, { top: index, select: 'id' });
    const match = (data['@odata.nextLink'] as string)?.match(/\$skiptoken=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  private async graphGet(path: string, auth: GraphAuth, isAppFolder: boolean, params: object): Promise<any> {
    try {
      const { data } = await this.graphApi.get(path, {
        params,
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      return data;
    } catch (error) {
      const code = status(error);
      if (code === 401) {
        this.logger.debug(`${hashCode(auth.householdId)}: Graph returned 401, refreshing token`);
        const tokens = await this.refreshAuthToken(auth, isAppFolder);
        throw SonosFault.withRefreshedToken(FAULT.TOKEN_REFRESH_REQUIRED, tokens.authToken, tokens.privateKey);
      }
      if (code === 404) {
        throw new SonosFault(FAULT.ITEM_NOT_FOUND);
      }
      this.logger.error(`${hashCode(auth.householdId)}: Graph request ${path} failed`, describe(error));
      if ((error as AxiosError<any>).response?.data?.error === 'invalid_grant') {
        throw new SonosFault(FAULT.AUTH_TOKEN_EXPIRED);
      }
      throw new SonosFault(code === 503 || code === 429 ? FAULT.SERVICE_UNAVAILABLE : FAULT.SERVICE_UNKNOWN_ERROR);
    }
  }

  private async getUserIdHashCode(accessToken: string): Promise<string | undefined> {
    try {
      const { data } = await this.graphApi.get('/me', {
        params: { $select: 'id' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return data?.id ? createHash('sha256').update(String(data.id)).digest('hex') : undefined;
    } catch (error) {
      this.logger.warn(`Could not read user id: ${JSON.stringify(describe(error))}`);
      return undefined;
    }
  }

  private toTokenPair(data: any): TokenPair {
    if (!data?.access_token || !data?.refresh_token) {
      throw SonosFault.withSonosError(FAULT.NOT_LINKED_FAILURE, 'NOT_LINKED_FAILURE', 6);
    }
    return { authToken: compressToken(data.access_token), privateKey: data.refresh_token };
  }
}

export function compressToken(token: string): string {
  if (token.length <= MAX_TOKEN_LENGTH) {
    return token;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new SonosFault(FAULT.NOT_LINKED_FAILURE);
  }
  return [base64UrlDecode(parts[0]), base64UrlDecode(parts[1]), parts[2]].join('###');
}

export function decompressToken(token: string): string {
  if (!token.startsWith('{') || !token.includes('###')) {
    return token;
  }
  const parts = token.split('###');
  if (parts.length !== 3) {
    throw new SonosFault(FAULT.NOT_LINKED_FAILURE);
  }
  return [base64UrlEncode(parts[0]), base64UrlEncode(parts[1]), parts[2]].join('.');
}

export function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < (value ?? '').length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

function scope(isAppFolder: boolean): string {
  return isAppFolder ? SCOPE_APPFOLDER : SCOPE_FILES;
}

function driveRoot(isAppFolder: boolean): string {
  return isAppFolder ? DRIVE_APPFOLDER : DRIVE_ROOT;
}

function status(error: unknown): number | undefined {
  return (error as AxiosError)?.response?.status;
}

function describe(error: unknown): unknown {
  return (error as AxiosError)?.response?.data ?? (error as Error)?.message;
}
