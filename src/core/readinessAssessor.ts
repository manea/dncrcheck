import { evaluateCallingWindowAndCaps } from './callingWindowAndCapEngine.ts';
import { auditCallLogsCsv } from './callLogCsvAuditor.ts';
import {
  DNCRCHECK_TOOL_VERSION,
  DNCR_CONTROLS,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
} from './dncrCatalog.ts';
import { evaluateDncrPenalties } from './dncrPenaltyEngine.ts';
import { canonicalizeDossierPayload, computePayloadDigest } from './dossierDigest.ts';
import type {
  AssessmentInput,
  AssessmentResult,
  FindingItem,
  ReadinessStatus,
} from './types.ts';

export function evaluateDncrCoreSync(
  input: AssessmentInput,
): AssessmentResult {
  const rulesEval = evaluateCallingWindowAndCaps(input);
  const penalty = evaluateDncrPenalties(input, rulesEval.callingRules);
  const csvAudit =
    input.callLogsCsv && input.callLogsCsv.trim()
      ? auditCallLogsCsv(input.callLogsCsv)
      : null;

  const findings: FindingItem[] = [...rulesEval.findings];

  if (csvAudit) {
    if (csvAudit.parseErrors.length > 0) {
      findings.push({
        code: 'DNC-CSV-PARSE-ERROR',
        severity: 'warning',
        titleEn: 'Call Log CSV Parse Issue',
        titleAr: 'مشكلة في قراءة ملف CSV لسجلات المكالمات',
        detailEn: csvAudit.parseErrors.join(' '),
        detailAr: csvAudit.parseErrors.join(' '),
        legalRef: 'DNCRCheck Batch Call-Log Auditor',
      });
    } else if (csvAudit.blockedCount > 0) {
      findings.push({
        code: 'DNC-CSV-CALL-VIOLATIONS',
        severity: 'blocker',
        titleEn: `${csvAudit.blockedCount} Outbound Call Record(s) Flagged With Statutory Violations`,
        titleAr: `رصد ${csvAudit.blockedCount} مكالمات بمخالفات حاجبة في سجل CSV`,
        detailEn: `Batch CSV flagged ${csvAudit.dncrHitCount} DNCR call(s), ${csvAudit.afterHoursCount} after-hours dial(s), ${csvAudit.frequencyCapBreachCount} frequency breach(es), and ${csvAudit.personalLineCount} personal/unregistered line call(s).`,
        detailAr: `كشف كشف CSV وجود ${csvAudit.dncrHitCount} اتصالاً بأرقام DNCR و${csvAudit.afterHoursCount} خارج ساعات 9ص–6م و${csvAudit.frequencyCapBreachCount} تجاوز لسقف التكرار و${csvAudit.personalLineCount} من هواتف شخصية.`,
        legalRef: 'UAE Cabinet Resolutions No. 56 & 57 of 2024',
      });
    } else if (csvAudit.conditionalCount > 0) {
      findings.push({
        code: 'DNC-CSV-DISCLOSURE-WARNINGS',
        severity: 'warning',
        titleEn: `${csvAudit.conditionalCount} Call(s) Missing Recording or Upfront Disclosure`,
        titleAr: `${csvAudit.conditionalCount} مكالمة تفتقر لتسجيل المكالمة أو الإفصاح المبدئي`,
        detailEn: 'Ensure opening script states company identity, purpose, and call recording notice.',
        detailAr: 'تحقق من تضمين نص المكالمة للتعريف بالشركة والغرض وإشعار التسجيل.',
        legalRef: 'Cabinet Resolution No. 56 of 2024',
      });
    }
  }

  const implementedSet = new Set(input.implementedControls);
  const controls = DNCR_CONTROLS.map((spec) => ({
    id: spec.id,
    titleEn: spec.titleEn,
    titleAr: spec.titleAr,
    implemented: implementedSet.has(spec.id),
    weight: spec.weight,
  }));

  const controlsScore = controls.reduce(
    (sum, c) => (c.implemented ? sum + c.weight : sum),
    0,
  );

  let deduction = 0;
  if (!input.hasPriorTelemarketingPermit) deduction += 30;
  if (!input.dncrScrubbingActive) deduction += 30;
  if (!rulesEval.callingRules.lineCompliant) deduction += 25;
  if (
    !rulesEval.callingRules.callingHoursCompliant ||
    !rulesEval.callingRules.dailyCapCompliant ||
    !rulesEval.callingRules.weeklyCapCompliant
  ) {
    deduction += 15;
  }
  if (!rulesEval.callingRules.rejectionRuleCompliant) deduction += 15;
  if (!rulesEval.callingRules.disclosureAndRecordingCompliant) deduction += 10;
  if (input.automatedDialerUsed) deduction += 10;
  if (csvAudit && csvAudit.blockedCount > 0) deduction += 15;

  const readinessScore = Math.max(0, Math.min(100, controlsScore - deduction));

  const hasBlocker =
    findings.some((f) => f.severity === 'blocker') || (csvAudit?.blockedCount ?? 0) > 0;
  const hasWarning =
    findings.some((f) => f.severity === 'warning') || (csvAudit?.conditionalCount ?? 0) > 0;

  const status: ReadinessStatus = hasBlocker
    ? 'blocked'
    : hasWarning || readinessScore < 100
      ? 'conditional'
      : 'ready';

  const canonicalDossierText = canonicalizeDossierPayload({
    toolName: 'DNCRCheck',
    version: DNCRCHECK_TOOL_VERSION,
    input,
    callingRules: rulesEval.callingRules,
    penalty,
    status,
    readinessScore,
  });

  return {
    toolName: 'DNCRCheck',
    version: DNCRCHECK_TOOL_VERSION,
    legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
    legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
    organizationName: input.organizationName,
    sector: input.sector,
    assessmentDate: input.assessmentDate,
    callingRules: rulesEval.callingRules,
    penalty,
    csvAudit,
    status,
    readinessScore,
    controls,
    findings,
    canonicalDossierText,
    dossierSha256: '',
  };
}

export async function assessDncrReadiness(
  input: AssessmentInput,
): Promise<AssessmentResult> {
  const syncResult = evaluateDncrCoreSync(input);
  const dossierSha256 = await computePayloadDigest(syncResult.canonicalDossierText);
  return {
    ...syncResult,
    dossierSha256,
  };
}
