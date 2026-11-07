import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/** Static pages for now; job, school, notice and SEO landing pages are added in Phases 2, 3 and 6. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/jobs', '/for-schools', '/terms', '/privacy', '/refund-policy', '/contact'].map(p => ({ url: absoluteUrl(p), changeFrequency: p === '/' || p === '/jobs' ? 'daily' : 'monthly' }));
}
