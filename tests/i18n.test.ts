import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
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


function files(dir: string): string[] {
  return readdirSync(dir).flatMap(f => { const p = path.join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []; });
}

describe('i18n keys used in code', () => {
  it('every literal translation key used in app/, components/ and lib/ exists in English', () => {
    const E = flat(en as Tree);
    const used = new Set<string>();
    for (const f of [...files('app'), ...files('components'), ...files('lib')]) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/\bt\(\s*['"]([a-zA-Z]+\.[a-zA-Z0-9_.]+)['"]/g)) used.add(m[1]);
      for (const m of s.matchAll(/'((?:match|apply|profile|tracker|alerts|jobs|privacy)\.(?:err|need)?[a-zA-Z]+)'/g)) if (/^(match\.[a-z]|apply\.err|profile\.need|tracker\.err|alerts\.err|jobs\.err|privacy\.err)/.test(m[1])) used.add(m[1]);
    }
    eq([...used].filter(k => !(k in E)).sort(), []);
  });
});
