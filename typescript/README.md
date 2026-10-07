# Sonos OneDrive Server (TypeScript/NestJS)

Sonos Music API (SMAPI) service that lets Sonos browse, search and play audio stored on OneDrive.

## Requirements

- Node.js 20+
- A [Microsoft app registration](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/app-registration) that allows personal Microsoft accounts and public client flows (device code)

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GRAPH_CLIENT_ID` | Microsoft app (client) ID | required |
| `PORT` | HTTP port | `3000` |
| `GRAPH_API_URI` | Microsoft Graph base URL | `https://graph.microsoft.com/v1.0/` |
| `AUTH_API_URI` | Microsoft identity base URL | `https://login.microsoftonline.com/common/oauth2/v2.0/` |

Copy `.env.example` to `.env` for local development.

## Commands

```bash
npm ci
npm run start:dev
npm test
npm run build && npm run start:prod
docker compose up --build
```

## Endpoints

| Path | Purpose |
|------|---------|
| `POST /soap` | SMAPI endpoint, whole OneDrive (`files.read` scope) |
| `POST /soap_appfolder` | SMAPI endpoint limited to the app folder (`Files.ReadWrite.AppFolder` scope) |
| `GET /wsdl`, `GET /soap?wsdl` | Sonos WSDL |
| `GET /static/presentationMap.xml` | Presentation map (search categories, display types) |
| `GET /static/strings.xml` | Localized strings |
| `GET /.well-known/microsoft-identity-association.json` | Microsoft publisher domain verification |
| `GET /health` | Health check |

## SMAPI support

- Authentication: Microsoft device code flow exposed both as Sonos browser authentication (`getAppLink`, select "OAuth" in the Sonos developer portal) and legacy DeviceLink (`getDeviceLinkCode`); `getDeviceAuthToken` returns a SHA-256 hashed user id, `refreshAuthToken`, and `Client.TokenRefreshRequired` faults carrying a fresh token when Graph returns 401
- Browse: `getMetadata` (`root`, `folder:<id>`, `search`), `getExtendedMetadata`, `getLastUpdate`
- Search: `search` with category `files`
- Playback: `getMediaMetadata`, `getMediaURI` (pre-authenticated OneDrive download URL)
- Reporting calls are acknowledged; write operations (containers, ratings, favorites) return `Server.ServiceUnknownError`

Access tokens longer than 2048 characters are stored in Sonos in a compressed form and expanded on each request, compatible with the Java implementation.

## Project structure

```
src/
├── app.factory.ts           app bootstrap shared by main.ts and tests
├── config/constants.ts      SMAPI ids, fault codes, Graph paths
├── controllers/             health, WSDL, Microsoft identity association
├── models/                  Graph item and auth models
├── services/onedrive.service.ts   Microsoft identity + Graph client
└── soap/                    node-soap wiring, SMAPI handlers, media mapping, faults
test/                        e2e tests against a fake Microsoft identity/Graph server
```
