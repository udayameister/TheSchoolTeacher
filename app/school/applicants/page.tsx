import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { canSeeApplication } from '@/lib/server/pipeline';
import { can } from '@/lib/server/team';
import { experienceYears } from '@/lib/jobs/match';
import Pipeline, { type PipelineRow } from '@/components/school/Pipeline';
import type { Stage } from '@/types';

export const metadata = { title: 'Applicants' };

export default async function Applicants({ searchParams }: { searchParams: Promise<{ job?: string; stage?: string; q?: string; view?: string; withdrawn?: string }> }) {
  const user = await requireRole(['school_admin', 'school_staff'], '/school/applicants');
  const [{ t }, q] = await Promise.all([getT(), searchParams]);
  const d = await withDb(db => {
    const school = currentSchool(db, user);
    if (!school) return null;
    const jobs = db.jobs.filter(j => j.schoolId === school.id);
    const search = (q.q || '').trim().toLowerCase();
    const rows: PipelineRow[] = db.applications
      .filter(a => a.schoolId === school.id && canSeeApplication(db, user, a) && (!q.job || a.jobId === q.job) && (!q.stage || a.stage === q.stage) && (q.withdrawn === '1' || a.stage !== 'withdrawn'))
      .map(a => {
        const u = db.users.find(x => x.id === a.candidateId);
        const job = jobs.find(j => j.id === a.jobId);
        const p = db.profiles[a.candidateId];
        const flagged = job ? job.screeningQuestions.filter(sq => sq.mustAnswer && a.answers.find(x => x.questionId === sq.id)?.answer !== sq.mustAnswer).length : 0;
        return { id: a.id, name: u?.name || '—', jobId: a.jobId, jobTitle: job?.title || '—', stage: a.stage as Stage, appliedAt: a.appliedAt, match: a.matchScore ?? null, flagged, years: p ? experienceYears(p) : 0 };
      })
      .filter(r => !search || r.name.toLowerCase().includes(search))
      .sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || b.appliedAt.localeCompare(a.appliedAt));
    const visibleJobs = new Set(rows.map(r => r.jobId));
    return { rows, jobs: jobs.filter(j => can(user, 'pipeline') || visibleJobs.has(j.id)).map(j => ({ id: j.id, title: j.title })) };
  });
  if (!d) redirect('/school');
  return (
    <div className="container-page space-y-4 py-6">
      <h1 className="text-2xl font-bold">{t('school.nav_applicants')}</h1>
      <form method="get" className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label><span className="label">{t('jobs.post')}</span>
          <select name="job" className="input" defaultValue={q.job || ''}><option value="">{t('ats.allVacancies')}</option>{d.jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label>
        <label><span className="label">{t('ats.stage')}</span>
          <select name="stage" className="input" defaultValue={q.stage || ''}><option value="">{t('ats.allStages')}</option>{['applied', 'screening', 'eligible', 'shortlisted', 'interview', 'panel_review', 'offer', 'joined', 'not_selected', 'withdrawn'].map(s => <option key={s} value={s}>{t(`stages.${s}`)}</option>)}</select></label>
        <label><span className="label">{t('ats.searchName')}</span><input name="q" className="input" defaultValue={q.q || ''} /></label>
        <input type="hidden" name="view" value={q.view || ''} />
        <button className="btn-ghost">{t('ats.filter')}</button>
        <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" name="withdrawn" value="1" defaultChecked={q.withdrawn === '1'} className="h-5 w-5" />{t('ats.showWithdrawn')}</label>
      </form>
      {!can(user, 'pipeline') && <p className="alert-ok">{t('panel.onlyYourPanels')}</p>}
      <Pipeline rows={d.rows} initialView={q.view === 'list' ? 'list' : 'kanban'} canMove={can(user, 'pipeline')} canInvite={can(user, 'interviews')} />
    </div>
  );
}
