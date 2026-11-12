import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';
import { withDb } from '@/lib/server/db';
import { publicJobs } from '@/lib/server/catalog';
import { publicSchools } from '@/lib/server/publicSchools';
import { isPast } from '@/lib/jobs/dates';

export const dynamic = 'force-dynamic';

/** Static pages, open vacancies and verified schools (SEO landing pages are added in Phase 6). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = ['/', '/jobs', '/schools', '/for-schools', '/career', '/career/interview', '/career/tet', '/career/salary', '/about', '/terms', '/privacy', '/refund-policy', '/contact']
    .map(p => ({ url: absoluteUrl(p), changeFrequency: p === '/' || p === '/jobs' ? 'daily' : 'monthly' }));
  const dyn = await withDb(db => [
    ...publicJobs(db).filter(j => j.status === 'published' && !isPast(j.lastDate)).map(j => ({ url: absoluteUrl(`/jobs/${j.id}`), lastModified: j.updatedAt, changeFrequency: 'weekly' as const })),
    ...publicSchools(db).map(s => ({ url: absoluteUrl(`/schools/${s.slug}`), lastModified: s.updatedAt || s.createdAt, changeFrequency: 'weekly' as const })),
  ]).catch(() => []);
  return [...statics, ...dyn];
}
