import type { User } from '../../types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User | null;
  }
}
