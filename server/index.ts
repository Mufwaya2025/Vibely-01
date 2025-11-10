import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerMessagingHandlers } from './messaging/socketManager';

// For serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const port = parseInt(process.env.PORT ?? '4000', 10);
const clientOrigin = process.env.CLIENT_ORIGIN ?? '*';
const jsonLimit = process.env.JSON_BODY_LIMIT ?? '1mb';

const allowedOrigins = clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOrigins.length === 0 || allowedOrigins.includes('*');
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
      if (allowAnyOrigin || !origin) {
        callback(null, true);
        return;
      }
      if (allowedOriginsSet.has(origin) || isLocalhostOrigin(origin)) {
        callback(null, origin);
        return;
      }
      callback(null, false);
    },
    credentials: !allowAnyOrigin,
  })
);
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true }));

// Set Content Security Policy header for security
app.use((req, res, next) => {
  // Define the Content Security Policy
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
    'https://pay.lenco.co',
    'wss://vibelyapp.live',
    'wss:',
    'ws:',
  ].join(' ');

  let cspHeader = 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' translate.googleapis.com translate.google.com www.google.com www.gstatic.com chrome-extension://bfdogplmndidlpjfhoijckpakkdjkkil/ https://pay.lenco.co https://accounts.google.com/gsi/client; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    `connect-src ${connectSources}; ` +
    "media-src 'self' blob:; " +
    "frame-src 'self' https://pay.lenco.co https://accounts.google.com; " +
    "object-src 'none'; " +
    "base-uri 'self';";

  res.setHeader('Content-Security-Policy', cspHeader);
  next();
});

// Serve static files from the dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../dist')));
}

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: allowAnyOrigin ? '*' : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: !allowAnyOrigin,
  },
});

registerMessagingHandlers(io);

import { attachUser } from './middleware/attachUser';
import { registerRoutes } from './routes';
import { deviceAuthRateLimiter, ticketScanRateLimiter } from './middleware/rateLimit';
import { scannerCors } from './middleware/cors';

// Apply rate limiting and CORS for specific routes
app.use('/api/devices/authorize', deviceAuthRateLimiter);
app.use('/api/tickets/scan-secure', ticketScanRateLimiter);
app.use('/api/devices', scannerCors);
app.use('/api/tickets/scan-secure', scannerCors);

app.use(attachUser);
registerRoutes(app);

// In production, serve the index.html file for any route that doesn't match an API endpoint
if (process.env.NODE_ENV === 'production') {
  app.get('/*splat', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist/index.html'));
  });
} else {
  // In development, return JSON for unmatched routes
  app.use((req, res) => {
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
