import en from '@/messages/en.json';
import hi from '@/messages/hi.json';
import type { Locale } from './config';

export type Messages = typeof en;
type Tree = { [k: string]: string | Tree };

export const MESSAGES: Record<Locale, Tree> = { en, hi };

function lookup(tree: Tree, key: string): string | undefined {
  let cur: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (!cur || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Translator for one language: dotted keys, {name} placeholders, English fallback, then the key itself. */
export function makeT(locale: Locale): TFunction {
  return (key, vars) => {
    const s = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.en, key) ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
  };
}

/** Localised name of a master-data item (Hindi name when present). */
export function itemName(item: { name: string; nameHi?: string }, locale: Locale): string {
  return locale === 'hi' && item.nameHi ? item.nameHi : item.name;
}
