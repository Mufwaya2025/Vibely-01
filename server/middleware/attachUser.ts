import type { NextFunction, Request, Response } from 'express';
import { db } from '../../api/db';
import { verifyUserToken } from '../utils/jwt';

const USER_HEADER = 'x-user-id';

export const attachUser = (req: Request, _res: Response, next: NextFunction) => {
  // Preferred: Bearer token
  const auth = req.header('authorization') || req.header('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    const decoded = verifyUserToken(token);
    if (decoded?.sub) {
      req.user = db.users.findById(decoded.sub) ?? null;
      return next();
    }
  }

  // Dev-only fallback via header for local testing
  const allowHeaderUser = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_HEADER_USER !== 'false';
  if (allowHeaderUser) {
    const userId = req.header(USER_HEADER);
    if (userId) {
      req.user = db.users.findById(userId) ?? null;
      return next();
    }
  }

  req.user = null;
  next();
};
