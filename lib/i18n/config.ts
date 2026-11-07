/*
 * Interface languages. To add a language (e.g. Tamil): add its code here, add messages/<code>.json
 * with the same keys as messages/en.json (the test "i18n" checks this), and add its name to LOCALE_NAMES.
 * Missing keys fall back to English, so a partial translation never breaks a page.
 */
export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'tst_lang';
/** Each language's own name, shown in the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', hi: 'हिन्दी' };
/** BCP-47 tags for <html lang> and dates. */
export const LOCALE_TAGS: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN' };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}
