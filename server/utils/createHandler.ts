import type { Request, RequestHandler } from 'express';
import type { User } from '../../types';
import { sendFetchResponse } from './sendFetchResponse';

type HandlerRequest = {
  body?: any;
  query?: Record<string, any>;
  params?: Record<string, string>;
  headers?: Record<string, string | undefined>;
  user?: User | null;
};

type ApiHandler = (req: HandlerRequest) => Promise<Response> | Response;

const normalizeHeaders = (headers: Request['headers']): Record<string, string | undefined> => {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized[key] = value.join(', ');
    } else if (typeof value === 'string') {
      normalized[key] = value;
    } else {
      normalized[key] = undefined;
    }
  }
  return normalized;
};

export const createHandler = (handler: ApiHandler): RequestHandler => {
  return async (req, res, next) => {
    try {
      const response = await handler({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: normalizeHeaders(req.headers),
        user: req.user ?? null,
      });
      await sendFetchResponse(res, response);
    } catch (err) {
      next(err);
    }
  };
};
