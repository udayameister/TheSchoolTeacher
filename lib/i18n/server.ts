import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { makeT } from './translate';

/** The visitor's language: the saved choice, else the browser's preference (Hindi or English). */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accept = (await headers()).get('accept-language') || '';
  return /^hi\b/i.test(accept.trim()) ? 'hi' : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
