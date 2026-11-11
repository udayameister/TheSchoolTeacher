import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

export const metadata = { title: 'About our job-notice reader (TheSchoolTeacherBot)' };

/** Linked from the importer's User-Agent so site owners can see who is reading their pages and why. */
export default function BotPage() {
  return (
    <div className="container-page max-w-3xl space-y-4 py-8">
      <h1 className="text-2xl font-bold">TheSchoolTeacherBot</h1>
      <p>{SITE_NAME} lists teacher vacancies and official teacher-recruitment notices for schools in India. Our administrators choose a small number of public pages to watch (for example the recruitment notices page of a recruiting body, or a school&apos;s own careers page). TheSchoolTeacherBot reads those pages, usually once a day, to spot new teacher vacancies.</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>It follows <code>robots.txt</code>. To stop it, add <code>User-agent: TheSchoolTeacherBot</code> and <code>Disallow: /</code>.</li>
        <li>It reads public pages only, never logs in, and does not download notification files.</li>
        <li>It keeps only the link, its title and a few words around it, for a person to review. Listings are written by our team in their own words and always link back to the official page or the school&apos;s site to apply.</li>
      </ul>
      <p>Questions or a request to stop: <Link href="/contact">contact us</Link>.</p>
    </div>
  );
}
