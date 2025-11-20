import cors from 'cors';

// Build list of trusted scanner app origins
const EXTRA_ORIGINS = process.env.SCANNER_APP_ORIGINS
  ? process.env.SCANNER_APP_ORIGINS.split(',')
      .map(o => o.trim())
      .filter(Boolean)
  : [];

const TRUSTED_ORIGINS = [
  ...EXTRA_ORIGINS,
  process.env.SCANNER_APP_ORIGIN || 'https://scanner.vibelyapp.live',

  // Main Vibely web app
  'https://vibelyapp.live',
  'https://www.vibelyapp.live',

  // Scanner preview / direct IP (if used)
  'http://46.62.231.109:4001',

  // Local dev
  'http://localhost:5173', // Vite dev (scanner)
  'http://localhost:3000', // CRA dev
  'http://localhost:3001', // Additional dev
  'capacitor://localhost', // Capacitor apps
  'ionic://localhost',     // Ionic apps
  'http://localhost',      // Generic local
];

export const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Exact match first
    if (TRUSTED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Optionally allow any subdomain of vibelyapp.live
    try {
      const url = new URL(origin);
      if (url.hostname === 'vibelyapp.live' || url.hostname.endsWith('.vibelyapp.live')) {
        return callback(null, true);
      }
    } catch {
      // If origin is not a valid URL, just fall through
    }

    // ❗ Important: do NOT throw an error here.
    // Returning `false` means "no CORS headers for this origin"
    // which will make the browser block cross-origin calls,
    // but it won't crash the server with a 500.
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export const scannerCors = cors(corsOptions);
