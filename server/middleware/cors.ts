import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';

// List of trusted scanner app origins
const TRUSTED_ORIGINS = [
  process.env.SCANNER_APP_ORIGIN || 'https://scanner.vibely.com',
  'http://localhost:3001', // For development
  'capacitor://localhost',  // For Capacitor apps
  'ionic://localhost',      // For Ionic apps
  'http://localhost'        // For local development
];

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, origin?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    if (TRUSTED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

export const scannerCors = cors(corsOptions);