# Sonos OneDrive Server - TypeScript/NestJS

This is a TypeScript/NestJS rewrite of the Sonos OneDrive Service that allows you to play music stored on OneDrive through your Sonos system.

## Features

- Built with **NestJS** framework for better architecture and maintainability
- Written in **TypeScript** for type safety
- Uses **Axios** for HTTP requests
- Integrates with **Microsoft Graph API** using official SDK
- SOAP service implementation for Sonos integration

## Prerequisites

- Node.js 18+ and npm
- [Microsoft app registration](https://docs.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/app-registration?view=odsp-graph-online)

## Installation

```bash
# Install dependencies
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure your environment variables:
```env
GRAPH_CLIENT_ID=your_microsoft_app_client_id
PORT=3000
```

## Development

```bash
# Run in development mode with hot reload
npm run start:dev

# Run in debug mode
npm run start:debug
```

## Production

```bash
# Build the application
npm run build

# Run the built application
npm run start:prod
```

## Project Structure

```
typescript/
├── src/
│   ├── config/          # Configuration and constants
│   ├── controllers/     # NestJS controllers (SOAP endpoints)
│   ├── services/        # Business logic services
│   ├── models/          # Data models and DTOs
│   ├── app.module.ts    # Main application module
│   └── main.ts          # Application entry point
├── resources/
│   └── wsdl/           # WSDL files for SOAP services
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## API Endpoints

- `POST /soap` - SOAP endpoint for Sonos integration
- `GET /wsdl` - WSDL file for service description

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GRAPH_CLIENT_ID` | Microsoft Graph API client ID | Required |
| `PORT` | Server port | 3000 |
| `GRAPH_API_URI` | Microsoft Graph API base URL | https://graph.microsoft.com/v1.0/ |
| `AUTH_API_URI` | Microsoft Auth API base URL | https://login.microsoftonline.com/common/oauth2/v2.0/ |

## Docker

### Using Docker Compose (Recommended)

1. Create a `.env` file with your configuration:
```env
GRAPH_CLIENT_ID=your_microsoft_app_client_id
```

2. Run with Docker Compose:
```bash
docker-compose up -d
```

### Using Docker directly

Build and run with Docker:

```bash
# Build the image
docker build -t sonos-onedrive-server .

# Run the container
docker run -p 3000:3000 -e GRAPH_CLIENT_ID=your_client_id sonos-onedrive-server
```

## Deployment

### Heroku

1. Create a new Heroku app:
```bash
heroku create your-app-name
```

2. Set environment variables:
```bash
heroku config:set GRAPH_CLIENT_ID=your_client_id
```

3. Deploy:
```bash
git subtree push --prefix typescript heroku main
```

### Google Cloud Run

1. Build the container:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/sonos-onedrive
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy sonos-onedrive \
  --image gcr.io/PROJECT_ID/sonos-onedrive \
  --platform managed \
  --set-env-vars GRAPH_CLIENT_ID=your_client_id
```

## Architecture

The application follows NestJS best practices:

- **Controllers**: Handle HTTP/SOAP requests
- **Services**: Contain business logic and external API integrations
- **Models**: Define data structures
- **Config**: Centralized configuration management

### Key Components

1. **OneDriveService**: Handles all Microsoft Graph API interactions including:
   - Device authentication flow
   - Token management and refresh
   - File and folder operations
   - Search functionality

2. **SonosController**: Implements SOAP endpoints for Sonos integration:
   - Media metadata retrieval
   - Media URI generation
   - Search functionality
   - Authentication flow

## License

ISC

## Original Java Version

This is a TypeScript rewrite of the original Java/Spring implementation. The original version can be found in the parent directory.
