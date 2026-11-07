export const metadata = { robots: { index: false } };

export default async function Unsubscribed({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ok = (await searchParams).status === 'ok';
  return (
    <div className="container-page max-w-xl py-16">
      <h1 className="text-2xl font-bold">{ok ? 'You are unsubscribed' : 'This link is not valid'}</h1>
      <p className="mt-2 text-ink-soft">{ok ? 'You will not receive these emails any more. Account security emails are still sent.' : 'Open the unsubscribe link from the most recent email, or change your email preferences in My account.'}</p>
    </div>
  );
}
