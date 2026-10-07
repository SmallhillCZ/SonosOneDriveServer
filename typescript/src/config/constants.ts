export const SONOS_NAMESPACE = 'http://www.sonos.com/Services/1.1';

export const SOAP_PATH = '/soap';
export const SOAP_APPFOLDER_PATH = '/soap_appfolder';

export const ID_PREFIX = {
  FOLDER: 'folder',
  FILE: 'file',
  AUDIO: 'audio',
} as const;

export const ROOT_ID = 'root';
export const SEARCH_ID = 'search';
export const SEARCH_FILES_ID = 'files';

export const FAULT = {
  SESSION_INVALID: 'Client.SessionIdInvalid',
  LOGIN_INVALID: 'Client.LoginInvalid',
  ITEM_NOT_FOUND: 'Client.ItemNotFound',
  TOKEN_REFRESH_REQUIRED: 'Client.TokenRefreshRequired',
  AUTH_TOKEN_EXPIRED: 'Client.AuthTokenExpired',
  NOT_LINKED_RETRY: 'Client.NOT_LINKED_RETRY',
  NOT_LINKED_FAILURE: 'Client.NOT_LINKED_FAILURE',
  SERVICE_UNKNOWN_ERROR: 'Server.ServiceUnknownError',
  SERVICE_UNAVAILABLE: 'Server.ServiceUnavailable',
} as const;

export const AUTH_API_URI_DEFAULT = 'https://login.microsoftonline.com/common/oauth2/v2.0/';
export const GRAPH_API_URI_DEFAULT = 'https://graph.microsoft.com/v1.0/';
export const DRIVE_ROOT = '/me/drive/root';
export const DRIVE_APPFOLDER = '/me/drive/special/approot';

export const SCOPE_FILES = 'user.read files.read offline_access';
export const SCOPE_APPFOLDER = 'user.read Files.ReadWrite.AppFolder offline_access';

export const CAN_PLAY_COUNT = 100;
export const MAX_TOKEN_LENGTH = 2048;
