/* Site-wide settings (adapted from AcadeXMatch lib/site.ts). */
export const SITE_NAME = 'TheSchoolTeacher';
export const SITE_URL = (process.env.SITE_URL || process.env.APP_URL || 'https://www.theschoolteacher.in').replace(/\/$/, '');
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'info@theschoolteacher.in';
export const COMPANY_CREDIT = { name: 'UKQAAI Technologies', url: 'https://www.ukqaai.com', label: 'www.ukqaai.com' };

/** Version labels of the legal texts a person consents to (bump when the text changes; consent is recorded per version). */
export const TERMS_VERSION = '2026-11-draft';
export const PRIVACY_VERSION = '2026-11-draft';

/** Routes that must never appear in search results (also sent as X-Robots-Tag, see next.config.mjs). */
export const PRIVATE_PREFIXES = ['/admin', '/candidate', '/school', '/account', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/api'];

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
