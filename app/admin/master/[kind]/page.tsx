import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KIND_MAP, isMasterKind } from '@/lib/masterData/kinds';
import MasterEditor from '@/components/admin/MasterEditor';

export default async function MasterKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isMasterKind(kind)) notFound();
  const def = KIND_MAP[kind];
  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/admin/master">← Master data</Link></p>
      <div>
        <h1 className="text-2xl font-bold">{def.label}</h1>
        <p className="mt-1 text-ink-soft">{def.description}</p>
      </div>
      <MasterEditor def={def} />
    </div>
  );
}
