'use client';
import { useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  return (
    <AuthCard title={t('auth.forgotTitle')} subtitle={t('auth.forgotText')}>
      {state === 'done' ? <p className="alert-ok" role="status">{t('auth.forgotDone')}</p> : (
        <form className="space-y-4" onSubmit={async e => {
          e.preventDefault(); setState('busy');
          const r = await api('/api/auth/forgot', { email });
          setState(r.ok ? 'done' : 'error');
        }}>
          {state === 'error' && <p role="alert" className="alert-error">{t('common.somethingWrong')}</p>}
          <div>
            <label htmlFor="email" className="label">{t('common.email')}</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={state === 'busy'}>{t('auth.forgotButton')}</button>
        </form>
      )}
    </AuthCard>
  );
}
