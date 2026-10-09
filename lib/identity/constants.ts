export const SIGN_IN_TTL_MS = 15 * 60 * 1000;
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const LIVE_TOKEN_CAP = 3;
export const LINK_EMAIL_LIMIT = 5;
export const LINK_IP_LIMIT = 20;
export const GLOBAL_DAILY_CAP = 500;
export const EMAIL_SEND_CAP_TAG = 'email_send_cap';
export const LINK_NONCE_COOKIE = 'rah_link_nonce';

export type LinkPurpose = 'sign_in' | 'verify_email';
export type Locale = 'en' | 'de';
