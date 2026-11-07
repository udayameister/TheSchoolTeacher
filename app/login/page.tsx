import type { Metadata } from 'next';
import LoginForm from './LoginForm';
import { googleConfigured } from '@/lib/server/oidc';
import { safeNext } from '@/lib/server/security';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; oauth_error?: string }> }) {
  const q = await searchParams;
  return <LoginForm google={googleConfigured()} next={safeNext(q.next)} oauthError={q.oauth_error ?? null} />;
}
