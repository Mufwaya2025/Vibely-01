import 'dotenv/config';

const LENCO_ENV = (process.env.LENCO_ENV || process.env.NODE_ENV || 'production').toLowerCase();

const DEFAULT_API_BASE = 'https://api.lenco.co/access/v2';
const DEFAULT_WIDGET_URL = 'https://pay.lenco.co/js/v1/inline.js';
const SANDBOX_API_BASE = 'https://api.sandbox.lenco.co/access/v2';
const SANDBOX_WIDGET_URL = 'https://pay.sandbox.lenco.co/js/v1/inline.js';

const resolvedApiBase =
  process.env.LENCO_API_BASE ||
  (LENCO_ENV === 'sandbox' || LENCO_ENV === 'development' ? SANDBOX_API_BASE : DEFAULT_API_BASE);

const resolvedWidgetUrl =
  process.env.LENCO_WIDGET_URL ||
  (LENCO_ENV === 'sandbox' || LENCO_ENV === 'development'
    ? SANDBOX_WIDGET_URL
    : DEFAULT_WIDGET_URL);

export const lencoConfig = {
  publicKey: process.env.LENCO_PUBLIC_KEY || '',
  secretKey: process.env.LENCO_SECRET_KEY || '',
  apiBase: resolvedApiBase.replace(/\/$/, ''),
  widgetUrl: resolvedWidgetUrl,
  currency: 'ZMW',
  locale: 'zm',
  withdrawSourceAccountId: process.env.LENCO_WITHDRAW_SOURCE_ACCOUNT_ID || '',
  environment: LENCO_ENV === 'sandbox' || LENCO_ENV === 'development' ? 'sandbox' : 'production',
};

export const isLencoConfigured = () =>
  Boolean(lencoConfig.publicKey && lencoConfig.secretKey);

export const getLencoWidgetUrl = () => lencoConfig.widgetUrl;
