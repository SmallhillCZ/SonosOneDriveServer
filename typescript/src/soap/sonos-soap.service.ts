import { Injectable, Logger } from '@nestjs/common';
import { Express } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as soap from 'soap';
import {
  APP_LINK_STRING_ID,
  FAULT,
  ID_PREFIX,
  ROOT_ID,
  SEARCH_FILES_ID,
  SEARCH_ID,
  SOAP_APPFOLDER_PATH,
  SOAP_PATH,
} from '../config/constants';
import { GraphAuth } from '../models/graph-auth.model';
import { decompressToken, hashCode, OneDriveService } from '../services/onedrive.service';
import { MediaList, toMediaCollection, toMediaMetadata } from './media.mapper';
import { SonosFault } from './sonos-fault';

export const WSDL_PATH = join(__dirname, '..', '..', 'resources', 'wsdl', 'Sonos.wsdl');

type Handler = (args: any, callback: unknown, headers: any) => Promise<object>;

@Injectable()
export class SonosSoapService {
  private readonly logger = new Logger(SonosSoapService.name);

  constructor(private readonly oneDrive: OneDriveService) {}

  async mount(app: Express): Promise<void> {
    const wsdl = readFileSync(WSDL_PATH, 'utf8');
    await Promise.all([
      this.listen(app, SOAP_PATH, wsdl, false),
      this.listen(app, SOAP_APPFOLDER_PATH, wsdl, true),
    ]);
  }

  private listen(app: Express, path: string, wsdl: string, isAppFolder: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      soap.listen(app, {
        path,
        xml: wsdl,
        services: this.services(isAppFolder),
        callback: (error: unknown) => (error ? reject(error) : resolve()),
      });
    });
  }

  services(isAppFolder: boolean) {
    return { Sonos: { SonosSoap: this.handlers(isAppFolder) } };
  }

  private handlers(isAppFolder: boolean): Record<string, Handler> {
    const unsupported = (name: string, fault: string = FAULT.SERVICE_UNKNOWN_ERROR): Handler => async () => {
      this.logger.debug(`${name} is not supported`);
      throw new SonosFault(fault);
    };

    const handlers: Record<string, Handler> = {
      getDeviceLinkCode: async (args) => ({
        getDeviceLinkCodeResult: await this.oneDrive.getDeviceLinkCode(args.householdId, isAppFolder),
      }),

      getAppLink: async (args) => ({
        getAppLinkResult: {
          authorizeAccount: {
            appUrlStringId: APP_LINK_STRING_ID,
            deviceLink: await this.oneDrive.getDeviceLinkCode(args.householdId, isAppFolder),
          },
        },
      }),

      getDeviceAuthToken: async (args) => ({
        getDeviceAuthTokenResult: await this.oneDrive.getDeviceAuthToken(args.householdId, args.linkDeviceId),
      }),

      refreshAuthToken: async (_args, _cb, headers) => ({
        refreshAuthTokenResult: await this.oneDrive.refreshAuthToken(this.auth(headers), isAppFolder),
      }),

      getLastUpdate: async (_args, _cb, headers) => ({
        getLastUpdateResult: {
          catalog: await this.oneDrive.getLastUpdate(this.auth(headers), isAppFolder),
          favorites: '',
        },
      }),

      getMetadata: async (args, _cb, headers) => ({
        getMetadataResult: await this.getMetadata(args, this.auth(headers), isAppFolder),
      }),

      search: async (args, _cb, headers) => {
        const auth = this.auth(headers);
        if (args.id !== SEARCH_FILES_ID) {
          throw new SonosFault(FAULT.ITEM_NOT_FOUND);
        }
        return {
          searchResult: await this.oneDrive.search(args.term ?? '', auth, isAppFolder, int(args.index), pageSize(args.count)),
        };
      },

      getMediaMetadata: async (args, _cb, headers) => {
        const item = await this.oneDrive.getItem(stripPrefix(args.id), this.auth(headers), isAppFolder);
        if (!item.isPlayable) {
          throw new SonosFault(FAULT.ITEM_NOT_FOUND);
        }
        return { getMediaMetadataResult: toMediaMetadata(item) };
      },

      getMediaURI: async (args, _cb, headers) => {
        const item = await this.oneDrive.getItem(stripPrefix(args.id), this.auth(headers), isAppFolder);
        if (!item.isPlayable || !item.fileUri) {
          throw new SonosFault(FAULT.ITEM_NOT_FOUND);
        }
        return { getMediaURIResult: item.fileUri };
      },

      getExtendedMetadata: async (args, _cb, headers) => {
        const auth = this.auth(headers);
        if (args.id === ROOT_ID || args.id === SEARCH_ID) {
          throw new SonosFault(FAULT.ITEM_NOT_FOUND);
        }
        const item = await this.oneDrive.getItem(stripPrefix(args.id), auth, isAppFolder);
        if (!item.type) {
          throw new SonosFault(FAULT.ITEM_NOT_FOUND);
        }
        return {
          getExtendedMetadataResult: item.isPlayable
            ? { mediaMetadata: toMediaMetadata(item) }
            : { mediaCollection: toMediaCollection(item) },
        };
      },

      getExtendedMetadataText: unsupported('getExtendedMetadataText', FAULT.ITEM_NOT_FOUND),
      getScrollIndices: unsupported('getScrollIndices', FAULT.ITEM_NOT_FOUND),

      reportPlaySeconds: async () => ({ reportPlaySecondsResult: { interval: 0 } }),
      reportPlayStatus: async () => ({}),
      setPlayedSeconds: async () => ({}),
      reportStatus: async () => ({}),
      reportAccountAction: async () => ({}),

      getSessionId: unsupported('getSessionId'),
      getUserInfo: unsupported('getUserInfo'),
      getContentKey: unsupported('getContentKey'),
      rateItem: unsupported('rateItem'),
      createItem: unsupported('createItem'),
      deleteItem: unsupported('deleteItem'),
      createContainer: unsupported('createContainer'),
      addToContainer: unsupported('addToContainer'),
      renameContainer: unsupported('renameContainer'),
      reorderContainer: unsupported('reorderContainer'),
      removeFromContainer: unsupported('removeFromContainer'),
      deleteContainer: unsupported('deleteContainer'),
    };

    return Object.fromEntries(
      Object.entries(handlers).map(([name, handler]) => [name, this.logged(name, handler)]),
    );
  }

  private logged(name: string, handler: Handler): Handler {
    return async (args, callback, headers) => {
      this.logger.debug(args?.id ? `${name} id:${args.id}` : name);
      try {
        return await handler(args ?? {}, callback, headers);
      } catch (error) {
        if (error instanceof SonosFault) {
          throw error;
        }
        this.logger.error(`${name} failed`, (error as Error)?.stack);
        throw new SonosFault(FAULT.SERVICE_UNKNOWN_ERROR);
      }
    };
  }

  private async getMetadata(args: any, auth: GraphAuth, isAppFolder: boolean): Promise<MediaList> {
    const id: string = args.id;
    const index = int(args.index);
    const count = pageSize(args.count);

    let result: MediaList;
    if (id === ROOT_ID) {
      result = await this.oneDrive.getRootChildren(auth, isAppFolder, index, count);
    } else if (id?.startsWith(`${ID_PREFIX.FOLDER}:`)) {
      result = await this.oneDrive.getFolderChildren(stripPrefix(id), auth, isAppFolder, index, count);
    } else if (id === SEARCH_ID) {
      result = {
        index,
        count: 1,
        total: 1,
        mediaCollection: [{ id: SEARCH_FILES_ID, itemType: 'search', title: 'Files', canPlay: false }],
      };
    } else {
      throw new SonosFault(FAULT.ITEM_NOT_FOUND);
    }

    this.logger.log(
      `${hashCode(auth.householdId)}: Got metadata for ${id} index:${result.index} count:${result.count} total:${result.total}`,
    );
    return result;
  }

  private auth(headers: any): GraphAuth {
    const loginToken = headers?.credentials?.loginToken;
    if (!loginToken?.token || !loginToken?.householdId) {
      throw new SonosFault(FAULT.SESSION_INVALID);
    }
    return new GraphAuth(loginToken.householdId, decompressToken(loginToken.token), loginToken.key);
  }
}

function stripPrefix(id: string): string {
  return (id ?? '').replace(new RegExp(`^(${Object.values(ID_PREFIX).join('|')}):`), '');
}

function int(value: unknown): number {
  const parsed = parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function pageSize(value: unknown): number {
  return int(value) || 100;
}
