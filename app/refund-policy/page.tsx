import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Refund policy', alternates: { canonical: '/refund-policy' } };

export default function Refund() {
  return (
    <LegalPage title="Refund policy" updated="November 2026 (draft)">
      <p>Candidates never pay. This policy covers school subscriptions and paid event listings, which open in a later release.</p>
      <p>The refund terms (cancellation window, pro-rata rules, processing time through Razorpay) will be set by the administrator and published here before payments go live.</p>
      <p>Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
