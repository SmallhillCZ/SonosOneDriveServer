import express, { Request } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';

export interface FakeMicrosoft {
  url: string;
  requests: Request[];
  graph: Map<string, { status: number; body: unknown }>;
  token: { status: number; body: unknown };
  close(): Promise<void>;
}

export async function startFakeMicrosoft(): Promise<FakeMicrosoft> {
  const app = express();
  const fake = {
    requests: [] as Request[],
    graph: new Map<string, { status: number; body: unknown }>(),
    token: { status: 200, body: { access_token: 'new-access', refresh_token: 'new-refresh' } },
  };

  app.use(express.urlencoded({ extended: false }));
  app.use((req, _res, next) => {
    fake.requests.push(req);
    next();
  });
  app.post('/auth/devicecode', (_req, res) => {
    res.json({ user_code: 'ABC123', verification_uri: 'https://microsoft.com/devicelogin', device_code: 'dev-code' });
  });
  app.post('/auth/token', (_req, res) => {
    res.status(fake.token.status).json(fake.token.body);
  });
  app.get(/^\/graph(\/.*)$/, (req, res) => {
    const response = fake.graph.get(decodeURIComponent(req.params[0]));
    if (!response) {
      res.status(404).json({ error: { code: 'itemNotFound' } });
      return;
    }
    res.status(response.status).json(response.body);
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  return {
    ...fake,
    get token() {
      return fake.token;
    },
    set token(value) {
      fake.token = value;
    },
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
