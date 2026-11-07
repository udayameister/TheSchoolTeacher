import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="November 2026 (draft)">
      <p>This policy explains how {SITE_NAME} processes personal data under India&rsquo;s Digital Personal Data Protection Act, 2023 (DPDP Act).</p>
      <h2>What we collect and why</h2>
      <ul>
        <li>Account data (name, email, password hash): to run your account.</li>
        <li>Candidate profile and documents: to let you apply to schools and, if you agree, to show match scores and suggest jobs.</li>
        <li>School details (UDISE+ code, affiliation, contacts): to verify schools and show their public profile.</li>
        <li>Security records (sign-ins, masked IP address): to protect accounts.</li>
      </ul>
      <h2>Who sees your data</h2>
      <p>Your documents and contact details are visible only to the schools you apply to (and, if you turn on the discoverable profile, a limited profile without contact details to verified schools). We do not sell personal data.</p>
      <h2>Your rights</h2>
      <p>You can access and download your data, correct it, withdraw consent for matching, and delete your account. Consents are recorded with the date and the version of this policy.</p>
      <h2>Grievances</h2>
      <p>Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. A Grievance Officer will be named here before launch.</p>
    </LegalPage>
  );
}
