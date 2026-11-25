import {
  FINE_DNCR_FIRST_AED,
  FINE_DNCR_REPEAT_AED,
  FINE_DNCR_SECOND_AED,
  FINE_OPERATIONAL_TIER_AED,
  FINE_PERMIT_MISSING_FIRST_AED,
  FINE_PERMIT_MISSING_REPEAT_AED,
  FINE_PERMIT_MISSING_SECOND_AED,
  FINE_PERSONAL_LINE_MAX_AED,
  FINE_PERSONAL_LINE_MIN_AED,
  STATUTORY_SINGLE_VIOLATION_CEILING_AED,
} from './dncrCatalog.ts';
import type {
  AssessmentInput,
  CallingRulesResult,
  PenaltyExposureResult,
} from './types.ts';

export function evaluateDncrPenalties(
  input: AssessmentInput,
  callingRules: CallingRulesResult,
): PenaltyExposureResult {
  const tier = input.offenseTier;

  const permitFineAed = !input.hasPriorTelemarketingPermit
    ? tier === 'third_or_more'
      ? FINE_PERMIT_MISSING_REPEAT_AED
      : tier === 'second'
        ? FINE_PERMIT_MISSING_SECOND_AED
        : FINE_PERMIT_MISSING_FIRST_AED
    : 0;

  const dncrBreachFineAed = !input.dncrScrubbingActive
    ? tier === 'third_or_more'
      ? FINE_DNCR_REPEAT_AED
      : tier === 'second'
        ? FINE_DNCR_SECOND_AED
        : FINE_DNCR_FIRST_AED
    : 0;

  const personalLineMinFineAed = !callingRules.lineCompliant ? FINE_PERSONAL_LINE_MIN_AED : 0;
  const personalLineMaxFineAed = !callingRules.lineCompliant ? FINE_PERSONAL_LINE_MAX_AED : 0;

  const hasOperationalIssue =
    !callingRules.callingHoursCompliant ||
    !callingRules.dailyCapCompliant ||
    !callingRules.weeklyCapCompliant ||
    !callingRules.disclosureAndRecordingCompliant ||
    !callingRules.rejectionRuleCompliant ||
    input.automatedDialerUsed;

  const operationalFineAed = hasOperationalIssue
    ? tier === 'third_or_more'
      ? FINE_DNCR_FIRST_AED
      : FINE_OPERATIONAL_TIER_AED
    : 0;

  const minCandidates = [
    permitFineAed,
    dncrBreachFineAed,
    personalLineMinFineAed,
    operationalFineAed,
  ].filter((v) => v > 0);

  const estimatedMinExposureAed = minCandidates.length > 0 ? Math.min(...minCandidates) : 0;
  const estimatedMaxExposureAed = Math.min(
    STATUTORY_SINGLE_VIOLATION_CEILING_AED,
    Math.max(
      permitFineAed,
      dncrBreachFineAed,
      personalLineMaxFineAed,
      operationalFineAed,
    ),
  );

  const licenseSuspensionRisk =
    (!input.hasPriorTelemarketingPermit || !input.dncrScrubbingActive) &&
    tier !== 'first';

  const telecomDisconnectionRisk =
    !callingRules.lineCompliant || !input.dncrScrubbingActive;

  return {
    offenseTier: tier,
    permitFineAed,
    dncrBreachFineAed,
    personalLineMinFineAed,
    personalLineMaxFineAed,
    operationalFineAed,
    estimatedMinExposureAed,
    estimatedMaxExposureAed,
    licenseSuspensionRisk,
    telecomDisconnectionRisk,
  };
}
