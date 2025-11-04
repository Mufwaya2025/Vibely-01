const base64Encode = (value: string): string => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value);
  }
  // @ts-ignore
  return Buffer.from(value, 'utf8').toString('base64');
};

const base64Decode = (value: string): string => {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(value);
  }
  try {
    // @ts-ignore
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (err) {
    console.error('Failed to decode base64 string', err);
    return '';
  }
};

export const encryptSecret = (value: string): string => base64Encode(value);

export const decryptSecret = (encrypted: string): string => base64Decode(encrypted);
