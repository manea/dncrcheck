import { describe, expect, it } from 'vitest';
import {
  DNCR_CONTROLS,
  DNCR_PRESETS,
  assessDncrReadiness,
  auditCallLogsCsv,
  computePayloadDigest,
  evaluateCallingWindowAndCaps,
  evaluateDncrPenalties,
  exportCallLogsAuditCsv,
  sanitizeCsvCell,
} from '../../src/core/index.ts';

describe('DNCRCheck core (UAE Cabinet Resolutions No. 56 & 57 of 2024)', () => {
  it('exposes 6 weighted UAE telemarketing controls and explicit non-MoET/TDRA disclaimers', async () => {
    expect(DNCR_CONTROLS).toHaveLength(6);
    const totalWeight = DNCR_CONTROLS.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBe(100);

    const ready = await assessDncrReadiness(DNCR_PRESETS[0]!.input);
    expect(ready.toolName).toBe('DNCRCheck');
    expect(ready.legalDisclaimerEn).toContain('NOT affiliated');
    expect(ready.legalDisclaimerAr).toContain('ليست تابعة');
  });

  it('scores Preset 1 Dubai Real Estate Brokerage as ready 100/100 with AED 0 exposure', async () => {
    const res = await assessDncrReadiness(DNCR_PRESETS[0]!.input);
    expect(res.status).toBe('ready');
    expect(res.readinessScore).toBe(100);
    expect(res.callingRules.callingHoursCompliant).toBe(true);
    expect(res.callingRules.dailyCapCompliant).toBe(true);
    expect(res.callingRules.weeklyCapCompliant).toBe(true);
    expect(res.callingRules.lineCompliant).toBe(true);
    expect(res.penalty.estimatedMaxExposureAed).toBe(0);
    expect(res.penalty.licenseSuspensionRisk).toBe(false);
  });

  it('scores Preset 2 Sharjah Insurance Desk as conditional 70/100 with AED 10k operational tier', async () => {
    const res = await assessDncrReadiness(DNCR_PRESETS[1]!.input);
    expect(res.status).toBe('conditional');
    expect(res.readinessScore).toBe(70);
    expect(res.penalty.operationalFineAed).toBe(10_000);
    expect(res.penalty.estimatedMaxExposureAed).toBe(10_000);
    expect(res.findings.some((f) => f.code === 'DNC-AUTOMATED-DIALER')).toBe(true);
    expect(res.findings.some((f) => f.code === 'DNC-DISCLOSURE-RECORDING-GAP')).toBe(true);
  });

  it('flags Preset 3 Unlicensed Personal-Mobile Repeat Desk as blocked 0/100 with AED 150k cap & CSV blockers', async () => {
    const res = await assessDncrReadiness(DNCR_PRESETS[2]!.input);
    expect(res.status).toBe('blocked');
    expect(res.readinessScore).toBe(0);
    expect(res.penalty.dncrBreachFineAed).toBe(150_000);
    expect(res.penalty.permitFineAed).toBe(150_000);
    expect(res.penalty.personalLineMinFineAed).toBe(5_000);
    expect(res.penalty.personalLineMaxFineAed).toBe(50_000);
    expect(res.penalty.estimatedMaxExposureAed).toBe(150_000);
    expect(res.penalty.licenseSuspensionRisk).toBe(true);
    expect(res.penalty.telecomDisconnectionRisk).toBe(true);

    expect(res.csvAudit?.totalRows).toBe(3);
    expect(res.csvAudit?.blockedCount).toBe(2);
    expect(res.csvAudit?.readyCount).toBe(1);
    expect(res.csvAudit?.dncrHitCount).toBe(1);
    expect(res.csvAudit?.afterHoursCount).toBe(1);
    expect(res.csvAudit?.frequencyCapBreachCount).toBe(1);
    expect(res.csvAudit?.rejectedFollowupCount).toBe(1);
    expect(res.csvAudit?.personalLineCount).toBe(1);
  });

  it('enforces exact 09:00-18:00 hours and 1/day 2/week frequency boundaries', () => {
    const validBoundary = evaluateCallingWindowAndCaps({
      ...DNCR_PRESETS[0]!.input,
      callingWindowStartHour: 9,
      callingWindowEndHour: 18,
      maxCallsPerDay: 1,
      maxCallsPerWeek: 2,
    });
    expect(validBoundary.callingRules.callingHoursCompliant).toBe(true);
    expect(validBoundary.callingRules.dailyCapCompliant).toBe(true);
    expect(validBoundary.callingRules.weeklyCapCompliant).toBe(true);

    const invalidHours = evaluateCallingWindowAndCaps({
      ...DNCR_PRESETS[0]!.input,
      callingWindowStartHour: 8,
      callingWindowEndHour: 19,
      maxCallsPerDay: 2,
      maxCallsPerWeek: 3,
    });
    expect(invalidHours.callingRules.callingHoursCompliant).toBe(false);
    expect(invalidHours.callingRules.dailyCapCompliant).toBe(false);
    expect(invalidHours.callingRules.weeklyCapCompliant).toBe(false);
  });

  it('scales DNCR violation fine 50,000 -> 75,000 -> 150,000 across offense tiers', () => {
    const first = evaluateDncrPenalties(
      { ...DNCR_PRESETS[0]!.input, dncrScrubbingActive: false, offenseTier: 'first' },
      evaluateCallingWindowAndCaps({ ...DNCR_PRESETS[0]!.input, dncrScrubbingActive: false })
        .callingRules,
    );
    const second = evaluateDncrPenalties(
      { ...DNCR_PRESETS[0]!.input, dncrScrubbingActive: false, offenseTier: 'second' },
      evaluateCallingWindowAndCaps({ ...DNCR_PRESETS[0]!.input, dncrScrubbingActive: false })
        .callingRules,
    );
    const repeat = evaluateDncrPenalties(
      { ...DNCR_PRESETS[0]!.input, dncrScrubbingActive: false, offenseTier: 'third_or_more' },
      evaluateCallingWindowAndCaps({ ...DNCR_PRESETS[0]!.input, dncrScrubbingActive: false })
        .callingRules,
    );
    expect(first.dncrBreachFineAed).toBe(50_000);
    expect(second.dncrBreachFineAed).toBe(75_000);
    expect(repeat.dncrBreachFineAed).toBe(150_000);
  });

  it('neutralizes CWE-1236 spreadsheet formula prefixes and emits UTF-8 BOM in CSV exports', () => {
    expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvCell('=HYPERLINK("http://bad")')).toBe('"\'=HYPERLINK(""http://bad"")"');
    const summary = auditCallLogsCsv(DNCR_PRESETS[2]!.input.callLogsCsv!);
    const csv = exportCallLogsAuditCsv(summary);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
  });

  it('produces deterministic SHA-256 digests identical for identical canonical inputs', async () => {
    const runA = await assessDncrReadiness(DNCR_PRESETS[0]!.input);
    const runB = await assessDncrReadiness(DNCR_PRESETS[0]!.input);
    expect(runA.dossierSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(runA.dossierSha256).toBe(runB.dossierSha256);
    expect(await computePayloadDigest(runA.canonicalDossierText)).toBe(runA.dossierSha256);
  });
});
