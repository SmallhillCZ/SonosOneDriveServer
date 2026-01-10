export class Constants {
  // Item types
  static readonly PROGRAM = 'program';
  static readonly DEFAULT = 'default';
  static readonly FOLDER = 'folder';
  static readonly FILE = 'file';
  static readonly AUDIO = 'audio';
  static readonly FILES = 'files';

  // Error codes
  static readonly SESSION_INVALID = 'Client.SessionIdInvalid';
  static readonly LOGIN_INVALID = 'Client.LoginInvalid';
  static readonly SERVICE_UNKNOWN_ERROR = 'Client.ServiceUnknownError';
  static readonly SERVICE_UNAVAILABLE = 'Client.ServiceUnavailable';
  static readonly ITEM_NOT_FOUND = 'Client.ItemNotFound';
  static readonly TOKEN_REFRESH_REQUIRED = 'Client.TokenRefreshRequired';
  static readonly AUTH_TOKEN_EXPIRED = 'Client.AuthTokenExpired';
  static readonly NOT_LINKED_RETRY = 'Client.NOT_LINKED_RETRY';
  static readonly NOT_LINKED_FAILURE = 'Client.NOT_LINKED_FAILURE';

  // API URIs
  static readonly AUTH_API_URI_DEFAULT = 'https://login.microsoftonline.com/common/oauth2/v2.0/';
  static readonly GRAPH_API_URI_DEFAULT = 'https://graph.microsoft.com/v1.0/';
  static readonly DRIVE_ROOT = '/me/drive/root';
  static readonly DRIVE_APPFOLDER = '/drive/special/approot';

  // Other constants
  static readonly CAN_PLAY_COUNT = 100;
}
