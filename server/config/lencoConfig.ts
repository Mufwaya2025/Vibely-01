import 'dotenv/config';
import { paymentConfigStore } from '../storage/paymentConfigStore';
import { decryptSecret } from '../../utils/encryption';

// Determine environment with fallback to admin-configured live/sandbox mode
const envFlag = (process.env.LENCO_ENV || process.env.NODE_ENV || 'production').toLowerCase();
const persistedConfig = (() => {
  try {
    return paymentConfigStore.getLatest();
  } catch {
    return null;
  }
})();

const effectiveEnv = (() => {
  if (process.env.LENCO_ENV) return envFlag; // explicit override
  if (persistedConfig) {
    return persistedConfig.isLiveMode ? 'production' : 'sandbox';
  }
  return envFlag;
})();

const DEFAULT_API_BASE = 'https://api.lenco.co/access/v2';
const DEFAULT_WIDGET_URL = 'https://pay.lenco.co/js/v1/inline.js';
const SANDBOX_API_BASE = 'https://api.sandbox.lenco.co/access/v2';
const SANDBOX_WIDGET_URL = 'https://pay.sandbox.lenco.co/js/v1/inline.js';

const resolvedApiBase =
  process.env.LENCO_API_BASE ||
  (effectiveEnv === 'sandbox' || effectiveEnv === 'development' ? SANDBOX_API_BASE : DEFAULT_API_BASE);

const resolvedWidgetUrl =
  process.env.LENCO_WIDGET_URL ||
  (effectiveEnv === 'sandbox' || effectiveEnv === 'development'
    ? SANDBOX_WIDGET_URL
    : DEFAULT_WIDGET_URL);

const resolveMockMode = () => (process.env.LENCO_USE_MOCK_GATEWAY ?? '').toLowerCase() === 'true';

const envPublicKey = (process.env.LENCO_PUBLIC_KEY || '').trim();
const envSecretKey = (process.env.LENCO_SECRET_KEY || '').trim();
const persistedPublicKey = (persistedConfig?.publicKey || '').trim();
const persistedSecretKey = decryptSecret(persistedConfig?.secretKeyEncrypted || '').trim();

export const lencoConfig = {
  publicKey: envPublicKey || persistedPublicKey,
  secretKey: envSecretKey || persistedSecretKey,
  apiBase: resolvedApiBase.replace(/\/$/, ''),
  widgetUrl: resolvedWidgetUrl,
  currency: 'ZMW',
  locale: 'zm',
  withdrawSourceAccountId: process.env.LENCO_WITHDRAW_SOURCE_ACCOUNT_ID || '',
  environment: effectiveEnv === 'sandbox' || effectiveEnv === 'development' ? 'sandbox' : 'production',
  mockMode: resolveMockMode(),
};

export const isLencoConfigured = () =>
  lencoConfig.mockMode || Boolean(lencoConfig.publicKey && lencoConfig.secretKey);

export const getLencoWidgetUrl = () => lencoConfig.widgetUrl;
