import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app.mjs';
import { DNCRCHECK_TOOL_VERSION, DNCR_PRESETS } from '../../src/core/index.ts';

const activeServers: Array<{ close: () => Promise<void> }> = [];
const tempDirs: string[] = [];

function makeTempDir(prefix = 'dncrcheck-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function startTestApp(options: Parameters<typeof createApp>[0] = {}) {
  const dataDir = options.dataDir ?? makeTempDir();
  const app = createApp({
    basePath: '/dncrcheck',
    dataDir,
    ...options,
  });
  activeServers.push(app);
  const bound = await app.listen(0, '127.0.0.1');
  return { app, baseUrl: bound.url, rootUrl: `http://${bound.host}:${bound.port}` };
}

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!;
    await srv.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('DNCRCheck SQLite WAL HTTP Server (v0.2.0)', () => {
  it('serves /health, /readyz, BASE_PATH HTML injection, and /api/presets', async () => {
    const { baseUrl, rootUrl } = await startTestApp();

    const healthRes = await fetch(`${baseUrl}/health`);
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get('x-content-type-options')).toBe('nosniff');
    expect(healthRes.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    const health = (await healthRes.json()) as {
      ok: boolean;
      service: string;
      version: string;
      basePath: string;
      db: { journalMode: string };
    };
    expect(health.ok).toBe(true);
    expect(health.service).toBe('dncrcheck');
    expect(health.version).toBe(DNCRCHECK_TOOL_VERSION);
    expect(health.basePath).toBe('/dncrcheck');
    expect(health.db.journalMode).toBe('wal');

    const readyRes = await fetch(`${rootUrl}/readyz`);
    expect(readyRes.status).toBe(200);
    const ready = (await readyRes.json()) as { ready: boolean; journalMode: string };
    expect(ready.ready).toBe(true);
    expect(ready.journalMode).toBe('wal');

    const htmlRes = await fetch(`${baseUrl}/`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('window.__DNCRCHECK_BASE__="/dncrcheck"');

    const presetsRes = await fetch(`${baseUrl}/api/presets`);
    expect(presetsRes.status).toBe(200);
    const presetsJson = (await presetsRes.json()) as {
      ok: boolean;
      toolName: string;
      legalDisclaimerEn: string;
      legalDisclaimerAr: string;
      presets: Array<{ id: string }>;
    };
    expect(presetsJson.ok).toBe(true);
    expect(presetsJson.toolName).toBe('DNCRCheck');
    expect(presetsJson.presets).toHaveLength(3);
    expect(presetsJson.legalDisclaimerEn).toContain('NOT affiliated');
    expect(presetsJson.legalDisclaimerAr).toContain('MoET');
  });

  it('evaluates stateless /api/calling-rules, /api/penalties, /api/audit-csv, and /api/assess', async () => {
    const { baseUrl } = await startTestApp();

    const rulesRes = await fetch(`${baseUrl}/api/calling-rules`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Al Marina Cold Call Desk',
        isPersonalMobileUsed: true,
        callerLineType: 'personal_mobile',
        callingWindowStartHour: 8,
        callingWindowEndHour: 20,
        maxCallsPerDay: 2,
      }),
    });
    expect(rulesRes.status).toBe(200);
    const rulesJson = (await rulesRes.json()) as {
      callingRules: {
        callingHoursCompliant: boolean;
        dailyCapCompliant: boolean;
        lineCompliant: boolean;
      };
    };
    expect(rulesJson.callingRules.callingHoursCompliant).toBe(false);
    expect(rulesJson.callingRules.dailyCapCompliant).toBe(false);
    expect(rulesJson.callingRules.lineCompliant).toBe(false);

    const penRes = await fetch(`${baseUrl}/api/penalties`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: DNCR_PRESETS[2]!.id }),
    });
    expect(penRes.status).toBe(200);
    const penJson = (await penRes.json()) as {
      penalty: {
        dncrBreachFineAed: number;
        permitFineAed: number;
        estimatedMaxExposureAed: number;
        licenseSuspensionRisk: boolean;
      };
    };
    expect(penJson.penalty.dncrBreachFineAed).toBe(150_000);
    expect(penJson.penalty.permitFineAed).toBe(150_000);
    expect(penJson.penalty.estimatedMaxExposureAed).toBe(150_000);
    expect(penJson.penalty.licenseSuspensionRisk).toBe(true);

    const emptyCsvRes = await fetch(`${baseUrl}/api/audit-csv`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: '   ' }),
    });
    expect(emptyCsvRes.status).toBe(400);

    const csvRes = await fetch(`${baseUrl}/api/audit-csv`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: DNCR_PRESETS[2]!.input.callLogsCsv }),
    });
    expect(csvRes.status).toBe(200);
    const csvJson = (await csvRes.json()) as {
      audit: { totalRows: number; blockedCount: number; dncrHitCount: number };
      exportCsv: string;
    };
    expect(csvJson.audit.totalRows).toBe(3);
    expect(csvJson.audit.blockedCount).toBe(2);
    expect(csvJson.audit.dncrHitCount).toBe(1);
    expect(csvJson.exportCsv.startsWith('\uFEFF')).toBe(true);
    expect(csvJson.exportCsv).toContain("'=HYPERLINK");

    const assessRes = await fetch(`${baseUrl}/api/assess`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: DNCR_PRESETS[2]!.id }),
    });
    expect(assessRes.status).toBe(200);
    const assessJson = (await assessRes.json()) as {
      assessment: { status: string; readinessScore: number; dossierSha256: string };
    };
    expect(assessJson.assessment.status).toBe('blocked');
    expect(assessJson.assessment.readinessScore).toBe(0);
    expect(assessJson.assessment.dossierSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('supports Profiles CRUD lifecycle cleans', async () => {
    const { baseUrl } = await startTestApp();

    const badProf = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationName: '  ' }),
    });
    expect(badProf.status).toBe(400);

    const createRes = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Palm Properties Outreach Desk',
        sector: 'real_estate_brokerage',
        carrier: 'du',
        notes: 'Initial desk profile',
      }),
    });
    expect(createRes.status).toBe(201);
    const { profile } = (await createRes.json()) as {
      profile: { id: number; carrier: string; sector: string };
    };
    expect(profile.carrier).toBe('du');

    const patchRes = await fetch(`${baseUrl}/api/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'Upgraded carrier', carrier: 'etisalat_e_and' }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { profile: { carrier: string } };
    expect(patched.profile.carrier).toBe('etisalat_e_and');

    const listRes = await fetch(`${baseUrl}/api/profiles`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { total: number };
    expect(list.total).toBe(1);

    const delRes = await fetch(`${baseUrl}/api/profiles/${profile.id}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);
    expect((await fetch(`${baseUrl}/api/profiles/${profile.id}`)).status).toBe(404);
  });

  it('persists dossiers with atomic DNC-YYYY-0001 codes, 409 locks, brief.md, wire BOM CSV & public reports', async () => {
    const { baseUrl } = await startTestApp();
    const year = new Date().getUTCFullYear();

    const create1 = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        presetId: DNCR_PRESETS[2]!.id,
        title: 'AD Unlicensed Sales Audit Q4',
      }),
    });
    expect(create1.status).toBe(201);
    const { item: item1 } = (await create1.json()) as {
      item: { dossierCode: string; status: string; estimatedMaxExposureAed: number };
    };
    expect(item1.dossierCode).toBe(`DNC-${year}-0001`);
    expect(item1.status).toBe('blocked');
    expect(item1.estimatedMaxExposureAed).toBe(150_000);

    const create2 = await fetch(`${baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: DNCR_PRESETS[0]!.id }),
    });
    expect(create2.status).toBe(201);
    const { item: item2 } = (await create2.json()) as { item: { dossierCode: string; status: string } };
    expect(item2.dossierCode).toBe(`DNC-${year}-0002`);
    expect(item2.status).toBe('ready');

    const filtered = await fetch(`${baseUrl}/api/dossiers?status=blocked&q=DNC-${year}-0001`);
    expect(filtered.status).toBe(200);
    expect(((await filtered.json()) as { total: number }).total).toBe(1);

    expect((await fetch(`${baseUrl}/api/public/reports/${item1.dossierCode}`)).status).toBe(404);

    const patchDraft = await fetch(`${baseUrl}/api/assessments/${item1.dossierCode}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'Escalated to legal review' }),
    });
    expect(patchDraft.status).toBe(200);

    const finalizeRes = await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}/finalize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(finalizeRes.status).toBe(200);
    const { item: sealed } = (await finalizeRes.json()) as {
      item: { lockedAt: string; publicSlug: string; dossierSha256: string };
    };
    expect(sealed.publicSlug).toMatch(/^dncr-[0-9a-f]{12}$/);

    expect(
      (
        await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}/lock`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(409);

    expect(
      (
        await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ organizationName: 'Illegal Edit' }),
        })
      ).status,
    ).toBe(409);

    expect(
      (await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}`, { method: 'DELETE' })).status,
    ).toBe(409);

    const dupRes = await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}/duplicate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Remediation Plan Draft' }),
    });
    expect(dupRes.status).toBe(201);
    const { item: copyItem } = (await dupRes.json()) as {
      item: { dossierCode: string; lockedAt: string | null };
    };
    expect(copyItem.dossierCode).toBe(`DNC-${year}-0003`);
    expect(copyItem.lockedAt).toBeNull();

    const briefAr = await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}/brief.md?lang=ar`);
    expect(briefAr.status).toBe(200);
    const arText = await briefAr.text();
    expect(arText).toContain(item1.dossierCode);
    expect(arText).toContain('MoET');

    const briefEn = await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}/brief.md?lang=en`);
    expect(briefEn.status).toBe(200);
    const enText = await briefEn.text();
    expect(enText).toContain('UAE Telemarketing & DNCR Readiness Brief');
    expect(enText).toContain('NOT affiliated');

    const csvRes = await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}/export.csv`);
    expect(csvRes.status).toBe(200);
    const rawBytes = new Uint8Array(await csvRes.arrayBuffer());
    expect(Array.from(rawBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8').decode(rawBytes.slice(3))).toContain("'=HYPERLINK");

    const fallbackCsvRes = await fetch(`${baseUrl}/api/dossiers/${item2.dossierCode}/export.csv`);
    expect(fallbackCsvRes.status).toBe(200);
    const fbBytes = new Uint8Array(await fallbackCsvRes.arrayBuffer());
    expect(Array.from(fbBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const summaryRes = await fetch(`${baseUrl}/api/dossiers/${item1.dossierCode}/summary?lang=en`);
    expect(summaryRes.status).toBe(200);
    const sumJson = (await summaryRes.json()) as {
      csvAuditSummary: { totalRows: number } | null;
      briefMarkdown: string;
    };
    expect(sumJson.csvAuditSummary?.totalRows).toBe(3);
    expect(sumJson.briefMarkdown).toContain(item1.dossierCode);

    const pub1 = await fetch(`${baseUrl}/api/public/reports/${sealed.publicSlug}`);
    expect(pub1.status).toBe(200);
    expect(((await pub1.json()) as { viewCount: number }).viewCount).toBe(1);

    const pub2 = await fetch(`${baseUrl}/api/public/reports/${item1.dossierCode}`);
    expect(pub2.status).toBe(200);
    expect(((await pub2.json()) as { viewCount: number }).viewCount).toBe(2);

    expect(
      (await fetch(`${baseUrl}/api/dossiers/${copyItem.dossierCode}`, { method: 'DELETE' })).status,
    ).toBe(200);
  });

  it('enforces 413 body limit, 429 API rate limit (exempting /health & /readyz), and 400/404 validation errors', async () => {
    const { baseUrl } = await startTestApp({
      maxBodyBytes: 256,
      rateLimitMax: 4,
      rateLimitWindowMs: 60_000,
    });

    expect(
      (
        await fetch(`${baseUrl}/api/assess`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{bad',
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await fetch(`${baseUrl}/api/assess`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ callingWindowStartHour: 45 }),
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await fetch(`${baseUrl}/api/assess`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ organizationName: 'X'.repeat(400) }),
        })
      ).status,
    ).toBe(413);

    expect((await fetch(`${baseUrl}/api/unknown-route`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/presets`)).status).toBe(429);
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/readyz`)).status).toBe(200);
  });
});
