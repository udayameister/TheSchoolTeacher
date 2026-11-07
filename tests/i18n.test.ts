import { describe, eq, it, ok } from './harness';
import en from '@/messages/en.json';
import hi from '@/messages/hi.json';
import { makeT } from '@/lib/i18n/translate';

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ''): Record<string, string> => Object.entries(t).reduce<Record<string, string>>((m, [k, v]) =>
  ({ ...m, ...(typeof v === 'string' ? { [p + k]: v } : flat(v, `${p}${k}.`)) }), {});
const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

describe('i18n', () => {
  const E = flat(en as Tree), H = flat(hi as Tree);
  it('Hindi has every English key and no extra keys', () => {
    const missing = Object.keys(E).filter(k => !(k in H));
    const extra = Object.keys(H).filter(k => !(k in E));
    eq(missing, []);
    eq(extra, []);
  });
  it('placeholders match in every translation', () => {
    const bad = Object.keys(E).filter(k => k in H && placeholders(E[k]) !== placeholders(H[k]));
    eq(bad, []);
  });
  it('translates with variables and falls back to English, then the key', () => {
    eq(makeT('en')('auth.resendIn', { s: 30 }), 'You can ask for a new code in 30 seconds.');
    ok(makeT('hi')('nav.signIn') !== makeT('en')('nav.signIn'));
    eq(makeT('hi')('no.such.key'), 'no.such.key');
  });
});
