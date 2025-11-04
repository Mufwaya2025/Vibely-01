import type { NextFunction, Request, Response } from 'express';
import { db } from '../../api/db';

const USER_HEADER = 'x-user-id';

export const attachUser = (req: Request, _res: Response, next: NextFunction) => {
  const userId = req.header(USER_HEADER);
  if (userId) {
    req.user = db.users.findById(userId) ?? null;
  } else {
    req.user = null;
  }
  next();
};
