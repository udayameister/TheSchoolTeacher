import { Check, X } from 'lucide-react';
import type { MatchResult } from '@/lib/jobs/match';
import type { TFunction } from '@/lib/i18n/translate';
import { inr } from '@/lib/jobs/display';
import MatchBadge from './MatchBadge';

/** "Why this match?": every part with its weight, what was earned, and the reasons. */
export default function MatchExplain({ m, t }: { m: MatchResult; t: TFunction }) {
  const fmt = (vars?: Record<string, string | number>) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, (k === 'pay' || k === 'want') && typeof v === 'number' ? inr(v) : v]));
  return (
    <section className="card" aria-labelledby="match-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="match-h" className="text-lg font-bold">{t('match.title')}</h2>
        <MatchBadge score={m.score} label={t('match.badge', { score: m.score })} />
      </div>
      {m.capped && <p className="alert-error mt-3">{t('match.capped')}</p>}
      <details className="mt-3" open={m.capped}>
        <summary className="cursor-pointer font-semibold text-brand-700">{t('match.why')}</summary>
        <ul className="mt-3 space-y-3">
          {m.parts.map(p => (
            <li key={p.key}>
              <div className="flex justify-between text-sm font-semibold"><span>{t(`match.part_${p.key}`)}</span><span>{t('match.points', { earned: p.earned, weight: p.weight })}</span></div>
              <div className="mt-1 h-2 rounded-full bg-brand-50" aria-hidden="true"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.round(p.fraction * 100)}%` }} /></div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {p.reasons.map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    {r.ok ? <Check size={16} className="mt-0.5 shrink-0 text-success-700" aria-label={t('match.met')} /> : <X size={16} className="mt-0.5 shrink-0 text-danger-700" aria-label={t('match.notMet')} />}
                    <span>{t(r.key, fmt(r.vars))}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="hint mt-3">{t('match.disclaimer')}</p>
      </details>
    </section>
  );
}
