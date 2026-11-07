'use client';
import { useState } from 'react';
import { api } from '@/lib/clientApi';

export default function SignOutButton({ label, className = 'btn-ghost' }: { label: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={className} disabled={busy} onClick={async () => {
      setBusy(true);
      await api('/api/auth/logout', {});
      window.location.href = '/';
    }}>{label}</button>
  );
}
