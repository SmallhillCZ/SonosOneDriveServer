import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { compressToken, decompressToken } from '../src/services/onedrive.service';
import { FakeMicrosoft, startFakeMicrosoft } from './fake-microsoft';

const NS = 'http://www.sonos.com/Services/1.1';

function envelope(action: string, body: string, credentials = true): string {
  const header = credentials
    ? `<s:Header><ns:credentials><ns:loginToken><ns:token>access</ns:token><ns:key>refresh</ns:key><ns:householdId>HH1</ns:householdId></ns:loginToken></ns:credentials></s:Header>`
    : '<s:Header/>';
  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${NS}">${header}<s:Body><ns:${action}>${body}</ns:${action}></s:Body></s:Envelope>`;
}

const folder = { id: 'F1', name: 'Albums', folder: { childCount: 3 } };
const track = {
  id: 'T1',
  name: 'song.mp3',
  file: { mimeType: 'audio/mpeg' },
  audio: { title: 'Song', artist: 'Artist', album: 'Album', duration: 185000, track: 2 },
  thumbnails: [{ small: { url: 'https://img/small' }, large: { url: 'https://img/large' } }],
  '@microsoft.graph.downloadUrl': 'https://download/T1',
};
const flac = { id: 'T2', name: 'song.flac', file: { mimeType: 'application/octet-stream' } };
const doc = { id: 'D1', name: 'notes.txt', file: { mimeType: 'text/plain' } };

describe('Sonos SOAP service', () => {
  let app: NestExpressApplication;
  let fake: FakeMicrosoft;

  const soap = (action: string, body = '', path = '/soap', credentials = true) =>
    request(app.getHttpServer())
      .post(path)
      .set('Content-Type', 'text/xml; charset=utf-8')
      .set('SOAPAction', `"${NS}#${action}"`)
      .send(envelope(action, body, credentials));

  beforeAll(async () => {
    Logger.overrideLogger(false);
    fake = await startFakeMicrosoft();
    process.env.GRAPH_CLIENT_ID = 'client-id';
    process.env.AUTH_API_URI = `${fake.url}/auth/`;
    process.env.GRAPH_API_URI = `${fake.url}/graph/`;
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await fake.close();
  });

  beforeEach(() => {
    fake.requests.length = 0;
    fake.graph.clear();
    fake.token = { status: 200, body: { access_token: 'new-access', refresh_token: 'new-refresh' } };
  });

  it('lists root folder with collections and tracks', async () => {
    fake.graph.set('/me/drive/root/children', { status: 200, body: { value: [folder, track, flac, doc, { id: 'X', name: 'link.url' }] } });

    const res = await soap('getMetadata', '<ns:id>root</ns:id><ns:index>0</ns:index><ns:count>50</ns:count>');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<getMetadataResult>');
    expect(res.text).toMatch(/<index>0<\/index><count>4<\/count><total>4<\/total>/);
    expect(res.text).toMatch(/<mediaCollection><id>folder:F1<\/id><itemType>collection<\/itemType><title>Albums<\/title><canPlay>true<\/canPlay><canEnumerate>true<\/canEnumerate><\/mediaCollection>/);
    expect(res.text).toContain('<id>file:D1</id><itemType>other</itemType>');
    expect(res.text).toMatch(
      /<mediaMetadata><id>T1<\/id><itemType>track<\/itemType><displayType>audio<\/displayType><title>Song<\/title><mimeType>audio\/mpeg<\/mimeType><trackMetadata><artist>Artist<\/artist><album>Album<\/album><duration>185<\/duration><albumArtURI>https:\/\/img\/large<\/albumArtURI><trackNumber>2<\/trackNumber><\/trackMetadata><\/mediaMetadata>/,
    );
    expect(res.text).toContain('<id>T2</id><itemType>track</itemType><displayType>audio</displayType><title>song.flac</title><mimeType>audio/flac</mimeType>');
    expect(fake.requests[0].headers.authorization).toBe('Bearer access');
    expect(fake.requests[0].query).toMatchObject({ expand: 'thumbnails', top: '50' });
  });

  it('lists a folder page using the skip token', async () => {
    fake.graph.set('/me/drive/items/F1/children', {
      status: 200,
      body: { value: [track], '@odata.nextLink': 'https://graph/x?$skiptoken=abc%3D' },
    });

    const res = await soap('getMetadata', '<ns:id>folder:F1</ns:id><ns:index>10</ns:index><ns:count>10</ns:count>');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<index>10</index>');
    expect(fake.requests[0].query).toMatchObject({ top: '10', select: 'id' });
    expect(fake.requests[1].query).toMatchObject({ $skiptoken: 'abc=' });
  });

  it('returns the search root', async () => {
    const res = await soap('getMetadata', '<ns:id>search</ns:id><ns:index>0</ns:index><ns:count>10</ns:count>');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<mediaCollection><id>files</id><itemType>search</itemType><title>Files</title><canPlay>false</canPlay></mediaCollection>');
  });

  it('uses the app folder on the app folder endpoint', async () => {
    fake.graph.set('/me/drive/special/approot/children', { status: 200, body: { value: [folder] } });

    const res = await soap('getMetadata', '<ns:id>root</ns:id><ns:index>0</ns:index><ns:count>10</ns:count>', '/soap_appfolder');

    expect(res.status).toBe(200);
    expect(res.text).toContain('folder:F1');
  });

  it('searches with an escaped term', async () => {
    fake.graph.set("/me/drive/root/search(q='rock''n roll')", { status: 200, body: { value: [track] } });

    const res = await soap('search', "<ns:id>files</ns:id><ns:term>rock'n roll</ns:term><ns:index>0</ns:index><ns:count>10</ns:count>");

    expect(res.status).toBe(200);
    expect(res.text).toContain('<searchResult>');
    expect(res.text).toContain('<id>T1</id>');
  });

  it('returns the media URI', async () => {
    fake.graph.set('/me/drive/items/T1', { status: 200, body: track });

    const res = await soap('getMediaURI', '<ns:id>T1</ns:id>');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<getMediaURIResult>https://download/T1</getMediaURIResult>');
  });

  it('returns media metadata', async () => {
    fake.graph.set('/me/drive/items/T1', { status: 200, body: track });

    const res = await soap('getMediaMetadata', '<ns:id>T1</ns:id>');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<getMediaMetadataResult><id>T1</id>');
  });

  it('returns extended metadata for folders and tracks', async () => {
    fake.graph.set('/me/drive/items/F1', { status: 200, body: folder });
    fake.graph.set('/me/drive/items/T1', { status: 200, body: track });

    const folderRes = await soap('getExtendedMetadata', '<ns:id>folder:F1</ns:id>');
    const trackRes = await soap('getExtendedMetadata', '<ns:id>T1</ns:id>');

    expect(folderRes.status).toBe(200);
    expect(folderRes.text).toContain('<getExtendedMetadataResult><mediaCollection><id>folder:F1</id>');
    expect(trackRes.status).toBe(200);
    expect(trackRes.text).toContain('<getExtendedMetadataResult><mediaMetadata><id>T1</id>');
  });

  it('returns ItemNotFound for unknown items', async () => {
    const res = await soap('getExtendedMetadata', '<ns:id>folder:missing</ns:id>');

    expect(res.status).toBe(500);
    expect(res.text).toContain('<faultcode>Client.ItemNotFound</faultcode>');
  });

  it('returns the last update', async () => {
    fake.graph.set('/me/drive/root/delta', { status: 200, body: { value: [{ lastModifiedDateTime: '2024-01-01T00:00:00Z' }] } });

    const res = await soap('getLastUpdate');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<getLastUpdateResult><catalog>2024-01-01T00:00:00Z</catalog><favorites></favorites></getLastUpdateResult>');
  });

  it('refreshes the token when Graph returns 401', async () => {
    fake.graph.set('/me/drive/root/children', { status: 401, body: { error: { code: 'InvalidAuthenticationToken' } } });

    const res = await soap('getMetadata', '<ns:id>root</ns:id><ns:index>0</ns:index><ns:count>10</ns:count>');

    expect(res.status).toBe(500);
    expect(res.text).toContain('<faultcode>Client.TokenRefreshRequired</faultcode>');
    expect(res.text).toMatch(/<ns:refreshAuthTokenResult xmlns:ns="[^"]+"><ns:authToken>new-access<\/ns:authToken><ns:privateKey>new-refresh<\/ns:privateKey><\/ns:refreshAuthTokenResult>/);
    const tokenRequest = fake.requests.find((r) => r.path === '/auth/token');
    expect(tokenRequest.body).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'refresh', scope: 'user.read files.read offline_access' });
  });

  it('returns AuthTokenExpired when the refresh token is invalid', async () => {
    fake.graph.set('/me/drive/root/children', { status: 401, body: {} });
    fake.token = { status: 400, body: { error: 'invalid_grant' } };

    const res = await soap('getMetadata', '<ns:id>root</ns:id><ns:index>0</ns:index><ns:count>10</ns:count>');

    expect(res.status).toBe(500);
    expect(res.text).toContain('<faultcode>Client.AuthTokenExpired</faultcode>');
  });

  it('implements refreshAuthToken', async () => {
    const res = await soap('refreshAuthToken');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<refreshAuthTokenResult><authToken>new-access</authToken><privateKey>new-refresh</privateKey></refreshAuthTokenResult>');
  });

  it('returns SessionIdInvalid without credentials', async () => {
    const res = await soap('getMetadata', '<ns:id>root</ns:id><ns:index>0</ns:index><ns:count>10</ns:count>', '/soap', false);

    expect(res.status).toBe(500);
    expect(res.text).toContain('<faultcode>Client.SessionIdInvalid</faultcode>');
  });

  it('returns a device link code', async () => {
    const res = await soap('getDeviceLinkCode', '<ns:householdId>HH1</ns:householdId>', '/soap_appfolder', false);

    expect(res.status).toBe(200);
    expect(res.text).toContain(
      '<getDeviceLinkCodeResult><regUrl>https://microsoft.com/devicelogin</regUrl><linkCode>ABC123</linkCode><showLinkCode>true</showLinkCode><linkDeviceId>dev-code</linkDeviceId></getDeviceLinkCodeResult>',
    );
    expect(fake.requests[0].body).toMatchObject({ client_id: 'client-id', scope: 'user.read Files.ReadWrite.AppFolder offline_access' });
  });

  it('returns NOT_LINKED_RETRY while authorization is pending', async () => {
    fake.token = { status: 400, body: { error: 'authorization_pending' } };

    const res = await soap('getDeviceAuthToken', '<ns:householdId>HH1</ns:householdId><ns:linkCode>ABC123</ns:linkCode><ns:linkDeviceId>dev-code</ns:linkDeviceId>', '/soap', false);

    expect(res.status).toBe(500);
    expect(res.text).toContain('<faultcode>Client.NOT_LINKED_RETRY</faultcode>');
    expect(res.text).toMatch(/<ns:SonosError xmlns:ns="[^"]+">5<\/ns:SonosError>/);
  });

  it('returns NOT_LINKED_FAILURE when the device code expired', async () => {
    fake.token = { status: 400, body: { error: 'expired_token' } };

    const res = await soap('getDeviceAuthToken', '<ns:householdId>HH1</ns:householdId><ns:linkCode>ABC123</ns:linkCode><ns:linkDeviceId>dev-code</ns:linkDeviceId>', '/soap', false);

    expect(res.status).toBe(500);
    expect(res.text).toContain('<faultcode>Client.NOT_LINKED_FAILURE</faultcode>');
    expect(res.text).toMatch(/<ns:SonosError xmlns:ns="[^"]+">6<\/ns:SonosError>/);
  });

  it('returns device auth tokens once linked', async () => {
    const res = await soap('getDeviceAuthToken', '<ns:householdId>HH1</ns:householdId><ns:linkCode>ABC123</ns:linkCode><ns:linkDeviceId>dev-code</ns:linkDeviceId>', '/soap', false);

    expect(res.status).toBe(200);
    expect(res.text).toContain('<getDeviceAuthTokenResult><authToken>new-access</authToken><privateKey>new-refresh</privateKey></getDeviceAuthTokenResult>');
  });

  it('acknowledges reporting calls', async () => {
    const res = await soap('reportPlayStatus', '<ns:id>T1</ns:id><ns:status>skippedTrack</ns:status>');

    expect(res.status).toBe(200);
    expect(res.text).toContain('reportPlayStatusResponse');
  });

  it('faults on unsupported operations', async () => {
    const res = await soap('createContainer', '<ns:containerType>playlist</ns:containerType><ns:title>x</ns:title>');

    expect(res.status).toBe(500);
    expect(res.text).toContain('<faultcode>Server.ServiceUnknownError</faultcode>');
  });

  it('serves the WSDL, presentation map and identity association', async () => {
    const server = app.getHttpServer();

    await request(server).get('/soap?wsdl').expect(200).expect(/wsdl:definitions/);
    await request(server).get('/wsdl').expect(200).expect(/wsdl:definitions/);
    await request(server).get('/static/presentationMap.xml').expect(200).expect(/PresentationMap/);
    await request(server).get('/static/strings.xml').expect(200);
    await request(server).get('/static/rating_star_on.png').expect(200);
    await request(server)
      .get('/.well-known/microsoft-identity-association.json')
      .expect(200, { associatedApplications: [{ applicationId: 'client-id' }] });
  });
});

describe('token compression', () => {
  it('round-trips long JWTs', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', x: '>>>???' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ data: 'ü'.repeat(1500), more: '~~~>>>' })).toString('base64url');
    const jwt = `${header}.${payload}.signature`;

    const compressed = compressToken(jwt);

    expect(compressed.length).toBeLessThan(jwt.length);
    expect(compressed.startsWith('{')).toBe(true);
    expect(decompressToken(compressed)).toBe(jwt);
  });

  it('leaves short tokens unchanged', () => {
    expect(compressToken('short')).toBe('short');
    expect(decompressToken('short')).toBe('short');
  });
});
