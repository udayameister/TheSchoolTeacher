import ResetForm from './ResetForm';

export const metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <ResetForm token={(await searchParams).token || ''} />;
}
