export type OffenseTier = 'first' | 'second' | 'third_or_more';

export type CallerLineType =
  | 'corporate_licensed_uae'
  | 'registered_call_center'
  | 'personal_mobile'
  | 'unregistered_voip';

export type TelecomCarrier = 'etisalat_e_and' | 'du' | 'other_licensed';

export type DncrSector =
  | 'real_estate_brokerage'
  | 'banking_insurance_finance'
  | 'saas_b2b_services'
  | 'retail_ecommerce'
  | 'education_healthcare'
  | 'other_commercial';

export type ReadinessStatus = 'ready' | 'conditional' | 'blocked';
export type SeverityLevel = 'blocker' | 'warning' | 'info';

export type DncrControlId =
  | 'DNC-CTRL-01'
  | 'DNC-CTRL-02'
  | 'DNC-CTRL-03'
  | 'DNC-CTRL-04'
  | 'DNC-CTRL-05'
  | 'DNC-CTRL-06';

export interface DncrControlSpec {
  id: DncrControlId;
  weight: number;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export interface AssessmentInput {
  organizationName: string;
  sector: DncrSector;
  assessmentDate: string;
  hasPriorTelemarketingPermit: boolean;
  carrier: TelecomCarrier;
  callerLineType: CallerLineType;
  isPersonalMobileUsed: boolean;
  dncrScrubbingActive: boolean;
  callingWindowStartHour: number;
  callingWindowEndHour: number;
  maxCallsPerDay: number;
  maxCallsPerWeek: number;
  blocksRejectedFollowups: boolean;
  callRecordingEnabled: boolean;
  openingDisclosureGiven: boolean;
  automatedDialerUsed: boolean;
  offenseTier: OffenseTier;
  callLogsCsv?: string;
  implementedControls: readonly DncrControlId[];
  notes?: string;
}

export interface FindingItem {
  code: string;
  severity: SeverityLevel;
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  legalRef: string;
}

export interface CallingRulesResult {
  callingHoursCompliant: boolean;
  dailyCapCompliant: boolean;
  weeklyCapCompliant: boolean;
  lineCompliant: boolean;
  permitAndDncrCompliant: boolean;
  disclosureAndRecordingCompliant: boolean;
  rejectionRuleCompliant: boolean;
  activeViolationCount: number;
}

export interface PenaltyExposureResult {
  offenseTier: OffenseTier;
  permitFineAed: number;
  dncrBreachFineAed: number;
  personalLineMinFineAed: number;
  personalLineMaxFineAed: number;
  operationalFineAed: number;
  estimatedMinExposureAed: number;
  estimatedMaxExposureAed: number;
  licenseSuspensionRisk: boolean;
  telecomDisconnectionRisk: boolean;
}

export interface CallLogCsvRowAudit {
  rowNumber: number;
  callId: string;
  callerLine: string;
  onDncr: boolean;
  callHourGst: number;
  callsSameDay: number;
  callsSameWeek: number;
  priorRejected: boolean;
  recordedAndDisclosed: boolean;
  status: ReadinessStatus;
  issues: string[];
}

export interface CallLogCsvAuditSummary {
  totalRows: number;
  readyCount: number;
  conditionalCount: number;
  blockedCount: number;
  dncrHitCount: number;
  afterHoursCount: number;
  frequencyCapBreachCount: number;
  rejectedFollowupCount: number;
  personalLineCount: number;
  rows: CallLogCsvRowAudit[];
  parseErrors: string[];
}

export interface AssessmentResult {
  toolName: 'DNCRCheck';
  version: string;
  legalDisclaimerEn: string;
  legalDisclaimerAr: string;
  organizationName: string;
  sector: DncrSector;
  assessmentDate: string;
  callingRules: CallingRulesResult;
  penalty: PenaltyExposureResult;
  csvAudit: CallLogCsvAuditSummary | null;
  status: ReadinessStatus;
  readinessScore: number;
  controls: Array<{
    id: DncrControlId;
    titleEn: string;
    titleAr: string;
    implemented: boolean;
    weight: number;
  }>;
  findings: FindingItem[];
  canonicalDossierText: string;
  dossierSha256: string;
}

export interface DncrPreset {
  id: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  input: AssessmentInput;
}
