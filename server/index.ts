import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// For serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = parseInt(process.env.PORT ?? '4000', 10);
const clientOrigin = process.env.CLIENT_ORIGIN ?? '*';
const jsonLimit = process.env.JSON_BODY_LIMIT ?? '1mb';

const allowedOrigins = clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      allowedOrigins.length === 0 || allowedOrigins.includes('*')
        ? true
        : allowedOrigins,
  })
);
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../dist')));
}

import { attachUser } from './middleware/attachUser';
import { registerRoutes } from './routes';

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

app.listen(port, () => {
  console.log(`[server] listening on port ${port}`);
});
