import { redirect } from 'next/navigation';
import type { UserAccount } from '@/types';
import { requireRole } from './http';
import { can, type Perm } from './team';

/** For school console pages: signed in as school staff with the permission, otherwise back to the dashboard. */
export async function requireSchoolPerm(perm: Perm | null, path: string): Promise<UserAccount> {
  const user = await requireRole(['school_admin', 'school_staff'], path);
  if (perm && !can(user, perm)) redirect('/school');
  return user;
}

/** Tabs of the school console this user may open. */
export function schoolTabs(user: UserAccount): string[] {
  return [
    'dashboard', ...(can(user, 'jobs') ? ['jobs'] : []), 'applicants', ...(can(user, 'interviews') ? ['interviews'] : []),
    ...(can(user, 'talent') ? ['talent'] : []), ...(can(user, 'offers') ? ['offers'] : []), ...(can(user, 'reports') ? ['reports'] : []),
    ...(can(user, 'team') ? ['team'] : []), 'profile',
  ];
}
