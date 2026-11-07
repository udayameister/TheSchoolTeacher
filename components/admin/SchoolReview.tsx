'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/clientApi';

/** Approve / reject (reason required) / send back to pending. The school's administrators get an email. */
export default function SchoolReview({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const decide = async (decision: string) => {
    if (decision === 'rejected' && note.trim().length < 5) { setMsg('Write a reason for the school first.'); return; }
    if (decision === 'verified' && !window.confirm('Mark this school as verified? It can then publish vacancies.')) return;
    const r = await api('/api/admin/schools', { schoolId: id, decision, note });
    if (r.ok) router.refresh(); else setMsg(r.error || 'Failed.');
  };
  return (
    <div className="space-y-2">
      <label className="block"><span className="label">Note / reason (sent to the school when rejecting)</span>
        <textarea className="input min-h-[70px]" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. The UDISE+ code belongs to a different school. Please check and resubmit." /></label>
      <div className="flex flex-wrap gap-2">
        {status !== 'verified' && <button type="button" className="btn-primary" onClick={() => decide('verified')}>Verify</button>}
        {status !== 'rejected' && <button type="button" className="btn-danger" onClick={() => decide('rejected')}>Reject</button>}
        {status !== 'pending' && <button type="button" className="btn-ghost" onClick={() => decide('pending')}>Back to pending</button>}
      </div>
      {msg && <p role="alert" className="alert-error">{msg}</p>}
    </div>
  );
}
