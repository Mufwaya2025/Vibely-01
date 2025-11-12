import type { NextFunction, Request, Response } from 'express';
import type { UserStatus } from '../../types';

const STATUS_MESSAGES: Record<UserStatus, string> = {
  active: '',
  suspended: 'Your account has been suspended. Please contact support for assistance.',
  onboarding: 'Your account is still being set up. Please wait for an administrator to activate it.',
};

export const enforceActiveUser = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user) {
    next();
    return;
  }

  if (user.status === 'active') {
    next();
    return;
  }

  const message = STATUS_MESSAGES[user.status] || 'Your account is not active.';
  const statusCode = user.status === 'suspended' ? 423 : 403;
  res.status(statusCode).json({ message, status: user.status });
};
