import type { Metadata } from 'next';
import RegisterForm from './RegisterForm';
import { googleConfigured } from '@/lib/server/oidc';
import { safeNext } from '@/lib/server/security';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const q = await searchParams;
  return <RegisterForm google={googleConfigured()} initialRole={q.role === 'school' ? 'school_admin' : 'candidate'} next={safeNext(q.next)} />;
}
