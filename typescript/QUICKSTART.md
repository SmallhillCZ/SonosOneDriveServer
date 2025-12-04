# Quick Start Guide - TypeScript/NestJS Version

## Prerequisites
- Node.js 18+ and npm
- Microsoft Azure App Registration (for GRAPH_CLIENT_ID)

## Option 1: Docker (Recommended)

1. **Create environment file:**
   ```bash
   cd typescript
   cp .env.example .env
   ```

2. **Edit `.env` and add your Microsoft Graph Client ID:**
   ```env
   GRAPH_CLIENT_ID=your_microsoft_app_client_id_here
   ```

3. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Check health:**
   ```bash
   curl http://localhost:3000/health
   ```

## Option 2: Local Development

1. **Install dependencies:**
   ```bash
   cd typescript
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your credentials:**
   ```env
   GRAPH_CLIENT_ID=your_microsoft_app_client_id_here
   PORT=3000
   ```

4. **Start development server:**
   ```bash
   npm run start:dev
   ```

5. **Application is running at:**
   ```
   http://localhost:3000
   ```

## Verify Installation

Visit these endpoints to verify everything works:

- **Health Check**: http://localhost:3000/health
- **Root Info**: http://localhost:3000/
- **WSDL**: http://localhost:3000/wsdl

## Next Steps

1. **Add to Sonos:**
   - Use the hosted version or deploy your own
   - Configure in Sonos app using the service URL

2. **Deploy to Production:**
   - See README.md for Heroku, Google Cloud Run, or other deployment options

3. **Monitor:**
   - Check logs: `docker-compose logs -f` (Docker)
   - Or check console output (local dev)

## Troubleshooting

### Port already in use
Change the PORT in your `.env` file:
```env
PORT=3001
```

### Missing GRAPH_CLIENT_ID
Make sure you:
1. Created a Microsoft Azure App Registration
2. Set the GRAPH_CLIENT_ID environment variable

### Docker issues
Rebuild the container:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Support

- See README.md for full documentation
- See MIGRATION.md for comparison with Java version
- See SUMMARY.md for complete feature list
