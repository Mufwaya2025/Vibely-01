import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerMessagingHandlers } from './messaging/socketManager';
import { lencoConfig } from './config/lencoConfig';

// For serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const port = parseInt(process.env.PORT ?? '4000', 10);
const clientOrigin = process.env.CLIENT_ORIGIN ?? '';
const jsonLimit = process.env.JSON_BODY_LIMIT ?? '1mb';

const allowedOrigins = clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOrigins.length === 0;
if (process.env.NODE_ENV === 'production' && allowAnyOrigin) {
  console.error('[server] CLIENT_ORIGIN is required in production');
  process.exit(1);
}
const allowedOriginsSet = new Set(allowedOrigins);

const isLocalhostOrigin = (origin: string | undefined): origin is string => {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin or server-to-server calls (no origin)
      if (!origin) return callback(null, true);
      if (allowedOriginsSet.has(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
// Raw body for payment webhooks (must be before express.json)
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true }));

const unique = (values: (string | undefined | null)[]) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const resolveOrigin = (url: string | undefined) => {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

const lencoWidgetOrigins = unique([
  'https://pay.lenco.co',
  'https://pay.sandbox.lenco.co',
  resolveOrigin(lencoConfig.widgetUrl),
]);

const lencoApiOrigins = unique([
  'https://api.lenco.co',
  'https://api.sandbox.lenco.co',
  resolveOrigin(lencoConfig.apiBase),
]);

// Set Content Security Policy header for security (disabled in production; Nginx owns CSP there)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_NODE_CSP === 'true') {
  app.use((_req, res, next) => {
    const connectSources = [
      "'self'",
      'https://vibelyapp.live:4000',
      'http://localhost:4000',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://accounts.google.com',
      'https://www.gstatic.com',
      ...lencoWidgetOrigins,
      ...lencoApiOrigins,
      'https://tile.openstreetmap.org',
      'https://*.tile.openstreetmap.org',
      'https://www.openstreetmap.org',
      'https://embed.tawk.to',
      'https://tawk.to',
      'https://*.tawk.to',
      'https://pay.lenco.co',
      'https://static.cloudflareinsights.com',
      'https://static.cloudflare.com',
      'https://cdnjs.cloudflare.com',
      'https://*.cloudflare.com',
      'wss://vibelyapp.live',
    ].join(' ');

    const scriptSources = [
      "'self'",
      "'unsafe-inline'",
      'translate.googleapis.com',
      'translate.google.com',
      'www.google.com',
      'www.gstatic.com',
      'chrome-extension://bfdogplmndidlpjfhoijckpakkdjkkil/',
      'https://accounts.google.com/gsi/client',
      'https://accounts.google.com',
      'https://pay.lenco.co',
      'https://pay.sandbox.lenco.co',
      'https://embed.tawk.to',
      'https://tawk.to',
      'https://va.tawk.to',
      'https://*.tawk.to',
      'https://static.cloudflareinsights.com',
      'https://cdnjs.cloudflare.com',
      'https://*.cloudflare.com',
      ...lencoWidgetOrigins,
    ].join(' ');

    const frameSources = [
      "'self'",
      'https://accounts.google.com',
      'https://embed.tawk.to',
      'https://tawk.to',
      'https://*.tawk.to',
      ...lencoWidgetOrigins,
    ].join(' ');

    const cspHeader =
      "default-src 'self'; " +
      `script-src ${scriptSources}; ` +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://accounts.google.com/gsi/style; " +
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://accounts.google.com/gsi/style; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      `connect-src ${connectSources}; ` +
      "media-src 'self' blob:; " +
      `frame-src ${frameSources}; ` +
      "object-src 'none'; " +
      "base-uri 'self';";

    res.setHeader('Content-Security-Policy', cspHeader);
    next();
  });
}

// Serve static files from the dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../dist')));
}

// Initialize Socket.IO
const devSocketOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const socketOrigins = process.env.NODE_ENV !== 'production'
  ? [...allowedOrigins, ...devSocketOrigins]
  : allowedOrigins;

const io = new Server(httpServer, {
  cors: {
    origin: socketOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

registerMessagingHandlers(io);

import { attachUser } from './middleware/attachUser';
import { enforceActiveUser } from './middleware/enforceActiveUser';
import { registerRoutes } from './routes';
import { deviceAuthRateLimiter, ticketScanRateLimiter } from './middleware/rateLimit';
import { scannerCors } from './middleware/cors';

// Apply rate limiting and CORS for specific routes
app.use('/api/devices/authorize', deviceAuthRateLimiter);
app.use('/api/tickets/scan-secure', ticketScanRateLimiter);
app.use('/api/devices', scannerCors);
app.use('/api/tickets/scan-secure', scannerCors);

app.use(attachUser);
app.use(enforceActiveUser);
registerRoutes(app);

// In production, serve the index.html file for any route that doesn't match an API endpoint
if (process.env.NODE_ENV === 'production') {
  app.get('/*splat', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist/index.html'));
  });
} else {
  // In development, return JSON for unmatched routes
  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });
}

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
);

httpServer.listen(port, () => {
  console.log(`[server] listening on port ${port}`);
});
