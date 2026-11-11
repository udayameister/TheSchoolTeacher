import { withDb } from '@/lib/server/db';
import { listMaster } from '@/lib/server/masterData';
import { SUGGESTED_SOURCES } from '@/lib/importSuggestions';
import SourceManager from '@/components/admin/SourceManager';

export const metadata = { title: 'Import sources' };

export default async function SourcesPage() {
  const d = await withDb(db => ({
    sources: [...db.importSources].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
      .map(s => ({ ...s, waiting: db.importItems.filter(i => i.sourceId === s.id && i.status === 'new').length })),
    states: listMaster(db, 'states').map(s => ({ id: s.id, name: s.name })),
    taken: new Set(db.importSources.map(s => s.url)),
  }));
  const suggestions = SUGGESTED_SOURCES.map((s, index) => ({ ...s, index, added: d.taken.has(new URL(s.url).toString()) }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Import sources</h1>
        <p className="text-ink-soft">Pages and feeds the importer reads to find teacher vacancies. Active sources are checked automatically when due (every few hours, 5 at a time). The importer identifies itself, follows each site&apos;s robots.txt and reads only public pages; it keeps the link, its text and a few words around it for your review, never the full text.</p>
      </div>
      <ul className="space-y-1 text-sm text-ink-soft">
        <li><span className="font-semibold text-ink">Government page</span>: an official recruitment / notices page (KVS, NVS, state DSC / TRB). Only links mentioning teaching posts are kept. Listings become &ldquo;Government notices&rdquo;.</li>
        <li><span className="font-semibold text-ink">School careers page</span>: a school&apos;s own vacancies page. Any job-like link on the same site is kept. Listings are shown as external vacancies with a link to the school&apos;s site.</li>
        <li><span className="font-semibold text-ink">Feed</span>: an RSS or Atom feed (e.g. a board&apos;s notices feed).</li>
      </ul>
      <p className="hint">Do not add commercial job portals: most forbid automated reading in their terms. Use official sources and schools&apos; own pages.</p>
      <SourceManager sources={d.sources} states={d.states} suggestions={suggestions} />
    </div>
  );
}
