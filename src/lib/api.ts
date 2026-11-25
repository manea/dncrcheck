import {
  assessDncrReadiness,
  buildDncrBriefMarkdown,
  exportCallLogsAuditCsv,
  sanitizeCsvCell,
} from '../core/index.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { withBase } from './basePath.ts';
import type { Locale } from './i18n.ts';

export type ApiMode = 'server' | 'local';

export interface DncrDossierRecord {
  id: number | string;
  profileId: number | string | null;
  dossierCode: string;
  title: string;
  organizationName: string;
  sector: AssessmentInput['sector'];
  carrier: AssessmentInput['carrier'];
  assessmentDate: string;
  status: AssessmentResult['status'];
  readinessScore: number;
  offenseTier: AssessmentInput['offenseTier'];
  estimatedMaxExposureAed: number;
  activeViolationCount: number;
  canonicalText: string;
  dossierSha256: string;
  publicSlug: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  input: AssessmentInput;
  result: AssessmentResult;
}

export interface PublicDncrReport {
  viewCount: number;
  lastViewedAt: string;
  report: {
    dossierCode: string;
    publicSlug: string;
    organizationName: string;
    sector: AssessmentInput['sector'];
    carrier: AssessmentInput['carrier'];
    assessmentDate: string;
    status: AssessmentResult['status'];
    readinessScore: number;
    lockedAt: string;
    dossierSha256: string;
    legalDisclaimerEn: string;
    legalDisclaimerAr: string;
    callingRules: AssessmentResult['callingRules'];
    penalty: AssessmentResult['penalty'];
    briefAr: string;
    briefEn: string;
  };
}

const LS_DOSSIERS = 'dncrcheck.v1.dossiers';
const LS_SEQ = 'dncrcheck.v1.seq';
const LS_VIEWS = 'dncrcheck.v1.views';

function readLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function allocateLocalDossierCode(): string {
  const year = new Date().getUTCFullYear();
  let seqMap: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(LS_SEQ);
    seqMap = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    seqMap = {};
  }
  const next = Number(seqMap[String(year)] ?? 0) + 1;
  seqMap[String(year)] = next;
  localStorage.setItem(LS_SEQ, JSON.stringify(seqMap));
  return `DNC-${year}-${String(next).padStart(4, '0')}`;
}

function makeLocalSlug(dossierCode: string): string {
  return `dncr-${dossierCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const payload = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(payload.message || `HTTP ${res.status}`);
  }
  return payload as T;
}

export async function detectApiMode(): Promise<ApiMode> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1400);
    const res = await fetch(withBase('/health'), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return 'local';
    const data = (await res.json()) as { ok?: boolean; service?: string };
    return data.ok && data.service === 'dncrcheck' ? 'server' : 'local';
  } catch {
    return 'local';
  }
}

export async function listDossiers(mode: ApiMode): Promise<DncrDossierRecord[]> {
  if (mode === 'server') {
    const data = await fetchJson<{ items: DncrDossierRecord[] }>(withBase('/api/dossiers'));
    return data.items;
  }
  return readLocalList<DncrDossierRecord>(LS_DOSSIERS).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function createDossier(
  mode: ApiMode,
  input: AssessmentInput,
  title?: string,
): Promise<DncrDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: DncrDossierRecord }>(withBase('/api/dossiers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input, title }),
    });
    return data.item;
  }
  const result = await assessDncrReadiness(input);
  const dossierCode = allocateLocalDossierCode();
  const now = new Date().toISOString();
  const item: DncrDossierRecord = {
    id: dossierCode,
    profileId: null,
    dossierCode,
    title: title?.trim() || `${input.organizationName} (${input.assessmentDate})`,
    organizationName: input.organizationName,
    sector: input.sector,
    carrier: input.carrier,
    assessmentDate: input.assessmentDate,
    status: result.status,
    readinessScore: result.readinessScore,
    offenseTier: input.offenseTier,
    estimatedMaxExposureAed: result.penalty.estimatedMaxExposureAed,
    activeViolationCount: result.callingRules.activeViolationCount,
    canonicalText: result.canonicalDossierText,
    dossierSha256: result.dossierSha256,
    publicSlug: null,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
    input: structuredClone(input),
    result,
  };
  const all = readLocalList<DncrDossierRecord>(LS_DOSSIERS);
  writeLocalList(LS_DOSSIERS, [item, ...all]);
  return item;
}

export async function updateDossier(
  mode: ApiMode,
  idOrCode: string | number,
  input: AssessmentInput,
  title?: string,
): Promise<DncrDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: DncrDossierRecord }>(
      withBase(`/api/dossiers/${encodeURIComponent(String(idOrCode))}`),
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input, title }),
      },
    );
    return data.item;
  }
  const all = readLocalList<DncrDossierRecord>(LS_DOSSIERS);
  const idx = all.findIndex(
    (d) => d.dossierCode === String(idOrCode) || String(d.id) === String(idOrCode),
  );
  if (idx < 0) throw new Error('Dossier not found.');
  if (all[idx]!.lockedAt) throw new Error('Sealed dossier cannot be modified.');
  const result = await assessDncrReadiness(input);
  const now = new Date().toISOString();
  const updated: DncrDossierRecord = {
    ...all[idx]!,
    title: title?.trim() || all[idx]!.title,
    organizationName: input.organizationName,
    sector: input.sector,
    carrier: input.carrier,
    assessmentDate: input.assessmentDate,
    status: result.status,
    readinessScore: result.readinessScore,
    offenseTier: input.offenseTier,
    estimatedMaxExposureAed: result.penalty.estimatedMaxExposureAed,
    activeViolationCount: result.callingRules.activeViolationCount,
    canonicalText: result.canonicalDossierText,
    dossierSha256: result.dossierSha256,
    updatedAt: now,
    input: structuredClone(input),
    result,
  };
  all[idx] = updated;
  writeLocalList(LS_DOSSIERS, all);
  return updated;
}

export async function duplicateDossier(
  mode: ApiMode,
  idOrCode: string | number,
  title?: string,
): Promise<DncrDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: DncrDossierRecord }>(
      withBase(`/api/dossiers/${encodeURIComponent(String(idOrCode))}/duplicate`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      },
    );
    return data.item;
  }
  const all = readLocalList<DncrDossierRecord>(LS_DOSSIERS);
  const src = all.find(
    (d) => d.dossierCode === String(idOrCode) || String(d.id) === String(idOrCode),
  );
  if (!src) throw new Error('Dossier not found.');
  return createDossier('local', src.input, title?.trim() || `${src.title} (Copy)`);
}

export async function finalizeDossier(
  mode: ApiMode,
  idOrCode: string | number,
): Promise<DncrDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: DncrDossierRecord }>(
      withBase(`/api/dossiers/${encodeURIComponent(String(idOrCode))}/finalize`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    return data.item;
  }
  const all = readLocalList<DncrDossierRecord>(LS_DOSSIERS);
  const idx = all.findIndex(
    (d) => d.dossierCode === String(idOrCode) || String(d.id) === String(idOrCode),
  );
  if (idx < 0) throw new Error('Dossier not found.');
  if (all[idx]!.lockedAt) throw new Error('Dossier is already finalized and sealed.');
  const now = new Date().toISOString();
  const sealed: DncrDossierRecord = {
    ...all[idx]!,
    publicSlug: all[idx]!.publicSlug || makeLocalSlug(all[idx]!.dossierCode),
    lockedAt: now,
    updatedAt: now,
  };
  all[idx] = sealed;
  writeLocalList(LS_DOSSIERS, all);
  return sealed;
}

export async function deleteDossier(mode: ApiMode, idOrCode: string | number): Promise<void> {
  if (mode === 'server') {
    await fetchJson(withBase(`/api/dossiers/${encodeURIComponent(String(idOrCode))}`), {
      method: 'DELETE',
    });
    return;
  }
  const all = readLocalList<DncrDossierRecord>(LS_DOSSIERS);
  const target = all.find(
    (d) => d.dossierCode === String(idOrCode) || String(d.id) === String(idOrCode),
  );
  if (!target) throw new Error('Dossier not found.');
  if (target.lockedAt) throw new Error('Sealed dossier cannot be deleted.');
  writeLocalList(
    LS_DOSSIERS,
    all.filter((d) => d.dossierCode !== target.dossierCode),
  );
}

export async function getPublicReport(
  mode: ApiMode,
  slugOrCode: string,
): Promise<PublicDncrReport | null> {
  if (mode === 'server') {
    try {
      return await fetchJson<PublicDncrReport>(
        withBase(`/api/public/reports/${encodeURIComponent(slugOrCode)}`),
      );
    } catch {
      return null;
    }
  }
  const all = readLocalList<DncrDossierRecord>(LS_DOSSIERS);
  const item = all.find(
    (d) =>
      Boolean(d.lockedAt) &&
      (d.publicSlug === slugOrCode || d.dossierCode === slugOrCode),
  );
  if (!item || !item.lockedAt) return null;

  let views: Record<string, { viewCount: number; lastViewedAt: string }> = {};
  try {
    const raw = localStorage.getItem(LS_VIEWS);
    views = raw ? (JSON.parse(raw) as typeof views) : {};
  } catch {
    views = {};
  }
  const prev = views[item.dossierCode]?.viewCount ?? 0;
  const now = new Date().toISOString();
  views[item.dossierCode] = { viewCount: prev + 1, lastViewedAt: now };
  localStorage.setItem(LS_VIEWS, JSON.stringify(views));

  return {
    viewCount: prev + 1,
    lastViewedAt: now,
    report: {
      dossierCode: item.dossierCode,
      publicSlug: item.publicSlug || makeLocalSlug(item.dossierCode),
      organizationName: item.organizationName,
      sector: item.sector,
      carrier: item.carrier,
      assessmentDate: item.assessmentDate,
      status: item.status,
      readinessScore: item.readinessScore,
      lockedAt: item.lockedAt,
      dossierSha256: item.dossierSha256,
      legalDisclaimerEn: item.result.legalDisclaimerEn,
      legalDisclaimerAr: item.result.legalDisclaimerAr,
      callingRules: item.result.callingRules,
      penalty: item.result.penalty,
      briefAr: buildDncrBriefMarkdown(
        item.input,
        item.result,
        item.dossierCode,
        item.dossierSha256,
        'ar',
      ),
      briefEn: buildDncrBriefMarkdown(
        item.input,
        item.result,
        item.dossierCode,
        item.dossierSha256,
        'en',
      ),
    },
  };
}

export function triggerTextDownload(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildLocalFallbackSummaryCsv(
  dossierCode: string,
  input: AssessmentInput,
  result: AssessmentResult,
): string {
  const header = [
    'dossier_code',
    'organization_name',
    'sector',
    'carrier',
    'assessment_date',
    'status',
    'readiness_score',
    'offense_tier',
    'estimated_max_exposure_aed',
    'active_violation_count',
    'dossier_sha256',
  ].join(',');
  const row = [
    sanitizeCsvCell(dossierCode),
    sanitizeCsvCell(input.organizationName),
    sanitizeCsvCell(input.sector),
    sanitizeCsvCell(input.carrier),
    sanitizeCsvCell(input.assessmentDate),
    sanitizeCsvCell(result.status),
    sanitizeCsvCell(result.readinessScore),
    sanitizeCsvCell(input.offenseTier),
    sanitizeCsvCell(result.penalty.estimatedMaxExposureAed),
    sanitizeCsvCell(result.callingRules.activeViolationCount),
    sanitizeCsvCell(result.dossierSha256),
  ].join(',');
  return `\uFEFF${header}\n${row}\n`;
}

export function downloadBriefMarkdown(
  mode: ApiMode,
  dossier: DncrDossierRecord,
  locale: Locale,
): void {
  if (mode === 'server') {
    window.location.href = withBase(
      `/api/dossiers/${encodeURIComponent(dossier.dossierCode)}/brief.md?lang=${locale}`,
    );
    return;
  }
  const md = buildDncrBriefMarkdown(
    dossier.input,
    dossier.result,
    dossier.dossierCode,
    dossier.dossierSha256,
    locale,
  );
  triggerTextDownload(`${dossier.dossierCode}.${locale}.brief.md`, 'text/markdown;charset=utf-8', md);
}

export function downloadAuditCsv(mode: ApiMode, dossier: DncrDossierRecord): void {
  if (mode === 'server') {
    window.location.href = withBase(
      `/api/dossiers/${encodeURIComponent(dossier.dossierCode)}/export.csv`,
    );
    return;
  }
  const csv =
    dossier.result.csvAudit && dossier.result.csvAudit.rows.length > 0
      ? exportCallLogsAuditCsv(dossier.result.csvAudit)
      : buildLocalFallbackSummaryCsv(dossier.dossierCode, dossier.input, dossier.result);
  triggerTextDownload(`${dossier.dossierCode}.audit.csv`, 'text/csv;charset=utf-8', csv);
}
