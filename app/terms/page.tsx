import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="November 2026 (draft)">
      <p>These terms govern your use of {SITE_NAME} (www.theschoolteacher.in), operated by UKQAAI Technologies. By creating an account you agree to them.</p>
      <h2>1. The service</h2>
      <p>{SITE_NAME} connects teachers and teaching aspirants with schools in India. It is not an employer, a recruitment agency acting for any government, or a recruiting authority. Government recruitment notices are shown for information with a link to the official notification; you apply on the official website.</p>
      <h2>2. Accounts</h2>
      <ul><li>Give accurate information and keep your password secret.</li><li>School accounts may post vacancies only after we verify the school.</li><li>We may suspend accounts that post false information, misuse candidate data or break the law.</li></ul>
      <h2>3. Candidates</h2>
      <p>All candidate features are free. You are responsible for the documents and details you share. Schools, not {SITE_NAME}, decide whom they shortlist and hire.</p>
      <h2>4. Schools</h2>
      <p>Schools must post genuine vacancies, follow applicable law on recruitment and child safety, and use candidate data only for the vacancy the candidate applied to. Paid plans are described on the pricing page and in the Refund policy.</p>
      <h2>5. Contact</h2>
      <p>Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
