import type { ImportSourceKind } from '@/types';

/*
 * Official recruitment pages offered as one-click sources on Admin → Job import. Each one is added
 * switched OFF and marked "verify": the administrator opens the address, checks that it is the official page
 * that lists teacher recruitment notices (sites are reorganised often), then switches it on.
 * Addresses checked against public references in November 2026; listed in docs/VERIFY_BEFORE_LAUNCH.md.
 */
export interface SuggestedSource { name: string; url: string; kind: ImportSourceKind; orgName: string; stateCode?: string; note: string }

export const SUGGESTED_SOURCES: SuggestedSource[] = [
  { name: 'NVS – Notification / Vacancies', url: 'https://www.navodaya.gov.in/nvs/en/Recruitment/Notification-Vacancies', kind: 'govt_page', orgName: 'Navodaya Vidyalaya Samiti', note: 'Recruitment notifications page of navodaya.gov.in.' },
  { name: 'KVS – official website', url: 'https://kvsangathan.nic.in/', kind: 'govt_page', orgName: 'Kendriya Vidyalaya Sangathan', note: 'Home page; replace with the Recruitment / Employment Notices page once checked.' },
  { name: 'CBSE – KVS / NVS recruitment notices', url: 'https://www.cbse.gov.in/', kind: 'govt_page', orgName: 'Central Board of Secondary Education (for KVS / NVS)', note: 'CBSE ran the combined KVS–NVS teacher recruitment in 2025.' },
  { name: 'AWES – Army Public Schools', url: 'https://www.awesindia.com/', kind: 'govt_page', orgName: 'Army Welfare Education Society', note: 'Teacher recruitment for Army Public Schools (PGT / TGT / PRT).' },
  { name: 'Tamil Nadu TRB – notifications', url: 'https://www.trb.tn.gov.in/', kind: 'govt_page', orgName: 'Teachers Recruitment Board, Tamil Nadu', stateCode: 'TN', note: 'Home page lists notifications (TRB recruitments and TNTET).' },
  { name: 'Bihar BPSC – school teacher recruitment', url: 'https://bpsc.bihar.gov.in/', kind: 'govt_page', orgName: 'Bihar Public Service Commission', stateCode: 'BR', note: 'BPSC runs the TRE school-teacher recruitment; many other notices are filtered out.' },
  { name: 'Andhra Pradesh – DSC portal', url: 'https://apdsc.apcfss.in/', kind: 'govt_page', orgName: 'Commissioner of School Education, Andhra Pradesh', stateCode: 'AP', note: 'AP DSC (Teacher Recruitment Test) notifications; also see cse.ap.gov.in.' },
];
