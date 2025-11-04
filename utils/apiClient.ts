import type { User } from '../types';

type QueryValue = string | number | boolean | undefined | null;

interface ApiFetchOptions {
  method?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  user?: User | null;
}

const baseFromEnv = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
const API_BASE =
  typeof baseFromEnv === 'string' && baseFromEnv.length > 0
    ? baseFromEnv.replace(/\/$/, '')
    : '';

const buildUrl = (path: string, query?: Record<string, QueryValue>): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const searchParams = new URLSearchParams();

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      searchParams.append(key, String(value));
    });
  }

  const queryString = searchParams.toString();
  return `${API_BASE}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
};

export const apiFetch = async (
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> => {
  const { method = 'GET', body, headers = {}, query, user } = options;
  const url = buildUrl(path, query);

  const fetchHeaders = new Headers(headers);
  if (!fetchHeaders.has('Accept')) {
    fetchHeaders.set('Accept', 'application/json, text/plain;q=0.9, */*;q=0.1');
  }
  if (user) {
    fetchHeaders.set('x-user-id', user.id);
  }

  const init: RequestInit = {
    method,
    headers: fetchHeaders,
  };

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (!fetchHeaders.has('Content-Type')) {
      fetchHeaders.set('Content-Type', 'application/json');
    }
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return fetch(url, init);
};

export const apiFetchJson = async <T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> => {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const message = errorText || response.statusText || 'Request failed';
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};
